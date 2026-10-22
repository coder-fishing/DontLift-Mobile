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
      const receiptRef = (requestId: string) => doc(dependencies.firestore, 'rooms', command.roomId, 'billCommands', requestId);
      const preparationRef = doc(dependencies.firestore, 'rooms', command.roomId, 'billPreparations', 'current');
      const memberRef = (uid: string) => doc(dependencies.firestore, 'rooms', command.roomId, 'members', uid);
      const shareRef = (uid: string) => doc(dependencies.firestore, 'rooms', command.roomId, 'billShares', uid);

      const readCommittedBill = async (requestId: string, expectedTotal: number): Promise<PublishedBill> => {
        const receipt = await getDocFromServer(receiptRef(requestId));
        if (!receipt.exists()) throw new BillRepositoryError('failed-precondition');
        const saved = receipt.data();
        if (saved.requestId !== requestId || saved.hostUid !== actor.uid || saved.roomId !== command.roomId
          || saved.totalBillVnd !== expectedTotal || saved.calculationVersion !== 1
          || !Array.isArray(saved.shareUids) || saved.shareUids.length !== saved.shareCount
          || new Set(saved.shareUids).size !== saved.shareCount
          || saved.shareUids.some((uid: unknown) => typeof uid !== 'string')) {
          throw new BillRepositoryError('failed-precondition');
        }
        const snapshot = await getDocsFromServer(collection(dependencies.firestore, 'rooms', command.roomId, 'billShares'));
        if (snapshot.size !== saved.shareCount
          || snapshot.docs.some(item => item.data().requestId !== requestId || item.data().uid !== item.id)
          || snapshot.docs.some(item => !saved.shareUids.includes(item.id))
          || saved.shareUids.some((uid: string) => !snapshot.docs.some(item => item.id === uid))) {
          throw new BillRepositoryError('failed-precondition');
        }
        const savedShares = parseShares(snapshot.docs.map(item => item.data()));
        if (savedShares.length !== saved.shareCount) throw new BillRepositoryError('failed-precondition');
        return makeResult(command.roomId, requestId, expectedTotal, savedShares);
      };

      try {
        // Bỏ qua lần đọc roster khi replay đã publish để tiết kiệm read quota của Spark.
        const frozenMembers: BillAllocationMember[] = [];
        const currentRoom = await getDocFromServer(roomRef);
        if (!currentRoom.exists()) throw new BillRepositoryError('not-found');
        if (currentRoom.data().calculationVersion !== 1) {
          // Room FINALIZED khóa điểm; đọc riêng từng member tránh transaction Rules access-call budget khi roster lớn.
          for (let offset = 0; offset < rosterMemberUids.length; offset += 8) {
            const uidBatch = rosterMemberUids.slice(offset, offset + 8);
            const memberSnapshots = await Promise.all(uidBatch.map(uid => getDocFromServer(memberRef(uid))));
            for (let index = 0; index < memberSnapshots.length; index += 1) {
              const member = memberSnapshots[index];
              if (!member.exists() || !['ACTIVE', 'EARLY_EXIT'].includes(member.data().status)) {
                throw new BillRepositoryError('failed-precondition');
              }
              frozenMembers.push({ uid: uidBatch[index], penaltyScore: member.data().penaltyScore });
            }
          }
        }

        const prepared = await runTransaction(dependencies.firestore, async transaction => {
          const [roomSnapshot, hostSnapshot, detailSnapshot, preparationSnapshot] = await Promise.all([
            transaction.get(roomRef), transaction.get(hostRef), transaction.get(detailRef), transaction.get(preparationRef),
          ]);
          if (!roomSnapshot.exists()) throw new BillRepositoryError('not-found');
          if (!hostSnapshot.exists() || roomSnapshot.data().hostId !== actor.uid
            || hostSnapshot.data().role !== 'HOST' || hostSnapshot.data().status !== 'ACTIVE') {
            throw new BillRepositoryError('permission-denied');
          }

          const room = roomSnapshot.data();
          if (room.calculationVersion === 1) {
            if (room.billRequestId !== command.requestId || room.totalBillVnd !== command.totalBillVnd) {
              throw new BillRepositoryError('already-exists');
            }
            return { kind: 'published' as const, requestId: command.requestId };
          }

          if (room.status !== 'COMPLETED' || room.reconciliationStatus !== 'FINALIZED'
            || !(room.endedAt instanceof Timestamp) || !detailSnapshot.exists()
            || !(detailSnapshot.data().expiresAt instanceof Timestamp)) {
            throw new BillRepositoryError('failed-precondition');
          }
          if (!Number.isSafeInteger(room.participantCount) || rosterMemberUids.length !== room.participantCount) {
            throw new BillRepositoryError('failed-precondition');
          }

          const members = frozenMembers;
          if (!members.some(member => member.uid === actor.uid)) throw new BillRepositoryError('permission-denied');
          const allocation = calculateDefaultBillShares(command.totalBillVnd, members);
          const result = makeResult(command.roomId, command.requestId, command.totalBillVnd, allocation.shares);
          const sortedUids = result.shares.map(share => share.uid).sort((a, b) => a.localeCompare(b));
          const expectedUids = [...rosterMemberUids].sort((a, b) => a.localeCompare(b));
          if (sortedUids.length !== expectedUids.length || sortedUids.some((uid, index) => uid !== expectedUids[index])) {
            throw new BillRepositoryError('failed-precondition');
          }

          if (preparationSnapshot.exists()) {
            const preparation = preparationSnapshot.data();
            if (preparation.status !== 'PREPARING' || preparation.hostUid !== actor.uid
              || preparation.requestId !== room.billRequestId || preparation.totalBillVnd !== command.totalBillVnd
              || preparation.roomId !== command.roomId || preparation.shareCount !== result.shares.length
              || preparation.sumShareVnd !== result.sumShareVnd || !Array.isArray(preparation.shareUids)
              || preparation.shareUids.length !== sortedUids.length
              || preparation.shareUids.some((uid: unknown, index: number) => uid !== sortedUids[index])) {
              throw new BillRepositoryError('failed-precondition');
            }
            return {
              kind: 'preparing' as const,
              requestId: preparation.requestId,
              result: makeResult(command.roomId, preparation.requestId, command.totalBillVnd, allocation.shares),
            };
          }

          if (room.calculationVersion != null || room.billRequestId != null || room.totalBillVnd != null
            || room.billShareCount != null) throw new BillRepositoryError('failed-precondition');
          transaction.update(roomRef, {
            totalBillVnd: command.totalBillVnd,
            billRequestId: command.requestId,
            billShareCount: result.shares.length,
            billPreparationStartedAt: serverTimestamp(),
          });
          transaction.set(preparationRef, {
            version: 1,
            requestId: command.requestId,
            roomId: command.roomId,
            hostUid: actor.uid,
            totalBillVnd: command.totalBillVnd,
            calculationVersion: 1,
            shareCount: result.shares.length,
            shareUids: sortedUids,
            sumShareVnd: result.sumShareVnd,
            status: 'PREPARING',
            createdAt: serverTimestamp(),
          });
          return { kind: 'preparing' as const, requestId: command.requestId, result };
        });

        if (prepared.kind === 'published') return readCommittedBill(prepared.requestId, command.totalBillVnd);
        const requestId = prepared.requestId;

        for (let offset = 0; offset < prepared.result.shares.length; offset += 8) {
          const chunk = prepared.result.shares.slice(offset, offset + 8);
          await runTransaction(dependencies.firestore, async transaction => {
            const [roomSnapshot, hostSnapshot, detailSnapshot, preparationSnapshot, savedSnapshots] = await Promise.all([
              transaction.get(roomRef),
              transaction.get(hostRef),
              transaction.get(detailRef),
              transaction.get(preparationRef),
              Promise.all(chunk.map(share => transaction.get(shareRef(share.uid)))),
            ]);
            if (!roomSnapshot.exists() || !preparationSnapshot.exists() || !hostSnapshot.exists()
              || !detailSnapshot.exists()) throw new BillRepositoryError('failed-precondition');
            const room = roomSnapshot.data();
            const preparation = preparationSnapshot.data();
            if (room.status !== 'COMPLETED' || room.reconciliationStatus !== 'FINALIZED'
              || room.hostId !== actor.uid || room.billRequestId !== requestId
              || room.calculationVersion != null || preparation.status !== 'PREPARING'
              || preparation.requestId !== requestId || preparation.hostUid !== actor.uid
              || hostSnapshot.data().role !== 'HOST' || hostSnapshot.data().status !== 'ACTIVE'
              || !(detailSnapshot.data().expiresAt instanceof Timestamp)) {
              throw new BillRepositoryError('failed-precondition');
            }
            for (let index = 0; index < chunk.length; index += 1) {
              const share = chunk[index];
              const savedShare = savedSnapshots[index];
              if (savedShare.exists()) {
                const saved = savedShare.data();
                if (saved.uid !== share.uid || saved.shareVnd !== share.shareVnd || saved.requestId !== requestId) {
                  throw new BillRepositoryError('failed-precondition');
                }
              } else {
                transaction.set(shareRef(share.uid), {
                  uid: share.uid,
                  shareVnd: share.shareVnd,
                  requestId,
                  updatedAt: serverTimestamp(),
                });
              }
            }
          });
        }

        const finalized = await runTransaction(dependencies.firestore, async transaction => {
          const [roomSnapshot, hostSnapshot, detailSnapshot, preparationSnapshot, receiptSnapshot] = await Promise.all([
            transaction.get(roomRef), transaction.get(hostRef), transaction.get(detailRef),
              transaction.get(preparationRef), transaction.get(receiptRef(requestId)),
          ]);
          if (!roomSnapshot.exists() || !hostSnapshot.exists() || !detailSnapshot.exists()
            || !preparationSnapshot.exists()) throw new BillRepositoryError('failed-precondition');
          const room = roomSnapshot.data();
          const preparation = preparationSnapshot.data();
          if (room.calculationVersion === 1) {
            if (room.billRequestId !== requestId || receiptSnapshot.id !== requestId) {
              throw new BillRepositoryError('already-exists');
            }
            return { kind: 'published' as const, requestId };
          }
          if (room.status !== 'COMPLETED' || room.reconciliationStatus !== 'FINALIZED'
            || room.hostId !== actor.uid || room.billRequestId !== requestId
            || room.totalBillVnd !== command.totalBillVnd || room.billShareCount !== prepared.result.shares.length
            || room.calculationVersion != null || preparation.status !== 'PREPARING'
            || preparation.requestId !== requestId || preparation.hostUid !== actor.uid
            || hostSnapshot.data().role !== 'HOST' || hostSnapshot.data().status !== 'ACTIVE'
            || !(detailSnapshot.data().expiresAt instanceof Timestamp)) {
            throw new BillRepositoryError('failed-precondition');
          }
          if (receiptSnapshot.exists()) throw new BillRepositoryError('already-exists');
          transaction.update(roomRef, {
            calculationVersion: 1,
            billPublishedAt: serverTimestamp(),
          });
          transaction.update(preparationRef, {
            status: 'PUBLISHED',
            publishedAt: serverTimestamp(),
          });
          transaction.set(receiptRef(requestId), {
            version: 1,
            requestId,
            roomId: command.roomId,
            hostUid: actor.uid,
            totalBillVnd: command.totalBillVnd,
            calculationVersion: 1,
            shareCount: prepared.result.shares.length,
            shareUids: prepared.result.shares.map(share => share.uid).sort((a, b) => a.localeCompare(b)),
            sumShareVnd: prepared.result.sumShareVnd,
            createdAt: serverTimestamp(),
          });
          return { kind: 'result' as const, result: prepared.result };
        });
        return finalized.kind === 'published'
          ? readCommittedBill(finalized.requestId, command.totalBillVnd)
          : finalized.result;
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
