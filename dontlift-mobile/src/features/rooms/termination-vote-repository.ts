import {
  doc, getDocFromServer, runTransaction, serverTimestamp, Timestamp, type Firestore,
} from 'firebase/firestore';

export type TerminationChoice = 'YES' | 'NO';
export type TerminationVote = {
  version: 1;
  roomId: string;
  voteId: string;
  openedAtUtcMs: number | null;
  eligibleVoterCount: number;
  yesVoteCount: number;
  status: 'OPEN' | 'CANCELLED';
};
export type TerminationBallot = { voteId: string; requestId: string; choice: TerminationChoice };
export type TerminationVoteErrorCode =
  | 'unauthenticated' | 'invalid-argument' | 'not-found' | 'failed-precondition'
  | 'permission-denied' | 'unavailable' | 'already-exists';

export class TerminationVoteError extends Error {
  constructor(readonly code: TerminationVoteErrorCode, readonly firebaseCode?: string) {
    super(code);
    this.name = 'TerminationVoteError';
  }
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEADLINE_MS = 30_000;

function mapError(error: unknown): never {
  if (error instanceof TerminationVoteError) throw error;
  const firebaseCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code) : undefined;
  const code = firebaseCode?.replace(/^firestore\//, '').replace(/^auth\//, '');
  const mapped: TerminationVoteErrorCode = code === 'unauthenticated' ? 'unauthenticated'
    : code === 'invalid-argument' ? 'invalid-argument'
      : code === 'not-found' ? 'not-found'
        : code === 'failed-precondition' ? 'failed-precondition'
          : code === 'permission-denied' ? 'permission-denied'
            : code === 'already-exists' ? 'already-exists' : 'unavailable';
  throw new TerminationVoteError(mapped, firebaseCode);
}

function toVote(roomId: string, data: Record<string, unknown>): TerminationVote {
  return {
    version: 1,
    roomId,
    voteId: String(data.voteId ?? ''),
    openedAtUtcMs: data.openedAt instanceof Timestamp ? data.openedAt.toMillis() : null,
    eligibleVoterCount: Number(data.eligibleVoterCount ?? 0),
    yesVoteCount: Number(data.yesVoteCount ?? 0),
    status: data.status === 'CANCELLED' ? 'CANCELLED' : 'OPEN',
  };
}

export function createTerminationVoteRepository(dependencies: {
  firestore: Firestore;
  auth: { currentUser: { uid: string } | null };
}) {
  const voteRef = (roomId: string) => doc(dependencies.firestore, 'rooms', roomId, 'terminationVotes', 'current');
  const ballotRef = (roomId: string, uid: string) => doc(
    dependencies.firestore, 'rooms', roomId, 'terminationVotes', 'current', 'ballots', uid,
  );

  return {
    async readCurrent(roomId: string): Promise<TerminationVote | null> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new TerminationVoteError('unauthenticated');
      if (!UUID_V4.test(roomId)) throw new TerminationVoteError('invalid-argument');
      try {
        const snapshot = await getDocFromServer(voteRef(roomId));
        return snapshot.exists() ? toVote(roomId, snapshot.data()) : null;
      } catch (error) { return mapError(error); }
    },

    async open(input: { roomId: string; requestId: string }): Promise<TerminationVote> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new TerminationVoteError('unauthenticated');
      if (!UUID_V4.test(input.roomId) || !UUID_V4.test(input.requestId)) throw new TerminationVoteError('invalid-argument');
      const roomRef = doc(dependencies.firestore, 'rooms', input.roomId);
      const memberRef = doc(dependencies.firestore, 'rooms', input.roomId, 'members', actor.uid);
      const currentVoteRef = voteRef(input.roomId);
      try {
        // Transaction yêu cầu mạng; Rules mới quyết định vote hiện tại đã hết hạn hay chưa.
        const result = await runTransaction(dependencies.firestore, async transaction => {
          const [room, member, current] = await Promise.all([
            transaction.get(roomRef), transaction.get(memberRef), transaction.get(currentVoteRef),
          ]);
          if (!room.exists() || !member.exists()) throw new TerminationVoteError('not-found');
          const roomData = room.data();
          const memberData = member.data();
          if (roomData.status !== 'ACTIVE' || memberData.status !== 'ACTIVE'
            || !Number.isInteger(roomData.activeMemberCount) || roomData.activeMemberCount < 1) {
            throw new TerminationVoteError('failed-precondition');
          }
          if (current.exists()) {
            const existing = current.data();
            const openedAt = existing.openedAt;
            if (existing.status === 'OPEN' && openedAt instanceof Timestamp
              && (Date.now() < openedAt.toMillis() + DEADLINE_MS || existing.requestId === input.requestId)) {
              return toVote(input.roomId, existing);
            }
          }
          const newVote = {
            version: 1, voteId: input.requestId, requestId: input.requestId, openedByUid: actor.uid,
            openedAt: serverTimestamp(), eligibleVoterCount: roomData.activeMemberCount,
            yesVoteCount: 0, status: 'OPEN',
          };
          transaction.set(currentVoteRef, newVote);
          return { ...toVote(input.roomId, newVote), voteId: input.requestId, openedAtUtcMs: null };
        });
        if (result.openedAtUtcMs !== null) return result;
        // Server timestamp được xác nhận sau commit; nếu chưa đọc được, listener sẽ bổ sung.
        try {
          const committed = await getDocFromServer(currentVoteRef);
          if (committed.exists()) return toVote(input.roomId, committed.data());
        } catch { /* Phép đọc lại không đảo ngược giao dịch đã commit. */ }
        return result;
      } catch (error) { return mapError(error); }
    },

    async cast(input: {
      roomId: string; voteId: string; requestId: string; choice: TerminationChoice;
    }): Promise<{ vote: TerminationVote; replayed: boolean }> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new TerminationVoteError('unauthenticated');
      if (!UUID_V4.test(input.roomId) || !UUID_V4.test(input.voteId) || !UUID_V4.test(input.requestId)
        || !['YES', 'NO'].includes(input.choice)) throw new TerminationVoteError('invalid-argument');
      const roomRef = doc(dependencies.firestore, 'rooms', input.roomId);
      const memberRef = doc(dependencies.firestore, 'rooms', input.roomId, 'members', actor.uid);
      const currentVoteRef = voteRef(input.roomId);
      const ownBallotRef = ballotRef(input.roomId, actor.uid);
      try {
        const result = await runTransaction(dependencies.firestore, async transaction => {
          const [room, member, vote, ballot] = await Promise.all([
            transaction.get(roomRef), transaction.get(memberRef), transaction.get(currentVoteRef),
            transaction.get(ownBallotRef),
          ]);
          if (!room.exists() || !member.exists() || !vote.exists()) throw new TerminationVoteError('not-found');
          const savedVote = vote.data();
          if (savedVote.voteId !== input.voteId) throw new TerminationVoteError('failed-precondition');
          if (ballot.exists() && ballot.data().voteId === input.voteId) {
            const saved = ballot.data();
            if (saved.requestId === input.requestId && saved.choice === input.choice) {
              return { vote: toVote(input.roomId, savedVote), replayed: true };
            }
            throw new TerminationVoteError('failed-precondition');
          }
          if (room.data().status !== 'ACTIVE' || member.data().status !== 'ACTIVE'
            || savedVote.status !== 'OPEN' || !(savedVote.openedAt instanceof Timestamp)
            || Date.now() >= savedVote.openedAt.toMillis() + DEADLINE_MS) {
            throw new TerminationVoteError('failed-precondition');
          }
          const yesVoteCount = Number(savedVote.yesVoteCount) + (input.choice === 'YES' ? 1 : 0);
          const eligibleVoterCount = Number(savedVote.eligibleVoterCount);
          // Chỉ ballot YES cuối cùng được phép đóng room; Rules xác nhận cùng lúc cả ba ghi.
          const unanimous = input.choice === 'YES' && yesVoteCount === eligibleVoterCount;
          transaction.set(ownBallotRef, {
            version: 1, voteId: input.voteId, requestId: input.requestId, choice: input.choice,
            castAt: serverTimestamp(),
          });
          transaction.update(currentVoteRef, {
            yesVoteCount,
            ...(unanimous ? { status: 'CANCELLED', closedAt: serverTimestamp() } : {}),
          });
          if (unanimous) transaction.update(roomRef, {
            status: 'CANCELLED', endedAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
          return { vote: { ...toVote(input.roomId, savedVote), yesVoteCount, status: unanimous ? 'CANCELLED' as const : 'OPEN' as const }, replayed: false };
        });
        return result;
      } catch (error) { return mapError(error); }
    },
  };
}
