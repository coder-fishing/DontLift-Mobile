import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import * as Crypto from 'expo-crypto';
import { acceptsBillProgress } from './payment-status-domain';
import {
  BillRepositoryError, type ApplyBillOverridesCommand, type CalculateBillCommand,
  type PublishedBill, createBillRepository,
} from './bill-repository';
import type { BillShareOverride } from './bill-allocation';
import { PaymentStatusError, type MarkPaymentCommand, createPaymentStatusRepository } from './payment-status-repository';
import type { PublishedBillState } from './published-bill-listener';
import type { RoomLobbySnapshot } from '../rooms/room-listener';

type BillRepository = ReturnType<typeof createBillRepository>;
type PaymentRepository = ReturnType<typeof createPaymentStatusRepository>;

function billPublishErrorMessage(error: unknown): string {
  if (!(error instanceof BillRepositoryError)) return 'Could not publish the bill split. Reconnect and retry.';
  switch (error.code) {
    case 'unauthenticated': return 'Your sign-in expired. Sign in again and retry.';
    case 'invalid-argument': return 'Enter a whole bill amount of at least 1,000 VND.';
    case 'not-found': return 'This room could not be found.';
    case 'permission-denied': return 'Firebase denied publishing. Confirm the Host role, saved payment details, and deployed Firestore Rules.';
    case 'failed-precondition': return 'Finalize room scores and save payment details before publishing. A room can be published only once.';
    case 'already-exists': return 'This request ID was already used for a different bill.';
    case 'unavailable': return 'Could not confirm the transaction. Reconnect and retry the same request; it is not queued offline.';
  }
}

export function useGroupBillActions({
  snapshot,
  uid,
  isOnline,
  repository,
  paymentRepository,
  publishedBillState,
  setPublishedBillState,
  setListenerRevision,
}: {
  snapshot: RoomLobbySnapshot | null;
  uid: string;
  isOnline: boolean;
  repository: BillRepository;
  paymentRepository: PaymentRepository;
  publishedBillState: PublishedBillState;
  setPublishedBillState: Dispatch<SetStateAction<PublishedBillState>>;
  setListenerRevision: Dispatch<SetStateAction<number>>;
}) {
  const [committedBill, setCommittedBill] = useState<PublishedBill | null>(null);
  const [isPublishingBill, setIsPublishingBill] = useState(false);
  const [billPublishError, setBillPublishError] = useState<string>();
  const [isMarkingPayment, setIsMarkingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string>();
  const [isApplyingBillOverride, setIsApplyingBillOverride] = useState(false);
  const [billOverrideError, setBillOverrideError] = useState<string>();
  const pendingPayment = useRef<MarkPaymentCommand | null>(null);
  const pendingBillCommand = useRef<{ command: CalculateBillCommand; rosterMemberUids: string[] } | null>(null);
  const pendingBillOverride = useRef<{ command: ApplyBillOverridesCommand; rosterMemberUids: string[] } | null>(null);
  const activeBillRoomId = useRef<string | null>(null);
  const latestBillRevision = useRef<{ roomId: string | null; revision: number; paidCount: number }>({ roomId: null, revision: -1, paidCount: 0 });

  useEffect(() => {
    activeBillRoomId.current = snapshot?.roomId ?? null;
    latestBillRevision.current = { roomId: activeBillRoomId.current, revision: -1, paidCount: 0 };
    pendingPayment.current = null;
    setIsMarkingPayment(false);
    setPaymentError(undefined);
    pendingBillCommand.current = null;
    pendingBillOverride.current = null;
    setCommittedBill(null);
    setBillPublishError(undefined);
    setBillOverrideError(undefined);
    setIsPublishingBill(false);
    setIsApplyingBillOverride(false);
  }, [snapshot?.roomId]);

  useEffect(() => {
    if (publishedBillState.kind === 'published') setCommittedBill(publishedBillState.bill);
    if (publishedBillState.kind === 'published' && pendingPayment.current
      && publishedBillState.bill.shares.some(share => share.uid === pendingPayment.current?.memberUid
        && share.paymentStatus === 'MARKED_AS_PAID')) {
      pendingPayment.current = null;
      setIsMarkingPayment(false);
      setPaymentError(undefined);
    }
    if (publishedBillState.kind === 'published') pendingBillCommand.current = null;
    if (publishedBillState.kind === 'published' && pendingBillOverride.current?.command.requestId === publishedBillState.bill.requestId) {
      pendingBillOverride.current = null;
      setBillOverrideError(undefined);
    }
    if (publishedBillState.kind === 'published' && (publishedBillState.bill.billPaidCount ?? 0) > 0) {
      pendingBillOverride.current = null;
      setIsApplyingBillOverride(false);
    }
  }, [publishedBillState]);

  const handlePublishBill = async (totalBillVnd?: number, shareOverrides?: BillShareOverride[], receiptEvidencePath?: string) => {
    const room = snapshot;
    const ownMember = room?.members.find(member => member.uid === uid);
    if (!room || room.reconciliationStatus !== 'FINALIZED' || ownMember?.role !== 'HOST'
      || ownMember.status !== 'ACTIVE' || isPublishingBill) return;

    let pending = pendingBillCommand.current;
    if (!pending) {
      if (totalBillVnd == null) return;
      pending = {
        command: {
          version: 1,
          requestId: Crypto.randomUUID(),
          roomId: room.roomId,
          totalBillVnd,
          ...(receiptEvidencePath ? { receiptEvidencePath } : {}),
          ...(shareOverrides?.length ? { shareOverrides: [...shareOverrides].sort((a, b) => a.uid.localeCompare(b.uid)) } : {}),
        },
        rosterMemberUids: room.members
          .filter(member => member.status === 'ACTIVE' || member.status === 'EARLY_EXIT')
          .map(member => member.uid),
      };
      pendingBillCommand.current = pending;
    } else if (pending.command.roomId !== room.roomId
      || (totalBillVnd != null && pending.command.totalBillVnd !== totalBillVnd)
      || (receiptEvidencePath != null && pending.command.receiptEvidencePath !== receiptEvidencePath)
      || (shareOverrides != null && JSON.stringify([...(pending.command.shareOverrides ?? [])].sort((a, b) => a.uid.localeCompare(b.uid)))
        !== JSON.stringify([...shareOverrides].sort((a, b) => a.uid.localeCompare(b.uid))))) return;

    setIsPublishingBill(true);
    setBillPublishError(undefined);
    try {
      const result = await repository.publish(pending.command, pending.rosterMemberUids);
      if (activeBillRoomId.current === pending.command.roomId) {
        pendingBillCommand.current = null;
        if (acceptsBillProgress(result, latestBillRevision.current)) {
          latestBillRevision.current = { roomId: result.roomId, revision: result.billRevision ?? 0, paidCount: result.billPaidCount ?? 0 };
          setCommittedBill(result);
          setPublishedBillState({ kind: 'published', bill: result });
        }
      }
    } catch (error) {
      if (activeBillRoomId.current === pending.command.roomId) setBillPublishError(billPublishErrorMessage(error));
      if (activeBillRoomId.current === pending.command.roomId
        && error instanceof BillRepositoryError && error.code !== 'unavailable') pendingBillCommand.current = null;
    } finally {
      if (activeBillRoomId.current === pending.command.roomId) setIsPublishingBill(false);
    }
  };

  const handleRetryPublishedBill = () => {
    if (!snapshot) return;
    setListenerRevision(revision => revision + 1);
  };

  const handleApplyBillOverrides = async (overrides?: BillShareOverride[], expectedRevision?: number) => {
    const room = snapshot;
    const ownMember = room?.members.find(member => member.uid === uid);
    if (!room || room.reconciliationStatus !== 'FINALIZED' || ownMember?.role !== 'HOST'
      || ownMember.status !== 'ACTIVE' || isApplyingBillOverride || !isOnline
      || pendingPayment.current || isMarkingPayment) return;
    let pending = pendingBillOverride.current;
    if (!pending) {
      if (!overrides?.length || expectedRevision == null) return;
      pending = {
        command: { version: 1, requestId: Crypto.randomUUID(), roomId: room.roomId, expectedRevision, overrides },
        rosterMemberUids: room.members
          .filter(member => member.status === 'ACTIVE' || member.status === 'EARLY_EXIT')
          .map(member => member.uid),
      };
      pendingBillOverride.current = pending;
    } else if (pending.command.roomId !== room.roomId
      || (expectedRevision != null && pending.command.expectedRevision !== expectedRevision)) return;

    setIsApplyingBillOverride(true);
    setBillOverrideError(undefined);
    try {
      const result = await repository.applyOverrides(pending.command, pending.rosterMemberUids);
      if (activeBillRoomId.current === pending.command.roomId) {
        pendingBillOverride.current = null;
        const resultRevision = result.billRevision ?? 0;
        if (acceptsBillProgress(result, latestBillRevision.current)) {
          latestBillRevision.current = { roomId: pending.command.roomId, revision: resultRevision, paidCount: result.billPaidCount ?? 0 };
          setCommittedBill(result);
          setPublishedBillState({ kind: 'published', bill: result });
        }
      }
    } catch (error) {
      if (activeBillRoomId.current === pending.command.roomId) setBillOverrideError(billPublishErrorMessage(error));
      if (activeBillRoomId.current === pending.command.roomId
        && error instanceof BillRepositoryError && error.code !== 'unavailable') pendingBillOverride.current = null;
    } finally {
      if (activeBillRoomId.current === pending.command.roomId) setIsApplyingBillOverride(false);
    }
  };

  const handleMarkPayment = async (memberUid?: string, publicationRequestId?: string, expectedRevision?: number) => {
    const room = snapshot;
    const host = room?.members.find(member => member.uid === uid);
    if (!room || activeBillRoomId.current !== room.roomId || host?.role !== 'HOST' || host.status !== 'ACTIVE'
      || room.reconciliationStatus !== 'FINALIZED' || !isOnline || isMarkingPayment
      || pendingBillOverride.current || isApplyingBillOverride) return;
    let command = pendingPayment.current;
    if (!command) {
      if (!memberUid || !publicationRequestId || expectedRevision == null) return;
      command = {
        version: 1,
        requestId: Crypto.randomUUID(),
        roomId: room.roomId,
        memberUid,
        targetStatus: 'MARKED_AS_PAID',
        publicationRequestId,
        expectedRevision,
      };
      pendingPayment.current = command;
    } else if (command.roomId !== room.roomId || (memberUid && command.memberUid !== memberUid)) return;
    const pending = command;
    setIsMarkingPayment(true);
    setPaymentError(undefined);
    try {
      await paymentRepository.markPaid(pending, isOnline);
      if (activeBillRoomId.current === pending.roomId && pendingPayment.current?.requestId === pending.requestId) {
        setListenerRevision(revision => revision + 1);
      }
    } catch (error) {
      if (activeBillRoomId.current !== pending.roomId || pendingPayment.current?.requestId !== pending.requestId) return;
      const code = error instanceof PaymentStatusError ? error.code : 'unavailable';
      setPaymentError(code === 'unavailable' ? 'Could not confirm the result. Reconnect and retry the saved request.'
        : code === 'failed-precondition' || code === 'already-exists' ? 'The bill or payment status changed. Refresh and review it before confirming again.'
          : code === 'permission-denied' ? 'Payment confirmation was denied. Check the Host role and deployed Firestore Rules.'
            : 'The payment could not be confirmed. Refresh the bill and try again.');
      if (code !== 'unavailable') {
        pendingPayment.current = null;
        setListenerRevision(revision => revision + 1);
      }
    } finally {
      if (activeBillRoomId.current === pending.roomId) setIsMarkingPayment(false);
    }
  };

  return {
    committedBill, pendingPayment, pendingBillCommand, pendingBillOverride,
    activeBillRoomId, latestBillRevision,
    isPublishingBill, billPublishError, isMarkingPayment, paymentError,
    isApplyingBillOverride, billOverrideError,
    handlePublishBill, handleRetryPublishedBill, handleApplyBillOverrides, handleMarkPayment,
  };
}
