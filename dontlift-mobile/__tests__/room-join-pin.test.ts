import { doc, getDocFromServer, runTransaction, Timestamp } from 'firebase/firestore';
import { createRoomRepository } from '../src/features/rooms/room-repository';

jest.mock('firebase/firestore', () => ({
  Timestamp: class {
    constructor(private readonly value = Date.now()) {}
    toDate() { return new Date(this.value); }
  },
  serverTimestamp: jest.fn(() => 'server-timestamp'),
  doc: jest.fn((...parts: unknown[]) => parts.slice(1).join('/')),
  runTransaction: jest.fn(),
  getDocFromServer: jest.fn(),
}));

const requestId = '00000000-0000-4000-8000-000000000041';
const pin = '00000042';
const roomId = '10000000-0000-4000-8000-000000000041';

function repository(database: { withExclusiveTransactionAsync: jest.Mock }) {
  return createRoomRepository({
    firestore: {} as Parameters<typeof createRoomRepository>[0]['firestore'],
    auth: { currentUser: { uid: 'member-1' } } as Parameters<typeof createRoomRepository>[0]['auth'],
    database: Promise.resolve(database as unknown as Awaited<Parameters<typeof createRoomRepository>[0]['database']>),
    randomUUID: () => requestId,
  });
}

describe('joinRoomByPin', () => {
  beforeEach(() => jest.clearAllMocks());

  test('commits member, count and receipt together, then caches server timestamps', async () => {
    const references: Record<string, { exists: () => boolean; data: () => Record<string, unknown> | undefined }> = {
      [`users/member-1/commandReceipts/${requestId}`]: { exists: () => false, data: () => undefined },
      [`roomPins/${pin}`]: { exists: () => true, data: () => ({ roomId }) },
      [`rooms/${roomId}`]: { exists: () => true, data: () => ({ pin, hostId: 'host-1', status: 'WAITING', participantCount: 2 }) },
      [`rooms/${roomId}/members/member-1`]: { exists: () => false, data: () => undefined },
      'users/member-1': { exists: () => true, data: () => ({ displayName: 'Member' }) },
    };
    const writes = { set: jest.fn(), update: jest.fn() };
    jest.mocked(runTransaction).mockImplementationOnce(async (_firestore, callback) => callback({
      get: async (reference: string) => references[reference], ...writes,
    } as never) as never);
    jest.mocked(getDocFromServer)
      .mockResolvedValueOnce({ data: () => ({ createdAt: new Timestamp(1_700_000_000, 0), updatedAt: new Timestamp(1_700_000_100, 0) }) } as Awaited<ReturnType<typeof getDocFromServer>>)
      .mockResolvedValueOnce({ data: () => ({ joinedAt: new Timestamp(1_700_000_200, 0), displayName: 'Member' }) } as Awaited<ReturnType<typeof getDocFromServer>>);
    const transaction = { runAsync: jest.fn() };
    const database = { withExclusiveTransactionAsync: jest.fn(async task => task(transaction)) };

    const result = await repository(database).joinRoomByPin({ pin, requestId });

    expect(writes.set).toHaveBeenCalledWith(`rooms/${roomId}/members/member-1`, expect.objectContaining({ role: 'MEMBER', displayName: 'Member' }));
    const memberWrite = writes.set.mock.calls.find(([path]) => path === `rooms/${roomId}/members/member-1`);
    expect(memberWrite?.[1]).not.toHaveProperty('lastViolationEventId');
    expect(writes.update).toHaveBeenCalledWith(`rooms/${roomId}`, {
      participantCount: 3, updatedAt: 'server-timestamp', lastJoinRequestId: requestId,
    });
    expect(writes.set).toHaveBeenCalledWith(`users/member-1/commandReceipts/${requestId}`, expect.objectContaining({ roomId, pin, hostId: 'host-1' }));
    expect(result).toMatchObject({ roomId, pin, participantCount: 3, alreadyMember: false, localCacheSaved: true });
    expect(transaction.runAsync).toHaveBeenCalledTimes(2);
  });

  test('rejects malformed PINs before a Firestore transaction', async () => {
    const joiner = repository({ withExclusiveTransactionAsync: jest.fn() });
    await expect(joiner.joinRoomByPin({ pin: '1234567', requestId }))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    expect(runTransaction).not.toHaveBeenCalled();
    expect(getDocFromServer).not.toHaveBeenCalled();
  });

  test('rejects malformed request IDs before a Firestore transaction', async () => {
    const joiner = repository({ withExclusiveTransactionAsync: jest.fn() });
    await expect(joiner.joinRoomByPin({ pin, requestId: 'not-a-uuid' }))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    expect(runTransaction).not.toHaveBeenCalled();
    expect(getDocFromServer).not.toHaveBeenCalled();
  });

  test('returns a safe not-found when the exact reservation does not exist', async () => {
    const missing = { exists: () => false, data: () => undefined };
    jest.mocked(runTransaction).mockImplementationOnce(async (_firestore, callback) => callback({
      get: async () => missing, set: jest.fn(), update: jest.fn(),
    } as never) as never);
    await expect(repository({ withExclusiveTransactionAsync: jest.fn() }).joinRoomByPin({ pin, requestId }))
      .rejects.toMatchObject({ code: 'not-found' });
    expect(getDocFromServer).not.toHaveBeenCalled();
  });

  test('rejects a room that is no longer waiting before any write', async () => {
    const references: Record<string, { exists: () => boolean; data: () => Record<string, unknown> | undefined }> = {
      [`users/member-1/commandReceipts/${requestId}`]: { exists: () => false, data: () => undefined },
      [`roomPins/${pin}`]: { exists: () => true, data: () => ({ roomId }) },
      [`rooms/${roomId}`]: { exists: () => true, data: () => ({ pin, hostId: 'host-1', status: 'ACTIVE', participantCount: 2 }) },
      [`rooms/${roomId}/members/member-1`]: { exists: () => false, data: () => undefined },
      'users/member-1': { exists: () => true, data: () => ({ displayName: 'Member' }) },
    };
    const writes = { set: jest.fn(), update: jest.fn() };
    jest.mocked(runTransaction).mockImplementationOnce(async (_firestore, callback) => callback({
      get: async (reference: string) => references[reference], ...writes,
    } as never) as never);
    await expect(repository({ withExclusiveTransactionAsync: jest.fn() }).joinRoomByPin({ pin, requestId }))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    expect(writes.set).not.toHaveBeenCalled();
    expect(writes.update).not.toHaveBeenCalled();
  });

  test('does not queue or report success when Firestore is unavailable', async () => {
    jest.mocked(runTransaction).mockRejectedValueOnce({ code: 'unavailable' });
    const joiner = repository({ withExclusiveTransactionAsync: jest.fn() });
    await expect(joiner.joinRoomByPin({ pin, requestId })).rejects.toMatchObject({ code: 'unavailable' });
    expect(getDocFromServer).not.toHaveBeenCalled();
  });
});
