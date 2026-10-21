import { runTransaction, Timestamp } from 'firebase/firestore';
import { createRoomCompletionRepository, RoomCompletionError } from '../src/features/rooms/room-completion-repository';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIME'),
  Timestamp: class Timestamp {
    private readonly storedValue: number;
    constructor(value: number) { this.storedValue = value; }
    static fromMillis(value: number) { return new this(value); }
    toMillis() { return this.storedValue; }
  },
}));

const firestoreMocks = jest.requireMock('firebase/firestore') as {
  runTransaction: jest.Mock;
  serverTimestamp: jest.Mock;
};

const roomId = '10000000-0000-4000-8000-000000000021';
const requestId = '00000000-0000-4000-8000-000000000021';
const endedAt = Timestamp.fromMillis(100_000);
const pendingUids = ['host', 'member'];

function makeRepository() {
  return createRoomCompletionRepository({
    firestore: {} as never,
    auth: { currentUser: { uid: 'host' } } as never,
  });
}

function mockTransaction({ finalized = false } = {}) {
  const update = jest.fn();
  const set = jest.fn();
  firestoreMocks.runTransaction.mockImplementation(async (_db, operation) => operation({
    get: async (reference: { path: string }) => {
      if (reference.path.endsWith('/members/host')) {
        return { exists: () => true, data: () => ({ role: 'HOST', status: 'ACTIVE' }) };
      }
      if (reference.path.endsWith(`/reconciliationAudits/${requestId}`)) {
        return finalized
          ? { exists: () => true, data: () => ({ unsyncedMemberUids: pendingUids, scoreSnapshotRef: `rooms/${roomId}/members` }) }
          : { exists: () => false, data: () => undefined };
      }
      return {
        exists: () => true,
        data: () => finalized
          ? { status: 'COMPLETED', hostId: 'host', reconciliationStatus: 'FINALIZED', finalizationReason: 'HOST_OVERRIDE', hostOverrideRequestId: requestId, endedAt, pendingMemberCount: 2 }
          : { status: 'COMPLETED', hostId: 'host', reconciliationStatus: 'PENDING', endedAt, pendingMemberCount: 2 },
      };
    },
    update,
    set,
  }));
  return { update, set };
}

describe('Host Spark score finalization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a missing warning confirmation before any transaction', async () => {
    await expect(makeRepository().finalizeRoomScores({
      roomId, requestId, reason: 'HOST_OVERRIDE', confirmedWarning: false, unsyncedMemberUids: pendingUids,
    })).rejects.toBeInstanceOf(RoomCompletionError);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('finalizes the pending room and creates its audit atomically', async () => {
    const { update, set } = mockTransaction();
    const result = await makeRepository().finalizeRoomScores({
      roomId, requestId, reason: 'HOST_OVERRIDE', confirmedWarning: true, unsyncedMemberUids: pendingUids,
    });
    expect(result).toMatchObject({
      version: 1, roomId, requestId, status: 'COMPLETED', reconciliationStatus: 'FINALIZED',
      finalizationReason: 'HOST_OVERRIDE', pendingMemberCount: 2,
      unsyncedMemberUids: pendingUids, auditId: requestId, scoreSnapshotRef: `rooms/${roomId}/members`,
    });
    expect(update).toHaveBeenCalledWith({ path: `rooms/${roomId}` }, expect.objectContaining({
      reconciliationStatus: 'FINALIZED', finalizationReason: 'HOST_OVERRIDE',
      finalizedAt: 'SERVER_TIME', finalizedBy: 'host', hostOverrideRequestId: requestId,
    }));
    expect(set).toHaveBeenCalledWith({ path: `rooms/${roomId}/reconciliationAudits/${requestId}` }, expect.objectContaining({
      hostUid: 'host', confirmedWarning: true, pendingMemberCount: 2, unsyncedMemberUids: pendingUids,
      scoreSnapshotRef: `rooms/${roomId}/members`, createdAt: 'SERVER_TIME',
    }));
  });

  it('replays the same request without creating a second audit', async () => {
    const { update, set } = mockTransaction({ finalized: true });
    await expect(makeRepository().finalizeRoomScores({
      roomId, requestId, reason: 'HOST_OVERRIDE', confirmedWarning: true, unsyncedMemberUids: pendingUids,
    })).resolves.toMatchObject({ finalizationReason: 'HOST_OVERRIDE', auditId: requestId, unsyncedMemberUids: pendingUids });
    expect(update).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});
