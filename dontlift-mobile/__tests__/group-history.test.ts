import { migrateLocalDatabase } from '../src/features/local/migrations';
import { recordGroupSummary, recoverGroupSummaries } from '../src/features/history/group-summary-repository';
import { mergeGroupHistory, readGroupSummary, type GroupLocalSummary } from '../src/features/history/group-history-model';
import { createGroupHistoryRepository } from '../src/features/history/group-history-repository';
import type * as SQLite from 'expo-sqlite';
import { persistEarlyExitProjection, persistTerminalRoomProjection } from '../src/features/rooms/room-lobby-projection';
import { cacheGroupRoomSnapshot } from '../src/features/history/group-history-cache';
import type { RoomLobbySnapshot } from '../src/features/rooms/room-listener';
jest.mock('../src/features/local/database', () => ({ getLocalDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '20000000-0000-4000-8000-000000000028' }));
jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }), collection: jest.fn(), documentId: () => 'ID',
  orderBy: jest.fn(), limit: jest.fn(), query: jest.fn(), where: jest.fn(), startAfter: jest.fn(),
  runTransaction: jest.fn(), getDocsFromServer: jest.fn(), getDocFromServer: jest.fn(), serverTimestamp: () => 'SERVER_TIME', Timestamp: class {},
}));
const api = jest.requireMock('firebase/firestore');
const room = '10000000-0000-4000-8000-000000000028';
const event = '20000000-0000-4000-8000-000000000028';
let native: { exec(sql: string): void; prepare(sql: string): { get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[]; run(...p: unknown[]): unknown }; close(): void };
let db: SQLite.SQLiteDatabase;
let failOutbox = false;
async function seed(id = room, uid = 'member') {
  await db.runAsync("INSERT OR REPLACE INTO sessions (id,user_id,mode,status,duration_seconds,started_at,completed_at) VALUES (?,?,'GROUP','COMPLETED',10,?,?)", id, uid, new Date(1000).toISOString(), new Date(11000).toISOString());
  await db.runAsync("INSERT OR REPLACE INTO rooms (room_id,host_uid,pin,status,created_at,updated_at) VALUES (?,'host','12345678','COMPLETED',?,?)", id, new Date(1000).toISOString(), new Date(11000).toISOString());
  await db.runAsync("INSERT OR REPLACE INTO room_members (room_id,uid,display_name,role,status,joined_at) VALUES (?,?,'Member','MEMBER','ACTIVE',?)", id, uid, new Date(1000).toISOString());
}
async function record(id = room, uid = 'member') {
  await db.withExclusiveTransactionAsync(tx => recordGroupSummary(tx, { roomId: id, userId: uid, cutoffUtcMs: 11000, status: 'COMPLETED' }, () => uid === 'member' ? event : '50000000-0000-4000-8000-000000000028'));
}
const fixture = (): GroupLocalSummary => ({ version: 1, eventId: event, actorUid: 'member', roomId: room,
  status: 'COMPLETED', startedAtUtcMs: 1000, completedAtUtcMs: 11000, liftCount: 0, violationDurationSeconds: 0, penaltyScore: 0 });
beforeEach(async () => {
  jest.clearAllMocks(); failOutbox = false;
  const { DatabaseSync } = require('node:sqlite'); native = new DatabaseSync(':memory:');
  const wrapper = {
    execAsync: async (sql: string) => native.exec(sql),
    getFirstAsync: async (sql: string, ...p: unknown[]) => native.prepare(sql).get(...p) ?? null,
    getAllAsync: async (sql: string, ...p: unknown[]) => native.prepare(sql).all(...p),
    runAsync: async (sql: string, ...p: unknown[]) => { if (failOutbox && sql.includes('INSERT INTO sync_outbox')) throw new Error('disk-full'); return native.prepare(sql).run(...p); },
    withExclusiveTransactionAsync: async (fn: (tx: unknown) => Promise<void>) => {
      native.exec('BEGIN EXCLUSIVE'); try { await fn(wrapper); native.exec('COMMIT'); } catch (e) { native.exec('ROLLBACK'); throw e; }
    },
  }; db = wrapper as never; await migrateLocalDatabase(db);
});
afterEach(() => native.close());
const repo = () => createGroupHistoryRepository({ firestore: {} as never, auth: { currentUser: { uid: 'member' } } as never, database: Promise.resolve(db), readAuthority: async () => ({ status: 'COMPLETED', roomStatus: 'COMPLETED', cutoffUtcMs: 11000, startedAtUtcMs: 1000, terminal: true, earlyExitAtUtcMs: null }) });

test('summary/outbox rollback together and repeated completion reuses one event', async () => {
  await seed(); failOutbox = true; await expect(record()).rejects.toThrow('disk-full');
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM group_history')).toMatchObject({ n: 0 });
  failOutbox = false; await record(); await record(); await recoverGroupSummaries(db, 'member');
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM group_history')).toMatchObject({ n: 1 });
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM sync_outbox')).toMatchObject({ n: 1 });
});
test('v9 upgrade preserves recordings; startup recovers missing durable summary', async () => {
  await seed(); native.exec('DROP TABLE group_history; PRAGMA user_version = 9'); await migrateLocalDatabase(db); await recoverGroupSummaries(db, 'member');
  expect(await db.getFirstAsync('PRAGMA user_version')).toMatchObject({ user_version: 11 });
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM sessions')).toMatchObject({ n: 1 });
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM group_history')).toMatchObject({ n: 1 });
});
test('two accounts retain separate summaries for one room', async () => {
  await seed(); await record(); await seed(room, 'other'); await record(room, 'other');
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM group_history')).toMatchObject({ n: 2 });
});
test('parser rejects forged owner, invalid score or unsafe number; merge deduplicates', () => {
  expect(readGroupSummary(fixture(), 'outsider')).toBeNull();
  expect(readGroupSummary({ ...fixture(), penaltyScore: 1 }, 'member')).toBeNull();
  expect(readGroupSummary({ ...fixture(), liftCount: Number.MAX_SAFE_INTEGER + 1 }, 'member')).toBeNull();
  const row = { summary: fixture(), syncStatus: 'PENDING' as const };
  expect(mergeGroupHistory([row], [{ ...row, syncStatus: 'SYNCED' }])).toEqual([row]);
});
test('transient upload and lost ACK replay keep exactly one remote create', async () => {
  await seed(); await record(); const remote = new Map<string, unknown>(); let creates = 0;
  api.runTransaction.mockImplementation(async (_: unknown, fn: (tx: unknown) => Promise<void>) => fn({
    get: async (ref: { path: string }) => ({ exists: () => remote.has(ref.path), data: () => remote.get(ref.path) }),
    set: (ref: { path: string }, value: unknown) => { remote.set(ref.path, value); creates++; },
  }));
  api.runTransaction.mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }));
  const repository = repo(); await repository.syncPending('member');
  expect(await db.getFirstAsync('SELECT sync_status FROM group_history')).toMatchObject({ sync_status: 'PENDING' });
  await repository.syncPending('member'); await db.runAsync("UPDATE sync_outbox SET sync_status='PENDING'"); await repository.syncPending('member');
  expect(creates).toBe(1); expect(await db.getFirstAsync('SELECT sync_status FROM sync_outbox')).toMatchObject({ sync_status: 'SYNCED' });
});
test('permanent rejection does not starve the next room', async () => {
  await seed(); await record(); const second = '30000000-0000-4000-8000-000000000028'; await seed(second);
  await db.withExclusiveTransactionAsync(tx => recordGroupSummary(tx, { roomId: second, userId: 'member', cutoffUtcMs: 11000, status: 'COMPLETED' }, () => '40000000-0000-4000-8000-000000000028'));
  api.runTransaction.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }))
    .mockImplementation(async (_: unknown, fn: (tx: unknown) => Promise<void>) => fn({ get: async () => ({ exists: () => false }), set: jest.fn() }));
  await repo().syncPending('member');
  expect(await db.getFirstAsync('SELECT sync_status FROM group_history WHERE room_id=?', room)).toMatchObject({ sync_status: 'FAILED' });
  expect(await db.getFirstAsync('SELECT sync_status FROM group_history WHERE room_id=?', second)).toMatchObject({ sync_status: 'SYNCED' });
});
test('local/cloud overlap deduplicates and old pending row survives the free window', async () => {
  await seed(); await record(); api.getDocsFromServer.mockResolvedValue({ docs: [{ id: room, data: () => fixture() }] });
  const repository = repo(); const options = { cursor: null, online: true, localPremium: false, serverPremium: false, nowUtcMs: Date.now() };
  const page = await repository.readPage('member', options); expect(page.items).toHaveLength(1); expect(page.items[0].syncStatus).toBe('PENDING');
  expect((await repository.readPage('member', { ...options, online: false, cursor: page.cursor })).items).toHaveLength(0);
});

test('records eligible closed intervals and leaves unconfirmed or post-cutoff logs out', async () => {
  await seed();
  for (const [id, ended, duration] of [['a', new Date(9000).toISOString(), 5], ['b', null, 3], ['c', new Date(14000).toISOString(), 10]] as const) {
    await db.runAsync(`INSERT INTO violation_logs (event_id,session_id,room_id,user_id,started_at,confirmed_at,ended_at,duration_seconds,sync_status,created_at)
      VALUES (?,?,?,'member',?,?,?,?, 'PENDING',?)`, id, room, room, new Date(4000).toISOString(), new Date(7000).toISOString(), ended, duration, new Date(7000).toISOString());
  }
  await record();
  const row = await db.getFirstAsync<{ summary_json: string }>('SELECT summary_json FROM group_history');
  expect(JSON.parse(row!.summary_json)).toMatchObject({ liftCount: 2, violationDurationSeconds: 12, penaltyScore: 32 });
});
test('local Premium does not expose expired cloud-only cache; pending local remains visible', async () => {
  await seed(); await record();
  await db.runAsync("UPDATE group_history SET source='CLOUD', sync_status='SYNCED'");
  const options = { cursor: null, online: false, localPremium: true, serverPremium: false, nowUtcMs: Date.now() };
  expect((await repo().readPage('member', options)).items).toHaveLength(0);
  expect((await repo().readPage('member', { ...options, serverPremium: true })).items).toHaveLength(1);
  await db.runAsync("UPDATE group_history SET source='LOCAL'");
  expect((await repo().readPage('member', options)).items).toHaveLength(1);
});
test('old account cannot read or upload another account history', async () => {
  await seed(); await record();
  const repository = repo();
  await expect(repository.readPage('other', { cursor: null, online: true, localPremium: true, serverPremium: true, nowUtcMs: Date.now() })).rejects.toThrow('unauthenticated');
  await repository.syncPending('other');
  expect(api.runTransaction).not.toHaveBeenCalled();
});

test('projection and summary roll back together; approved early exit survives later terminal update', async () => {
  await seed(); await db.runAsync("UPDATE sessions SET status='ACTIVE', completed_at=NULL");
  failOutbox = true;
  await expect(persistTerminalRoomProjection(Promise.resolve(db), { roomId: room, userId: 'member', status: 'CANCELLED', endedAtUtcMs: 11000 })).rejects.toThrow('disk-full');
  expect(await db.getFirstAsync('SELECT status FROM sessions')).toMatchObject({ status: 'ACTIVE' });
  expect(await db.getFirstAsync('SELECT status FROM rooms')).toMatchObject({ status: 'COMPLETED' });
  failOutbox = false;
  await persistEarlyExitProjection(Promise.resolve(db), { roomId: room, userId: 'member', cutoffUtcMs: 11000, startedAtUtcMs: 1000 });
  await persistTerminalRoomProjection(Promise.resolve(db), { roomId: room, userId: 'member', status: 'COMPLETED', endedAtUtcMs: 15000 });
  const row = await db.getFirstAsync<{ summary_json: string }>('SELECT summary_json FROM group_history');
  expect(JSON.parse(row!.summary_json)).toMatchObject({ status: 'EARLY_EXIT', completedAtUtcMs: 11000 });
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM sync_outbox')).toMatchObject({ n: 1 });
});
test('equal-time pagination keeps stable room-ID ties without skipping records', async () => {
  for (let i = 0; i < 25; i++) {
    const summary = { ...fixture(), roomId: `${String(i).padStart(8, '0')}-0000-4000-8000-000000000028` };
    await db.runAsync("INSERT INTO group_history (actor_uid,room_id,completed_at_utc_ms,summary_json,sync_status) VALUES ('member',?,11000,?,'SYNCED')", summary.roomId, JSON.stringify(summary));
  }
  const repository = repo(); const options = { cursor: null, online: false, localPremium: true, serverPremium: false, nowUtcMs: Date.now() };
  const page1 = await repository.readPage('member', options);
  const page2 = await repository.readPage('member', { ...options, cursor: page1.cursor });
  expect(page1.items).toHaveLength(20); expect(page1.hasMore).toBe(true); expect(page2.items).toHaveLength(5);
  expect(new Set([...page1.items, ...page2.items].map(i => i.summary.roomId)).size).toBe(25);
});

test('previously uploaded history restores on another device and remains available offline', async () => {
  api.getDocsFromServer.mockResolvedValue({ docs: [{ id: room, data: () => fixture() }] });
  const repository = repo();
  const options = { cursor: null, online: true, localPremium: false, serverPremium: true, nowUtcMs: Date.now() };
  expect((await repository.readPage('member', options)).items[0].syncStatus).toBe('SYNCED');
  expect(await db.getFirstAsync('SELECT source FROM group_history')).toMatchObject({ source: 'CLOUD' });
  expect((await repository.readPage('member', { ...options, online: false })).items).toHaveLength(1);
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM sync_outbox')).toMatchObject({ n: 0 });
});

test('completion roster cache is account-scoped and finalized points are not downgraded', async () => {
  await seed(); await record();
  const snapshot: RoomLobbySnapshot = { roomId: room, hostUid: 'host', status: 'COMPLETED', participantCount: 1,
    startedAtUtcMs: 1000, endedAtUtcMs: 11000, reconciliationStatus: 'FINALIZED', finalizationReason: 'ALL_SYNCED',
    pin: '12345678', createdAt: new Date(1000).toISOString(), updatedAt: new Date(11000).toISOString(),
    members: [{ uid: 'member', displayName: 'Member', role: 'MEMBER', status: 'ACTIVE', penaltyScore: 13,
      liftCount: 1, violationDurationSeconds: 3, joinedAt: new Date(1000).toISOString() }] };
  await db.withExclusiveTransactionAsync(tx => cacheGroupRoomSnapshot(tx, 'member', snapshot));
  await db.withExclusiveTransactionAsync(tx => cacheGroupRoomSnapshot(tx, 'member', { ...snapshot, reconciliationStatus: 'PENDING',
    members: [{ ...snapshot.members[0], penaltyScore: 0 }] }));
  const result = await repo().cachedDetail('member', room);
  expect(result).toMatchObject({ reconciliation: 'FINALIZED', members: [{ score: 13 }] });
  expect(JSON.stringify(result)).not.toContain('accountNumber');
  expect(await repo().cachedDetail('other', room)).toBeNull();
});


test('mixed CANCELLED/ACTIVE snapshot is corrected from authoritative EARLY_EXIT before upload', async () => {
  await seed();
  await db.withExclusiveTransactionAsync(tx => recordGroupSummary(tx, { roomId: room, userId: 'member', status: 'CANCELLED', cutoffUtcMs: 11000 }));
  const set = jest.fn();
  api.runTransaction.mockImplementation(async (_: unknown, fn: (tx: unknown) => Promise<void>) => fn({ get: async () => ({ exists: () => false }), set }));
  const repository = createGroupHistoryRepository({ firestore: {} as never, auth: { currentUser: { uid: 'member' } } as never,
    database: Promise.resolve(db), readAuthority: async () => ({ status: 'EARLY_EXIT', roomStatus: 'CANCELLED', terminal: true,
      cutoffUtcMs: 9000, startedAtUtcMs: 1000, earlyExitAtUtcMs: 9000 }) });
  await repository.syncPending('member');
  expect(set.mock.calls[0][1]).toMatchObject({ eventId: event, status: 'EARLY_EXIT', completedAtUtcMs: 9000 });
  expect(await db.getFirstAsync('SELECT sync_status, terminal_confirmed FROM group_history')).toMatchObject({ sync_status: 'SYNCED', terminal_confirmed: 1 });
});

test('already uploaded early exit rechecks terminal authority and repairs a backdated abort', async () => {
  await seed();
  await db.withExclusiveTransactionAsync(tx => recordGroupSummary(tx, { roomId: room, userId: 'member', status: 'EARLY_EXIT', cutoffUtcMs: 11000 }));
  let terminal = false; let remote: unknown; const update = jest.fn((_ref, value) => { remote = value; });
  api.runTransaction.mockImplementation(async (_: unknown, fn: (tx: unknown) => Promise<void>) => fn({
    get: async () => ({ exists: () => remote != null, data: () => remote }), set: (_ref: unknown, value: unknown) => { remote = value; }, update,
  }));
  const repository = createGroupHistoryRepository({ firestore: {} as never, auth: { currentUser: { uid: 'member' } } as never,
    database: Promise.resolve(db), readAuthority: async () => ({ status: 'EARLY_EXIT', roomStatus: terminal ? 'ABORTED' : 'ACTIVE', terminal,
      cutoffUtcMs: terminal ? 8000 : 11000, startedAtUtcMs: 1000, earlyExitAtUtcMs: 11000 }) });
  await repository.syncPending('member'); terminal = true; await repository.syncPending('member');
  expect(update).toHaveBeenCalledTimes(1);
  expect(remote).toMatchObject({ eventId: event, status: 'EARLY_EXIT', completedAtUtcMs: 8000 });
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM sync_outbox')).toMatchObject({ n: 1 });
  expect(await db.getFirstAsync('SELECT completed_at FROM sessions')).toMatchObject({ completed_at: new Date(8000).toISOString() });
});

test('a stale upload acknowledgment cannot mark a rewritten local payload synced', async () => {
  await seed(); await record();
  api.runTransaction.mockImplementation(async (_: unknown, fn: (tx: unknown) => Promise<void>) => {
    await fn({ get: async () => ({ exists: () => false }), set: jest.fn() });
    await db.withExclusiveTransactionAsync(tx => recordGroupSummary(tx, { roomId: room, userId: 'member', status: 'EARLY_EXIT', cutoffUtcMs: 8000 }));
  });
  await repo().syncPending('member');
  expect(await db.getFirstAsync('SELECT sync_status FROM group_history')).toMatchObject({ sync_status: 'PENDING' });
  expect(await db.getFirstAsync('SELECT sync_status FROM sync_outbox')).toMatchObject({ sync_status: 'PENDING' });
});

test('authoritative room and membership are read in one transaction', async () => {
  const { readGroupHistoryAuthority } = require('../src/features/history/group-history-authority');
  const timestamp = (n: number) => Object.assign(new api.Timestamp(), { toMillis: () => n });
  const get = jest.fn(async (ref: { path: string }) => ({ exists: () => true, data: () => ref.path.includes('/members/')
    ? { status: 'EARLY_EXIT', earlyExitAt: timestamp(11000) }
    : { status: 'ABORTED', startedAt: timestamp(1000), endedAt: timestamp(8000) } }));
  api.runTransaction.mockImplementation(async (_: unknown, fn: (tx: unknown) => Promise<void>) => fn({ get }));
  expect(await readGroupHistoryAuthority({ firestore: {}, auth: { currentUser: { uid: 'member' } } }, 'member', room))
    .toMatchObject({ status: 'EARLY_EXIT', cutoffUtcMs: 8000, terminal: true });
  expect(api.runTransaction).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledTimes(2);
});


test('v10 upgrade retains an uploaded exit for later terminal verification', async () => {
  await seed(); await record();
  await db.runAsync("UPDATE group_history SET sync_status='SYNCED'");
  native.exec('ALTER TABLE group_history DROP COLUMN terminal_confirmed; PRAGMA user_version=10');
  await migrateLocalDatabase(db);
  expect(await db.getFirstAsync('SELECT sync_status, terminal_confirmed FROM group_history')).toMatchObject({ sync_status: 'SYNCED', terminal_confirmed: 0 });
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM sync_outbox')).toMatchObject({ n: 1 });
});

test('earlier cutoff trims confirmed closed intervals and removes under-grace intervals', async () => {
  await seed();
  for (const [id, start, confirmed] of [['a', 1000, 4000], ['b', 6000, 9000]] as const) {
    await db.runAsync(`INSERT INTO violation_logs (event_id,session_id,room_id,user_id,started_at,confirmed_at,ended_at,duration_seconds,sync_status,created_at)
      VALUES (?,?,?,'member',?,?,?,?, 'SYNCED',?)`, id, room, room, new Date(start).toISOString(), new Date(confirmed).toISOString(), new Date(11000).toISOString(), (11000-start)/1000, new Date(confirmed).toISOString());
  }
  await record();
  await db.withExclusiveTransactionAsync(tx => recordGroupSummary(tx, { roomId: room, userId: 'member', status: 'EARLY_EXIT', cutoffUtcMs: 8000 }));
  const entry = await repo().readEntry('member', room);
  expect(entry?.summary).toMatchObject({ eventId: event, status: 'EARLY_EXIT', completedAtUtcMs: 8000, liftCount: 1, violationDurationSeconds: 7, penaltyScore: 17 });
});
