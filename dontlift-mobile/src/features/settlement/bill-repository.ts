import {
  collection, doc, getDocFromServer, getDocsFromServer, runTransaction, serverTimestamp, Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { calculateDefaultBillShares, BillAllocationError, type BillAllocationMember } from './bill-allocation';

type Dependencies = { firestore: Firestore; auth: Auth; createId?: () => string };

export type CalculateBillCommand = {
  version: 1;
  requestId: string;
  roomId: string;
  totalBillVnd: number;
};

export type BillShare = { uid: string; shareVnd: number };

export type PublishedBill = {
  version: 1;
  requestId: string;
  roomId: string;
  totalBillVnd: number;
  calculationVersion: 1;
  shares: BillShare[];
  sumShareVnd: number;
};

export type BillErrorCode = 'unauthenticated' | 'invalid-argument' | 'not-found'
  | 'permission-denied' | 'failed-precondition' | 'unavailable' | 'already-exists';

export class BillRepositoryError extends Error {
  constructor(readonly code: BillErrorCode) {
    super(code);
    this.name = 'BillRepositoryError';
  }
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapError(error: unknown): BillRepositoryError {
  if (error instanceof BillRepositoryError) return error;
  if (error instanceof BillAllocationError) return new BillRepositoryError(error.code);
  const rawCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code) : '';
  const code = rawCode.replace(/^firestore\//, '');
  if (['unauthenticated', 'invalid-argument', 'not-found', 'permission-denied', 'failed-precondition', 'already-exists'].includes(code)) {
    return new BillRepositoryError(code as BillErrorCode);
  }
  return new BillRepositoryError('unavailable');
}

function parseShares(data: readonly Record<string, unknown>[]): BillShare[] {
  const shares = data.map(item => ({
    uid: typeof item.uid === 'string' ? item.uid : '',
    shareVnd: item.shareVnd,
  }));
  if (shares.some(share => !share.uid || !Number.isSafeInteger(share.shareVnd) || Number(share.shareVnd) < 0)
    || new Set(shares.map(share => share.uid)).size !== shares.length) {
    throw new BillRepositoryError('failed-precondition');
  }
  return shares.map(share => ({ uid: share.uid, shareVnd: Number(share.shareVnd) }))
    .sort((a, b) => a.uid.localeCompare(b.uid));
}

function makeResult(roomId: string, requestId: string, totalBillVnd: number, shares: BillShare[]): PublishedBill {
  const sumShareVnd = shares.reduce((sum, share) => sum + share.shareVnd, 0);
  if (!Number.isSafeInteger(sumShareVnd) || sumShareVnd !== totalBillVnd) {
    throw new BillRepositoryError('failed-precondition');
  }
  return { version: 1, requestId, roomId, totalBillVnd, calculationVersion: 1, shares, sumShareVnd };
}

export function createBillRepository(dependencies: Dependencies) {
  return {
    async publish(command: CalculateBillCommand, rosterMemberUids: readonly string[]): Promise<PublishedBill> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new BillRepositoryError('unauthenticated');
      if (command.version !== 1 || !UUID_V4.test(command.roomId) || !UUID_V4.test(command.requestId)
        || !Number.isSafeInteger(command.totalBillVnd) || command.totalBillVnd < 1_000
        || rosterMemberUids.length === 0
        || rosterMemberUids.some(uid => typeof uid !== 'string' || uid.length === 0)
        || new Set(rosterMemberUids).size !== rosterMemberUids.length) {
        throw new BillRepositoryError('invalid-argument');
      }
      // Chừa hai write cho metadata của room và receipt trong giới hạn 500 writes/transaction.
      if (rosterMemberUids.length > 498) throw new BillRepositoryError('failed-precondition');

      const roomRef = doc(dependencies.firestore, 'rooms', command.roomId);
      const hostRef = doc(dependencies.firestore, 'rooms', command.roomId, 'members', actor.uid);
      const detailRef = doc(dependencies.firestore, 'rooms', command.roomId, 'settlementDetails', 'current');
      const receiptRef = doc(dependencies.firestore, 'rooms', command.roomId, 'billCommands', command.requestId);
      const memberRef = (uid: string) => doc(dependencies.firestore, 'rooms', command.roomId, 'members', uid);
      const shareRef = (uid: string) => doc(dependencies.firestore, 'rooms', command.roomId, 'billShares', uid);

      try {
        return await runTransaction(dependencies.firestore, async transaction => {
          // Firestore yêu cầu đọc toàn bộ snapshot và receipt trước khi ghi bất kỳ share nào.
          const [roomSnapshot, hostSnapshot, detailSnapshot, receiptSnapshot] = await Promise.all([
            transaction.get(roomRef), transaction.get(hostRef), transaction.get(detailRef), transaction.get(receiptRef),
          ]);
          if (!roomSnapshot.exists()) throw new BillRepositoryError('not-found');
          if (!hostSnapshot.exists() || roomSnapshot.data().hostId !== actor.uid
            || hostSnapshot.data().role !== 'HOST' || hostSnapshot.data().status !== 'ACTIVE') {
            throw new BillRepositoryError('permission-denied');
          }

          const room = roomSnapshot.data();
          if (receiptSnapshot.exists()) {
            const receipt = receiptSnapshot.data();
            if (receipt.requestId !== command.requestId || receipt.hostUid !== actor.uid
              || receipt.totalBillVnd !== command.totalBillVnd || receipt.calculationVersion !== 1) {
              throw new BillRepositoryError('already-exists');
            }
            if (room.calculationVersion !== 1 || room.billRequestId !== command.requestId
              || room.totalBillVnd !== command.totalBillVnd) {
              throw new BillRepositoryError('failed-precondition');
            }
            if (!Array.isArray(receipt.shareUids) || receipt.shareUids.length !== receipt.shareCount
              || receipt.shareUids.some((uid: unknown) => typeof uid !== 'string')) {
              throw new BillRepositoryError('failed-precondition');
            }
            const savedShareSnapshots = await Promise.all(receipt.shareUids.map((uid: string) => transaction.get(shareRef(uid))));
            const savedShares = parseShares(savedShareSnapshots.map(snapshot => snapshot.data() ?? {}));
            if (savedShares.length !== receipt.shareCount || savedShares.some((share, index) => !savedShareSnapshots[index].exists())) {
              throw new BillRepositoryError('failed-precondition');
            }
            return makeResult(command.roomId, command.requestId, command.totalBillVnd, savedShares);
          }

          if (room.status !== 'COMPLETED' || room.reconciliationStatus !== 'FINALIZED'
            || !(room.endedAt instanceof Timestamp) || !detailSnapshot.exists()
            || !(detailSnapshot.data().expiresAt instanceof Timestamp)) {
            throw new BillRepositoryError('failed-precondition');
          }
          if (room.calculationVersion != null || room.billRequestId != null) {
            throw new BillRepositoryError('failed-precondition');
          }
          if (!Number.isSafeInteger(room.participantCount) || rosterMemberUids.length !== room.participantCount) {
            throw new BillRepositoryError('failed-precondition');
          }

          const memberSnapshots = await Promise.all(rosterMemberUids.map(uid => transaction.get(memberRef(uid))));
          const members: BillAllocationMember[] = memberSnapshots.map((member, index) => {
            if (!member.exists() || !['ACTIVE', 'EARLY_EXIT'].includes(member.data().status)) {
              throw new BillRepositoryError('failed-precondition');
            }
            return { uid: rosterMemberUids[index], penaltyScore: member.data().penaltyScore };
          });
          if (!members.some(member => member.uid === actor.uid)) throw new BillRepositoryError('permission-denied');
          const allocation = calculateDefaultBillShares(command.totalBillVnd, members);
          const result = makeResult(command.roomId, command.requestId, command.totalBillVnd, allocation.shares);

          for (const share of result.shares) {
            transaction.set(shareRef(share.uid), {
              uid: share.uid,
              shareVnd: share.shareVnd,
              requestId: command.requestId,
              updatedAt: serverTimestamp(),
            });
          }
          transaction.update(roomRef, {
            totalBillVnd: command.totalBillVnd,
            calculationVersion: 1,
            billRequestId: command.requestId,
            billPublishedAt: serverTimestamp(),
            billShareCount: result.shares.length,
          });
          transaction.set(receiptRef, {
            version: 1,
            requestId: command.requestId,
            roomId: command.roomId,
            hostUid: actor.uid,
            totalBillVnd: command.totalBillVnd,
            calculationVersion: 1,
            shareCount: result.shares.length,
            shareUids: result.shares.map(share => share.uid),
            sumShareVnd: result.sumShareVnd,
            createdAt: serverTimestamp(),
          });
          return result;
        });
      } catch (error) { throw mapError(error); }
    },

    async readPublished(roomId: string): Promise<PublishedBill | null> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new BillRepositoryError('unauthenticated');
      if (!UUID_V4.test(roomId)) throw new BillRepositoryError('invalid-argument');
      try {
        const roomRef = doc(dependencies.firestore, 'rooms', roomId);
        const sharesRef = collection(dependencies.firestore, 'rooms', roomId, 'billShares');
        const roomSnapshot = await getDocFromServer(roomRef);
        if (!roomSnapshot.exists()) throw new BillRepositoryError('not-found');
        const room = roomSnapshot.data();
        if (room.calculationVersion !== 1 || typeof room.billRequestId !== 'string'
          || !Number.isSafeInteger(room.totalBillVnd)) return null;
        const sharesSnapshot = await getDocsFromServer(sharesRef);
        const shares = parseShares(sharesSnapshot.docs.map(item => item.data()));
        if (shares.length !== room.billShareCount) throw new BillRepositoryError('failed-precondition');
        return makeResult(roomId, room.billRequestId, room.totalBillVnd, shares);
      } catch (error) { throw mapError(error); }
    },
  };
}
