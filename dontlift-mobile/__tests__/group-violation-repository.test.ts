import { runTransaction, Timestamp } from 'firebase/firestore';
import { createGroupViolationRepository } from '../src/features/rooms/group-violation-repository';

jest.mock('firebase/firestore', () => ({
  Timestamp: class {
    private readonly storedValue: number;
    constructor(value: number) { this.storedValue = value; }
    static fromMillis(value: number) { return new this(value); }
    toMillis() { return this.storedValue; }
  },
  doc: jest.fn((...parts: unknown[]) => parts.slice(1).join('/')),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-timestamp'),
}));

const rows = [
  {
    event_id: '00000000-0000-4000-8000-000000000001', room_id: 'room-1', user_id: 'member',
    started_at: new Date(1_000).toISOString(), ended_at: new Date(4_000).toISOString(), duration_seconds: 3,
  },
  {
    event_id: '00000000-0000-4000-8000-000000000002', room_id: 'room-1', user_id: 'member',
    started_at: new Date(6_000).toISOString(), ended_at: new Date(9_000).toISOString(), duration_seconds: 3,
  },
];

describe('group violation sync', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exposes a durable retry pass for completed rooms without screen selection', async () => {
    const repository = createGroupViolationRepository({
      firestore: {} as never,
      auth: { currentUser: { uid: 'member' } } as never,
      database: async () => ({
        getAllAsync: jest.fn().mockResolvedValue([]),
        getFirstAsync: jest.fn().mockResolvedValue({ count: 0 }),
      } as never),
    });

    expect(repository).toHaveProperty('syncPendingCompletedRooms', expect.any(Function));
    await expect(repository.syncPendingCompletedRooms()).resolves.toBe(0);
  });

  it('drains a completed room history outbox independently of the selected screen', async () => {
    const pendingRow = rows[0];
    const writes: Array<{ sql: string; params: unknown[] }> = [];
    const database = {
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT DISTINCT r.room_id')) return [{ room_id: 'room-1' }];
        if (sql.includes('SELECT v.event_id')) return [pendingRow];
        return [];
      }),
      getFirstAsync: jest.fn().mockResolvedValue({ count: 0 }),
      withExclusiveTransactionAsync: jest.fn(async (operation: (transaction: { runAsync: (...args: unknown[]) => Promise<{ changes: number }> }) => Promise<void>) => {
        await operation({ runAsync: async (sql, ...params) => { writes.push({ sql: String(sql), params }); return { changes: 1 }; } });
      }),
    };
    const set = jest.fn();
    const update = jest.fn();
    jest.mocked(runTransaction).mockImplementation(async (_firestore, callback) => callback({
      get: async (reference: string) => {
        if (reference.endsWith('/members/member')) {
          return { exists: () => true, data: () => ({ status: 'ACTIVE', earlyExitAt: null }) };
        }
        if (reference.endsWith(`/violations/${pendingRow.event_id}`)) {
          return { exists: () => false, data: () => undefined };
        }
        return { exists: () => true, data: () => ({
          status: 'COMPLETED', reconciliationStatus: 'FINALIZED', finalizationReason: 'HOST_OVERRIDE',
          startedAt: Timestamp.fromMillis(0), endedAt: Timestamp.fromMillis(10_000),
        }) };
      },
      set,
      update,
    } as never));
    const repository = createGroupViolationRepository({
      firestore: {} as never,
      auth: { currentUser: { uid: 'member' } } as never,
      database: async () => database as never,
    });

    await expect(repository.syncPendingCompletedRooms()).resolves.toBe(0);

    expect(database.getAllAsync).toHaveBeenCalledWith(expect.stringContaining("r.status = 'COMPLETED'"), 'member');
    expect(set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventId: pendingRow.event_id, excludedFromFinalScore: true, exclusionReason: 'HOST_OVERRIDE',
    }));
    expect(update).not.toHaveBeenCalled();
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ sql: expect.stringContaining("SET sync_status = 'SYNCED'") }),
    ]));
  });

  it('marks an event before the server room window failed and continues syncing later events', async () => {
    const writes: Array<{ sql: string; params: unknown[] }> = [];
    const database = {
      getAllAsync: jest.fn().mockResolvedValue(rows),
      withExclusiveTransactionAsync: jest.fn(async (operation: (transaction: { runAsync: (...args: unknown[]) => Promise<{ changes: number }> }) => Promise<void>) => {
        await operation({ runAsync: async (sql, ...params) => { writes.push({ sql: String(sql), params }); return { changes: 1 }; } });
      }),
    };
    jest.mocked(runTransaction).mockImplementation(async (_firestore, callback) => {
      let readIndex = 0;
      return callback({
        get: async () => {
          const current = readIndex++ % 3;
          if (current === 0) return { exists: () => true, data: () => ({ status: 'ACTIVE', startedAt: Timestamp.fromMillis(5_000) }) };
          if (current === 1) return { exists: () => true, data: () => ({ status: 'ACTIVE', liftCount: 0, violationDurationSeconds: 0, penaltyScore: 0 }) };
          return { exists: () => false, data: () => undefined };
        },
        set: jest.fn(),
        update: jest.fn(),
      } as never);
    });

    const repository = createGroupViolationRepository({
      firestore: {} as never,
      auth: { currentUser: { uid: 'member' } } as never,
      database: async () => database as never,
    });

    await repository.syncPending('room-1');

    expect(runTransaction).toHaveBeenCalledTimes(2);
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ sql: expect.stringContaining("SET sync_status = 'FAILED'"), params: ['invalid-argument', rows[0].event_id, 'member'] }),
      expect.objectContaining({ sql: expect.stringContaining("SET sync_status = 'SYNCED'"), params: expect.arrayContaining([rows[1].event_id, 'member']) }),
    ]));
  });

  it('does not read a violation document after the room is terminal', async () => {
    const database = {
      getAllAsync: jest.fn().mockResolvedValue([rows[1]]),
      withExclusiveTransactionAsync: jest.fn(),
    };
    const readPaths: unknown[] = [];
    jest.mocked(runTransaction).mockImplementation(async (_firestore, callback) => callback({
      get: async (reference: string) => {
        readPaths.push(reference);
        if (readPaths.length === 1) return { exists: () => true, data: () => ({ status: 'COMPLETED' }) };
        if (readPaths.length === 2) return { exists: () => true, data: () => ({ status: 'ACTIVE' }) };
        return { exists: () => false, data: () => undefined };
      },
      set: jest.fn(),
      update: jest.fn(),
    } as never));

    const repository = createGroupViolationRepository({
      firestore: {} as never,
      auth: { currentUser: { uid: 'member' } } as never,
      database: async () => database as never,
    });

    await expect(repository.syncPending('room-1')).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(readPaths).toHaveLength(2);
  });

  it('stores eligible pending violations as excluded history after Host override without changing scores', async () => {
    const writes: Array<{ sql: string; params: unknown[] }> = [];
    const database = {
      getAllAsync: jest.fn().mockResolvedValue([rows[0]]),
      withExclusiveTransactionAsync: jest.fn(async (operation: (transaction: { runAsync: (...args: unknown[]) => Promise<{ changes: number }> }) => Promise<void>) => {
        await operation({ runAsync: async (sql, ...params) => { writes.push({ sql: String(sql), params }); return { changes: 1 }; } });
      }),
    };
    const set = jest.fn();
    const update = jest.fn();
    let readIndex = 0;
    jest.mocked(runTransaction).mockImplementation(async (_firestore, callback) => callback({
      get: async () => {
        const current = readIndex++ % 3;
        if (current === 0) return { exists: () => true, data: () => ({
          status: 'COMPLETED', reconciliationStatus: 'FINALIZED', finalizationReason: 'HOST_OVERRIDE',
          startedAt: Timestamp.fromMillis(0), endedAt: Timestamp.fromMillis(10_000),
        }) };
        if (current === 1) return { exists: () => true, data: () => ({ status: 'ACTIVE', earlyExitAt: null }) };
        return { exists: () => false, data: () => undefined };
      },
      set,
      update,
    } as never));
    const repository = createGroupViolationRepository({
      firestore: {} as never,
      auth: { currentUser: { uid: 'member' } } as never,
      database: async () => database as never,
    });

    await repository.syncPending('room-1');

    expect(set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      eventId: rows[0].event_id, excludedFromFinalScore: true, exclusionReason: 'HOST_OVERRIDE',
    }));
    expect(update).not.toHaveBeenCalled();
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ sql: expect.stringContaining("SET sync_status = 'SYNCED'"), params: expect.arrayContaining([rows[0].event_id, 'member']) }),
    ]));
  });
});
