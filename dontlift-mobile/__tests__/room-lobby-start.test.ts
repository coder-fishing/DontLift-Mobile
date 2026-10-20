import { createRoomRepository, RoomStartError } from '../src/features/rooms/room-repository';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  getDocFromServer: jest.fn(async () => ({ data: () => ({ startedAt: null }) })),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIME'),
  Timestamp: class Timestamp {},
}));

const firestoreMocks = jest.requireMock('firebase/firestore') as {
  doc: jest.Mock;
  getDocFromServer: jest.Mock;
  runTransaction: jest.Mock;
  serverTimestamp: jest.Mock;
};

const roomId = '10000000-0000-4000-8000-000000000016';
const requestId = '00000000-0000-4000-8000-000000000016';

function makeRepository(status: string, lastRequestId: string | null = null) {
  const update = jest.fn();
  firestoreMocks.runTransaction.mockImplementation(async (_db, operation) => operation({
    get: async (reference: { path: string }) => reference.path.endsWith(`/members/host`)
      ? { exists: () => true, data: () => ({ role: 'HOST', status: 'ACTIVE' }) }
      : { exists: () => true, data: () => ({ hostId: 'host', status, lastStartRequestId: lastRequestId }) },
    update,
  }));
  const repository = createRoomRepository({
    firestore: {} as never,
    auth: { currentUser: { uid: 'host' } } as never,
    database: Promise.resolve({} as never),
    randomUUID: () => requestId,
  });
  return { repository, update };
}

describe('startRoom Spark transaction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('changes WAITING to ACTIVE with the server timestamp and request ID', async () => {
    const { repository, update } = makeRepository('WAITING');
    const result = await repository.startRoom({ version: 1, roomId, requestId });
    expect(result).toEqual({ version: 1, roomId, requestId, status: 'ACTIVE', startedAtUtcMs: null });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ path: `rooms/${roomId}` }), {
      status: 'ACTIVE', startedAt: 'SERVER_TIME', updatedAt: 'SERVER_TIME', lastStartRequestId: requestId,
    });
  });

  it('replays the same request without writing a second transition', async () => {
    const { repository, update } = makeRepository('ACTIVE', requestId);
    await expect(repository.startRoom({ version: 1, roomId, requestId })).resolves.toMatchObject({
      version: 1, roomId, requestId, status: 'ACTIVE',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a different start request once the room is already active', async () => {
    const { repository, update } = makeRepository('ACTIVE', '00000000-0000-4000-8000-000000000017');
    await expect(repository.startRoom({ version: 1, roomId, requestId })).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a non Host before writing', async () => {
    const { repository, update } = makeRepository('WAITING');
    firestoreMocks.runTransaction.mockImplementation(async (_db, operation) => operation({
      get: async (reference: { path: string }) => reference.path.endsWith(`/members/host`)
        ? { exists: () => true, data: () => ({ role: 'MEMBER', status: 'ACTIVE' }) }
        : { exists: () => true, data: () => ({ hostId: 'host', status: 'WAITING' }) },
      update,
    }));
    await expect(repository.startRoom({ version: 1, roomId, requestId })).rejects.toBeInstanceOf(RoomStartError);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns committed success with a pending timestamp when server readback fails', async () => {
    const { repository, update } = makeRepository('WAITING');
    firestoreMocks.getDocFromServer.mockRejectedValueOnce(new Error('network lost after commit'));

    await expect(repository.startRoom({ version: 1, roomId, requestId })).resolves.toEqual({
      version: 1, roomId, requestId, status: 'ACTIVE', startedAtUtcMs: null,
    });
    expect(update).toHaveBeenCalledTimes(1);
  });
});
