import { doc, getDocFromServer, runTransaction, Timestamp } from 'firebase/firestore';
import { createRoomRepository } from '../src/features/rooms/room-repository';

jest.mock('firebase/firestore', () => ({
  Timestamp: class {
    static now() { return new this(); }
    static fromMillis(value: number) { return new this(value); }
    constructor(private readonly value = Date.now()) {}
    toMillis() { return Date.now(); }
    toDate() { return new Date(this.value); }
  },
  serverTimestamp: jest.fn(() => 'server-timestamp'),
  doc: jest.fn((...parts: unknown[]) => parts.slice(1).join('/')),
  runTransaction: jest.fn(),
  getDocFromServer: jest.fn(),
}));

const command = {
  requestId: '00000000-0000-4000-8000-000000000001',
  roomId: '10000000-0000-4000-8000-000000000001', pin: '0007',
};
function repository() {
  return createRoomRepository({
    firestore: {} as Parameters<typeof createRoomRepository>[0]['firestore'],
    auth: { currentUser: { uid: 'host' } } as Parameters<typeof createRoomRepository>[0]['auth'],
    database: Promise.resolve({} as Awaited<Parameters<typeof createRoomRepository>[0]['database']>),
    randomUUID: () => command.requestId,
  });
}

describe('room creation does not resume after an offline probe', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.resetAllMocks(); });
  afterEach(() => { jest.useRealTimers(); });

  test('rejects an offline transaction without starting room creation', async () => {
    jest.mocked(runTransaction).mockRejectedValueOnce({ code: 'unavailable' });
    await expect(repository().createRoom('Host', command)).rejects.toMatchObject({ code: 'unavailable' });
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(getDocFromServer).not.toHaveBeenCalled();
  });

  test('times out a pending clock write and ignores its later acknowledgement', async () => {
    let acknowledge!: () => void;
    jest.mocked(runTransaction).mockImplementationOnce(() => new Promise<void>(resolve => { acknowledge = resolve; }));
    jest.mocked(getDocFromServer).mockResolvedValue({ data: () => ({ checkedAt: Timestamp.now() }) } as Awaited<ReturnType<typeof getDocFromServer>>);
    const result = repository().createRoom('Host', command);
    const rejected = expect(result).rejects.toMatchObject({ code: 'unavailable' });
    await jest.advanceTimersByTimeAsync(10_000);
    await rejected;
    acknowledge();
    await jest.advanceTimersByTimeAsync(0);
    expect(runTransaction).toHaveBeenCalledTimes(1);
  });

  test('also bounds a stalled server clock read', async () => {
    jest.mocked(runTransaction).mockResolvedValueOnce(undefined);
    jest.mocked(getDocFromServer).mockImplementationOnce(() => new Promise(() => {}));
    const rejected = expect(repository().createRoom('Host', command)).rejects.toMatchObject({ code: 'unavailable' });
    await jest.advanceTimersByTimeAsync(10_000);
    await rejected;
    expect(runTransaction).toHaveBeenCalledTimes(1);
  });

  test('keeps committed room successful but skips SQLite when server createdAt cannot be read', async () => {
    jest.mocked(doc).mockImplementation(((...parts: unknown[]) => parts.slice(1).join('/')) as unknown as typeof doc);
    const profile = { exists: () => true, data: () => ({ displayName: 'Host', isPremium: false }) };
    const missing = { exists: () => false, data: () => undefined };
    jest.mocked(runTransaction)
      .mockImplementationOnce(async (_firestore, callback) => callback({
        get: async () => missing, set: jest.fn(),
      } as never) as never)
      .mockImplementationOnce(async (_firestore, callback) => callback({
        get: async (reference: string) => reference === 'users/host' ? profile : missing,
        set: jest.fn(),
      } as never) as never);
    jest.mocked(getDocFromServer)
      .mockResolvedValueOnce({ data: () => ({ checkedAt: Timestamp.now() }) } as Awaited<ReturnType<typeof getDocFromServer>>)
      .mockRejectedValueOnce({ code: 'unavailable' });
    const withExclusiveTransactionAsync = jest.fn();
    const createRoom = createRoomRepository({
      firestore: {} as Parameters<typeof createRoomRepository>[0]['firestore'],
      auth: { currentUser: { uid: 'host' } } as Parameters<typeof createRoomRepository>[0]['auth'],
      database: Promise.resolve({ withExclusiveTransactionAsync } as unknown as Awaited<Parameters<typeof createRoomRepository>[0]['database']>),
      randomUUID: () => command.requestId,
    });

    const result = await createRoom.createRoom('Host', command);

    expect(result.createdAt).toBeNull();
    expect(result.localCacheSaved).toBe(false);
    expect(withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });
});
