import type { Auth } from 'firebase/auth';
import {
  doc, getDocFromServer, runTransaction, serverTimestamp, Timestamp, type Firestore,
} from 'firebase/firestore';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EarlyExitDecision = 'APPROVE' | 'DENY';
export type EarlyExitStatus = 'OPEN' | 'APPROVED' | 'DENIED';
export type EarlyExitRequest = {
  requestId: string;
  memberUid: string;
  status: EarlyExitStatus;
  decision: EarlyExitDecision | null;
  requestedAtUtcMs: number | null;
  decidedAtUtcMs: number | null;
  cutoffUtcMs: number | null;
};

type Dependencies = { firestore: Firestore; auth: Auth; createId?: () => string };
type Result = EarlyExitRequest & { version: 1; roomId: string };

export class EarlyExitError extends Error {
  constructor(public readonly code: 'unauthenticated' | 'invalid-argument' | 'not-found' | 'failed-precondition' | 'permission-denied' | 'unavailable' | 'already-exists' | 'unknown') {
    super(code);
    this.name = 'EarlyExitError';
  }
}

function mapError(error: unknown): EarlyExitError {
  if (error instanceof EarlyExitError) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code).replace(/^firestore\//, '') : '';
  if (code === 'unauthenticated') return new EarlyExitError('unauthenticated');
  if (code === 'invalid-argument') return new EarlyExitError('invalid-argument');
  if (code === 'not-found') return new EarlyExitError('not-found');
  if (code === 'failed-precondition') return new EarlyExitError('failed-precondition');
  if (code === 'permission-denied') return new EarlyExitError('permission-denied');
  if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) return new EarlyExitError('unavailable');
  if (code === 'already-exists') return new EarlyExitError('already-exists');
  return new EarlyExitError('unknown');
}

function timestampMs(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

function toResult(roomId: string, memberUid: string, data: Record<string, unknown>): Result {
  return {
    version: 1,
    roomId,
    requestId: String(data.requestId ?? ''),
    memberUid,
    status: data.status as EarlyExitStatus,
    decision: data.decision === 'APPROVE' || data.decision === 'DENY' ? data.decision : null,
    requestedAtUtcMs: timestampMs(data.requestedAt),
    decidedAtUtcMs: timestampMs(data.decidedAt),
    cutoffUtcMs: timestampMs(data.cutoffAt),
  };
}

async function readCommittedResult(
  firestore: Firestore,
  roomId: string,
  memberUid: string,
  expectedRequestId: string,
): Promise<Result | null> {
  try {
    const snapshot = await getDocFromServer(doc(firestore, 'rooms', roomId, 'earlyExitRequests', memberUid));
    if (!snapshot.exists() || snapshot.data().requestId !== expectedRequestId) return null;
    return toResult(roomId, memberUid, snapshot.data());
  } catch {
    // Giao dịch đã commit; thiếu readback chỉ làm timestamp tạm chưa biết, không biến thành thất bại.
    return null;
  }
}

export function createEarlyExitRepository(dependencies: Dependencies) {
  return {
    async requestEarlyExit(input: { roomId: string; requestId?: string }): Promise<Result> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new EarlyExitError('unauthenticated');
      const requestId = input.requestId ?? dependencies.createId?.();
      if (!requestId || !UUID_V4.test(requestId) || !UUID_V4.test(input.roomId)) throw new EarlyExitError('invalid-argument');

      const roomRef = doc(dependencies.firestore, 'rooms', input.roomId);
      const memberRef = doc(dependencies.firestore, 'rooms', input.roomId, 'members', actor.uid);
      const requestRef = doc(dependencies.firestore, 'rooms', input.roomId, 'earlyExitRequests', actor.uid);
      try {
        const transactionResult = await runTransaction(dependencies.firestore, async transaction => {
          const [room, member, request] = await Promise.all([
            transaction.get(roomRef), transaction.get(memberRef), transaction.get(requestRef),
          ]);
          if (!room.exists()) throw new EarlyExitError('not-found');
          if (!member.exists()) throw new EarlyExitError('failed-precondition');
          if (request.exists()) {
            const saved = request.data();
            if (saved.requestId === requestId) return toResult(input.roomId, actor.uid, saved);
            if (saved.status === 'OPEN') throw new EarlyExitError('failed-precondition');
          }
          if (room.data().status !== 'ACTIVE' || member.data().status !== 'ACTIVE'
            || member.data().earlyExitAt != null) throw new EarlyExitError('failed-precondition');

          // Một document theo UID giới hạn mỗi Member chỉ có một yêu cầu OPEN tại một thời điểm.
          transaction.set(requestRef, {
            version: 1,
            requestId,
            memberUid: actor.uid,
            status: 'OPEN',
            requestedAt: serverTimestamp(),
            decision: null,
            decidedBy: null,
            decidedAt: null,
            cutoffAt: null,
          });
          return {
            version: 1, roomId: input.roomId, requestId, memberUid: actor.uid,
            status: 'OPEN', decision: null, requestedAtUtcMs: null, decidedAtUtcMs: null, cutoffUtcMs: null,
          } satisfies Result;
        });
        return (await readCommittedResult(dependencies.firestore, input.roomId, actor.uid, requestId)) ?? transactionResult;
      } catch (error) {
        throw mapError(error);
      }
    },

    async decideEarlyExit(input: { roomId: string; memberUid: string; requestId: string; decision: EarlyExitDecision }): Promise<Result> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new EarlyExitError('unauthenticated');
      if (!UUID_V4.test(input.roomId) || !UUID_V4.test(input.requestId) || !input.memberUid
        || !['APPROVE', 'DENY'].includes(input.decision)) throw new EarlyExitError('invalid-argument');

      const roomRef = doc(dependencies.firestore, 'rooms', input.roomId);
      const hostRef = doc(dependencies.firestore, 'rooms', input.roomId, 'members', actor.uid);
      const memberRef = doc(dependencies.firestore, 'rooms', input.roomId, 'members', input.memberUid);
      const requestRef = doc(dependencies.firestore, 'rooms', input.roomId, 'earlyExitRequests', input.memberUid);
      try {
        const transactionResult = await runTransaction(dependencies.firestore, async transaction => {
          const [room, host, member, request] = await Promise.all([
            transaction.get(roomRef), transaction.get(hostRef), transaction.get(memberRef), transaction.get(requestRef),
          ]);
          if (!room.exists() || !host.exists() || !request.exists()) throw new EarlyExitError('not-found');
          if (room.data().hostId !== actor.uid || host.data().role !== 'HOST') {
            throw new EarlyExitError('permission-denied');
          }

          const saved = request.data();
          if (saved.requestId === input.requestId && saved.status !== 'OPEN') {
            if (saved.decision === input.decision) return toResult(input.roomId, input.memberUid, saved);
            throw new EarlyExitError('failed-precondition');
          }
          if (room.data().status !== 'ACTIVE' || host.data().status !== 'ACTIVE') {
            throw new EarlyExitError('permission-denied');
          }
          if (!member.exists()) throw new EarlyExitError('not-found');
          if (saved.requestId !== input.requestId || saved.status !== 'OPEN'
            || member.data().status !== 'ACTIVE' || member.data().earlyExitAt !== null) {
            throw new EarlyExitError('failed-precondition');
          }

          transaction.update(requestRef, {
            status: input.decision === 'APPROVE' ? 'APPROVED' : 'DENIED',
            decision: input.decision,
            decidedBy: actor.uid,
            decidedAt: serverTimestamp(),
            cutoffAt: input.decision === 'APPROVE' ? serverTimestamp() : null,
          });
          if (input.decision === 'APPROVE') {
            transaction.update(memberRef, { status: 'EARLY_EXIT', earlyExitAt: serverTimestamp() });
          }
          return {
            ...toResult(input.roomId, input.memberUid, saved),
            status: input.decision === 'APPROVE' ? 'APPROVED' : 'DENIED',
            decision: input.decision,
          } satisfies Result;
        });
        return (await readCommittedResult(dependencies.firestore, input.roomId, input.memberUid, input.requestId)) ?? transactionResult;
      } catch (error) {
        throw mapError(error);
      }
    },
  };
}
