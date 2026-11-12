jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...segments: string[]) => segments.slice(1).join('/')),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => ({ serverTimestamp: true })),
  Timestamp: class Timestamp { toMillis() { return 10_000; } },
}));

import { runTransaction, Timestamp } from 'firebase/firestore';
import { createTerminationVoteRepository } from '../src/features/rooms/termination-vote-repository';

const roomId = '10000000-0000-4000-8000-000000000019';
const requestId = '00000000-0000-4000-8000-000000000091';

function snapshot(data: Record<string, unknown> | null) {
  return { exists: () => data !== null, data: () => data ?? {} };
}

function transactionFor(input: {
  room?: Record<string, unknown>;
  vote?: Record<string, unknown>;
  ballot?: Record<string, unknown> | null;
}) {
  const records = new Map<string, Record<string, unknown> | null>([
    [`rooms/${roomId}`, input.room ?? { status: 'ACTIVE', participantCount: 2, activeMemberCount: 2 }],
    [`rooms/${roomId}/members/host-user`, { status: 'ACTIVE', role: 'HOST' }],
    [`rooms/${roomId}/terminationVotes/current`, input.vote ?? {
      voteId: requestId, openedAt: new Timestamp(0, 0), status: 'OPEN', eligibleVoterCount: 2, yesVoteCount: 1,
    }],
    [`rooms/${roomId}/terminationVotes/current/ballots/host-user`, input.ballot ?? null],
  ]);
  return {
    transaction: {
      get: jest.fn(async (path: string) => snapshot(records.get(path) ?? null)),
      set: jest.fn(),
      update: jest.fn(),
    },
  };
}

beforeEach(() => jest.clearAllMocks());

test('final unanimous YES completes the room and opens roster reconciliation', async () => {
  const { transaction } = transactionFor({});
  (runTransaction as jest.Mock).mockImplementation(async (_firestore, callback) => callback(transaction));
  const repository = createTerminationVoteRepository({ firestore: {} as never, auth: { currentUser: { uid: 'host-user' } } });

  const result = await repository.cast({ roomId, voteId: requestId, requestId, choice: 'YES' });

  expect(result.vote.status).toBe('CANCELLED');
  expect(transaction.update).toHaveBeenCalledWith(`rooms/${roomId}`, expect.objectContaining({
    status: 'COMPLETED', reconciliationStatus: 'PENDING', pendingMemberCount: 2,
    completionRequestId: requestId, lastSyncAckMemberUid: null, lastSyncAckRequestId: null,
    finalizedAt: null, finalizedBy: null, finalizationReason: null,
  }));
});

test('a non-final ballot leaves the room active without completion markers', async () => {
  const { transaction } = transactionFor({ vote: {
    voteId: requestId, openedAt: new Timestamp(0, 0), status: 'OPEN', eligibleVoterCount: 2, yesVoteCount: 0,
  } });
  (runTransaction as jest.Mock).mockImplementation(async (_firestore, callback) => callback(transaction));
  const repository = createTerminationVoteRepository({ firestore: {} as never, auth: { currentUser: { uid: 'host-user' } } });

  const result = await repository.cast({ roomId, voteId: requestId, requestId, choice: 'NO' });

  expect(result.vote.status).toBe('OPEN');
  expect(transaction.update).toHaveBeenCalledTimes(1);
  expect(transaction.update).not.toHaveBeenCalledWith(`rooms/${roomId}`, expect.anything());
});
