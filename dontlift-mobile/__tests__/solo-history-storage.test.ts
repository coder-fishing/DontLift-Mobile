import type * as SQLite from 'expo-sqlite';
import { migrateLocalDatabase } from '../src/features/local/migrations';
import { cacheCloudHistory, readLocalHistoryPage } from '../src/features/history/solo-history-repository';
import { FREE_HISTORY_WINDOW_MS, type SoloHistoryEntry } from '../src/features/history/history-model';

jest.mock('expo-sqlite', () => ({}));
jest.mock('firebase/firestore', () => ({}));
type NativeDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { all(...args: unknown[]): unknown[]; get(...args: unknown[]): unknown; run(...args: unknown[]): { changes: number; lastInsertRowid: number } };
  close(): void;
};
const context = { userId: 'owner', localPremium: false, serverPremium: false, nowUtcMs: Date.parse('2026-10-19T12:00:00Z') };
const cloudEntry = (sessionId: string, completedAt = new Date(context.nowUtcMs).toISOString()): SoloHistoryEntry => ({
  sessionId, userId: context.userId, mode: null, completedAt,
  startedAt: new Date(Date.parse(completedAt) - 60_000).toISOString(),
  durationSeconds: 60, liftCount: 1, violationDurationSeconds: 3, penaltyScore: 13, syncStatus: 'synced',
});
let database: SQLite.SQLiteDatabase;
let native: NativeDatabase;
beforeEach(async () => {
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (name: string) => NativeDatabase };
  native = new DatabaseSync(':memory:');
  const adapter = {
    async execAsync(sql: string) { native.exec(sql); },
    async getAllAsync(sql: string, ...args: unknown[]) { return native.prepare(sql).all(...args); },
    async getFirstAsync(sql: string, ...args: unknown[]) { return native.prepare(sql).get(...args) ?? null; },
    async runAsync(sql: string, ...args: unknown[]) { return native.prepare(sql).run(...args); },
    async withExclusiveTransactionAsync(task: (tx: SQLite.SQLiteDatabase) => Promise<void>) {
      native.exec('BEGIN');
      try { await task(database); native.exec('COMMIT'); } catch (error) { native.exec('ROLLBACK'); throw error; }
    },
  };
  database = adapter as unknown as SQLite.SQLiteDatabase;
  await migrateLocalDatabase(database);
});
afterEach(() => native.close());

async function seedLocal(id: string, completedAt: string, syncStatus: string, userId = 'owner') {
  const startedAt = new Date(Date.parse(completedAt) - 60_000).toISOString();
  await database.runAsync(`INSERT INTO sessions(id,user_id,mode,status,duration_seconds,started_at,completed_at) VALUES (?,?,'COUNTDOWN','COMPLETED',60,?,?)`, id, userId, startedAt, completedAt);
  await database.runAsync(`INSERT INTO sync_outbox(event_id,event_type,schema_version,aggregate_type,aggregate_id,session_id,actor_uid,occurred_at_utc_ms,payload_json,sync_status,created_at) VALUES (?,'SOLO_SESSION_COMPLETED',1,'SOLO_SESSION',?,?,?,?,'{}',?,?)`, id, id, id, userId, Date.parse(completedAt), syncStatus, completedAt);
}

test('Free retention is inclusive at seven days, preserves unsynced summaries and isolates owners', async () => {
  const cutoff = context.nowUtcMs - FREE_HISTORY_WINDOW_MS;
  await seedLocal('boundary', new Date(cutoff).toISOString(), 'SYNCED');
  await seedLocal('expired', new Date(cutoff - 1).toISOString(), 'SYNCED');
  await seedLocal('pending', new Date(cutoff - 1).toISOString(), 'PENDING');
  await seedLocal('other-user', new Date(context.nowUtcMs).toISOString(), 'SYNCED', 'someone-else');
  expect((await readLocalHistoryPage(database, null, context)).items.map(item => item.sessionId)).toEqual(['boundary', 'pending']);
});

test('cloud cache is durable, idempotent and never creates sessions or outbox events', async () => {
  await cacheCloudHistory(database, [cloudEntry('cloud')]);
  await cacheCloudHistory(database, [cloudEntry('cloud')]);
  expect((await readLocalHistoryPage(database, null, context)).items).toHaveLength(1);
  expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM sessions')).toEqual({ count: 0 });
  expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM sync_outbox')).toEqual({ count: 0 });
  await migrateLocalDatabase(database);
  expect((await readLocalHistoryPage(database, null, context)).items[0]).toMatchObject({ sessionId: 'cloud', penaltyScore: 13 });
});

test('Local Premium cannot bypass the cloud retention cutoff', async () => {
  const old = new Date(context.nowUtcMs - FREE_HISTORY_WINDOW_MS - 1).toISOString();
  await seedLocal('local-old', old, 'SYNCED');
  await cacheCloudHistory(database, [cloudEntry('cloud-old', old)]);
  const localPremium = await readLocalHistoryPage(database, null, { ...context, localPremium: true });
  expect(localPremium.items.map(item => item.sessionId)).toEqual(['local-old']);
  const serverPremium = await readLocalHistoryPage(database, null, { ...context, serverPremium: true });
  expect(serverPremium.items.map(item => item.sessionId)).toEqual(['cloud-old']);
});

test('same-time cursor pagination does not skip or duplicate sessions', async () => {
  await cacheCloudHistory(database, Array.from({ length: 45 }, (_, index) => cloudEntry(`session-${String(index).padStart(3, '0')}`)));
  const first = await readLocalHistoryPage(database, null, context);
  const second = await readLocalHistoryPage(database, first.cursor, context);
  const third = await readLocalHistoryPage(database, second.cursor, context);
  const all = [...first.items, ...second.items, ...third.items];
  expect(all).toHaveLength(45);
  expect(new Set(all.map(item => item.sessionId)).size).toBe(45);
  expect([first.hasMore, second.hasMore, third.hasMore]).toEqual([true, true, false]);
});

test('pending local data wins over duplicate cloud cache', async () => {
  const cloud = cloudEntry('same');
  await seedLocal('same', cloud.completedAt, 'PENDING');
  await cacheCloudHistory(database, [cloud]);
  const result = await readLocalHistoryPage(database, null, context);
  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({ syncStatus: 'pending', penaltyScore: 0, mode: 'COUNTDOWN' });
});
