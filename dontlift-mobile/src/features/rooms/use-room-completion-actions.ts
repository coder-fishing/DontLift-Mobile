import { useRef, useState, type MutableRefObject } from 'react';
import * as Crypto from 'expo-crypto';
import { createGroupCaptureWorkTracker } from './group-capture-work';
import type { createGroupViolationRepository } from './group-violation-repository';
import { createRoomCompletionRepository, RoomCompletionError } from './room-completion-repository';
import type { RoomLobbySnapshot } from './room-listener';

type RoomCompletionRepository = ReturnType<typeof createRoomCompletionRepository>;
type GroupViolationRepository = ReturnType<typeof createGroupViolationRepository>;
type GroupCaptureWorkTracker = ReturnType<typeof createGroupCaptureWorkTracker>;

type RoomCompletionActionsOptions = {
  repository: RoomCompletionRepository;
  violationRepository: GroupViolationRepository;
  roomId: string | undefined;
  snapshot: RoomLobbySnapshot | null | undefined;
  uid: string;
  captureWork: MutableRefObject<Map<string, GroupCaptureWorkTracker>>;
  reconcileLifecycleAtCutoff: (roomId: string, userId: string, cutoffUtcMs: number) => Promise<unknown>;
  runEarlyExitCutoffCleanup: (input: {
    roomId: string;
    userId: string;
    cutoffUtcMs: number;
    startedAtUtcMs: number;
    historySnapshot: RoomLobbySnapshot;
  }) => Promise<void>;
  onCompleted: () => void;
};

/** Điều phối Host kết thúc/chốt điểm và thành viên đồng bộ rồi xác nhận dữ liệu phòng. */
export function useRoomCompletionActions({
  repository,
  violationRepository,
  roomId,
  snapshot,
  uid,
  captureWork,
  reconcileLifecycleAtCutoff,
  runEarlyExitCutoffCleanup,
  onCompleted,
}: RoomCompletionActionsOptions) {
  const [isCompletingRoom, setIsCompletingRoom] = useState(false);
  const [roomCompletionError, setRoomCompletionError] = useState<string>();
  const [isFinalizingRoomOverride, setIsFinalizingRoomOverride] = useState(false);
  const [roomOverrideError, setRoomOverrideError] = useState<string>();
  const [isAcknowledgingRoom, setIsAcknowledgingRoom] = useState(false);
  const [roomAcknowledgmentError, setRoomAcknowledgmentError] = useState<string>();
  const pendingCompletion = useRef<{ roomId: string; requestId: string } | null>(null);
  const pendingOverride = useRef<{ roomId: string; requestId: string } | null>(null);
  const pendingAcknowledgment = useRef<{ roomId: string; requestId: string } | null>(null);

  const handleCompleteRoom = async () => {
    if (!roomId || isCompletingRoom) return;
    setIsCompletingRoom(true);
    setRoomCompletionError(undefined);
    const pending = pendingCompletion.current?.roomId === roomId
      ? pendingCompletion.current
      : { roomId, requestId: Crypto.randomUUID() };
    pendingCompletion.current = pending;
    try {
      await repository.completeRoom(pending);
      pendingCompletion.current = null;
      onCompleted();
    } catch (error) {
      if (!(error instanceof RoomCompletionError) || error.code !== 'unavailable') pendingCompletion.current = null;
      if (__DEV__ && error instanceof RoomCompletionError) {
        console.warn('[room-complete] failed', JSON.stringify({ code: error.code }));
      }
      setRoomCompletionError(error instanceof RoomCompletionError && error.code === 'permission-denied'
        ? 'Firebase rejected room completion. Check the deployed Firestore Rules and Host membership.'
        : error instanceof RoomCompletionError && error.code === 'failed-precondition'
          ? 'This room is no longer active. Refresh the room state and try again.'
          : 'Could not end the room. Reconnect and retry; the request was not queued offline.');
    } finally {
      setIsCompletingRoom(false);
    }
  };

  const handleFinalizeRoomOverride = async (unsyncedMemberUids: string[]) => {
    const ownMember = snapshot?.members.find(member => member.uid === uid);
    if (!roomId || !snapshot || snapshot.status !== 'COMPLETED' || ownMember?.role !== 'HOST'
      || isFinalizingRoomOverride) return;
    setIsFinalizingRoomOverride(true);
    setRoomOverrideError(undefined);
    const pending = pendingOverride.current?.roomId === roomId
      ? pendingOverride.current
      : { roomId, requestId: Crypto.randomUUID() };
    pendingOverride.current = pending;
    try {
      await repository.finalizeRoomScores({
        ...pending,
        reason: 'HOST_OVERRIDE',
        confirmedWarning: true,
        unsyncedMemberUids,
      });
      pendingOverride.current = null;
      // Persist violation history that was pending locally after the server locks scores.
      void violationRepository.syncPending(roomId).catch(() => undefined);
    } catch (error) {
      if (!(error instanceof RoomCompletionError) || error.code !== 'unavailable') pendingOverride.current = null;
      if (__DEV__ && error instanceof RoomCompletionError) {
        console.warn('[room-override] failed', JSON.stringify({ code: error.code }));
      }
      setRoomOverrideError(error instanceof RoomCompletionError && error.code === 'permission-denied'
        ? 'Firebase rejected finalization. Check that the Spark Firestore Rules are deployed.'
        : error instanceof RoomCompletionError && error.code === 'failed-precondition'
          ? 'The room state changed. Wait for the latest room snapshot and retry if members are still pending.'
          : error instanceof RoomCompletionError && error.code === 'unavailable'
            ? 'Could not confirm the request with Firebase. Reconnect and retry; the same request will be reused.'
            : 'Could not finalize the room. Your scores have not been changed by this attempt.');
    } finally {
      setIsFinalizingRoomOverride(false);
    }
  };

  const handleAcknowledgeRoomSync = async () => {
    if (!roomId || !snapshot || snapshot.status !== 'COMPLETED' || isAcknowledgingRoom) return;
    setIsAcknowledgingRoom(true);
    setRoomAcknowledgmentError(undefined);
    const pending = pendingAcknowledgment.current?.roomId === roomId
      ? pendingAcknowledgment.current
      : { roomId, requestId: Crypto.randomUUID() };
    pendingAcknowledgment.current = pending;
    try {
      await captureWork.current.get(roomId)?.waitForIdle();
      if (snapshot.endedAtUtcMs == null) throw new RoomCompletionError('failed-precondition');
      const ownMember = snapshot.members.find(member => member.uid === uid);
      const lifecycleCutoffUtcMs = ownMember?.status === 'EARLY_EXIT' && ownMember.earlyExitAtUtcMs != null
        ? Math.min(snapshot.endedAtUtcMs, ownMember.earlyExitAtUtcMs)
        : snapshot.endedAtUtcMs;
      await reconcileLifecycleAtCutoff(roomId, uid, lifecycleCutoffUtcMs);
      if (snapshot.startedAtUtcMs != null && ownMember?.status === 'EARLY_EXIT' && ownMember.earlyExitAtUtcMs != null) {
        await runEarlyExitCutoffCleanup({
          roomId,
          userId: uid,
          cutoffUtcMs: ownMember.earlyExitAtUtcMs,
          startedAtUtcMs: snapshot.startedAtUtcMs,
          historySnapshot: snapshot,
        });
      }
      await violationRepository.finalizeOpenAtRoomEnd({ roomId, userId: uid, endedAtUtcMs: snapshot.endedAtUtcMs });
      await violationRepository.syncPending(roomId);
      if (await violationRepository.getPendingCount(roomId) > 0) throw new RoomCompletionError('failed-precondition');
      await repository.acknowledgeMemberSync(pending);
      pendingAcknowledgment.current = null;
    } catch (error) {
      if (!(error instanceof RoomCompletionError) || error.code !== 'unavailable') pendingAcknowledgment.current = null;
      if (__DEV__ && error instanceof RoomCompletionError) {
        console.warn('[room-ack] failed', JSON.stringify({ code: error.code }));
      }
      setRoomAcknowledgmentError(error instanceof RoomCompletionError && error.code === 'failed-precondition'
        ? 'Some saved session data is still waiting to sync. Reconnect and retry.'
        : error instanceof RoomCompletionError && error.code === 'permission-denied'
          ? 'Firebase rejected the sync acknowledgment. Check the deployed Firestore Rules.'
          : 'Could not confirm the final sync. Reconnect and retry.');
    } finally {
      setIsAcknowledgingRoom(false);
    }
  };

  return {
    isCompletingRoom, roomCompletionError, isFinalizingRoomOverride, roomOverrideError,
    isAcknowledgingRoom, roomAcknowledgmentError,
    handleCompleteRoom, handleFinalizeRoomOverride, handleAcknowledgeRoomSync,
  };
}
