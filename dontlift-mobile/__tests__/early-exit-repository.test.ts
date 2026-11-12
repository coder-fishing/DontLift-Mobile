jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...segments: string[]) => segments.slice(1).join('/')),
  getDocFromServer: jest.fn().mockRejectedValue(new Error('readback unavailable')),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => ({ serverTimestamp: true })),
  Timestamp: class Timestamp { toMillis() { return 10_000; } },
}));

import { runTransaction, Timestamp } from 'firebase/firestore';
import { createEarlyExitRepository } from '../src/features/rooms/early-exit-repository';

const roomId = '10000000-0000-4000-8000-000000000018';
const requestId = '00000000-0000-4000-8000-000000000085';
const voteId = '00000000-0000-4000-8000-000000000086';

test('approving a NO voter that leaves unanimous Yes completes the room pending reconciliation', async () => {
  const values = new Map<string, Record<string, unknown>>([
    [`rooms/${roomId}`, { status: 'ACTIVE', hostId: 'host-user', activeMemberCount: 2, participantCount: 2 }],
    [`rooms/${roomId}/members/host-user`, { role: 'HOST', status: 'ACTIVE' }],
    [`rooms/${roomId}/members/member-user`, { status: 'ACTIVE', earlyExitAt: null }],
    [`rooms/${roomId}/earlyExitRequests/member-user`, { requestId, status: 'OPEN' }],
    [`rooms/${roomId}/terminationVotes/current`, {
      voteId, openedAt: new Timestamp(0, 0), status: 'OPEN', eligibleVoterCount: 2, yesVoteCount: 1,
    }],
    [`rooms/${roomId}/terminationVotes/current/ballots/member-user`, { voteId, choice: 'NO' }],
  ]);
  const transaction = {
    get: jest.fn(async (path: string) => ({ exists: () => values.has(path), data: () => values.get(path) ?? {} })),
    set: jest.fn(),
    update: jest.fn(),
  };
  (runTransaction as jest.Mock).mockImplementation(async (_firestore, callback) => callback(transaction));
  const repository = createEarlyExitRepository({
    firestore: {} as never,
    auth: { currentUser: { uid: 'host-user' } } as never,
  });

  const result = await repository.decideEarlyExit({ roomId, memberUid: 'member-user', requestId, decision: 'APPROVE' });

  expect(result.status).toBe('APPROVED');
  expect(transaction.update).toHaveBeenCalledWith(`rooms/${roomId}`, expect.objectContaining({
    status: 'COMPLETED', reconciliationStatus: 'PENDING', pendingMemberCount: 2,
    completionRequestId: requestId, lastEarlyExitMemberUid: 'member-user',
  }));
});
