import type * as SQLite from 'expo-sqlite';
import { migrateLocalDatabase } from '../src/features/local/migrations';
import {
  beginBackgroundCandidate,
  reconcileBackgroundCandidate,
} from '../src/features/solo/android-background-recovery';
import { getActiveViolation } from '../src/features/solo/violation-repository';

type NativeStatement = {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
  run: (...params: unknown[]) => { changes: number };
};

type NativeDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => NativeStatement;
  close: () => void;
};

type TestDatabase = SQLite.SQLiteDatabase & {
  closeAsync: () => Promise<void>;
};

type FileSystem = {
  mkdtempSync: (prefix: string) => string;
  rmSync: (path: string, options: { recursive: boolean; force: boolean }) => void;
};
type PathModule = { join: (...parts: string[]) => string };
type OsModule = { tmpdir: () => string };

const fileSystem = require('fs') as FileSystem;
const path = require('path') as PathModule;
const operatingSystem = require('os') as OsModule;
let database: TestDatabase;
let directory: string;
let failOutboxInsert = false;

function openDatabase(file: string): TestDatabase {
  const DatabaseSync = (require('node:sqlite') as { DatabaseSync: new (file: string) => NativeDatabase }).DatabaseSync;
  const native = new DatabaseSync(file);
  const wrapper = {
    async execAsync(sql: string) { native.exec(sql); },
    async getFirstAsync<T>(sql: string, ...params: unknown[]) {
      return (native.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]) {
      return native.prepare(sql).all(...params) as T[];
    },
    async runAsync(sql: string, ...params: unknown[]) {
      if (failOutboxInsert && sql.includes('INSERT INTO sync_outbox')) {
        throw new Error('Injected outbox insert failure');
      }
      return native.prepare(sql).run(...params);
    },
    async withExclusiveTransactionAsync(task: (transaction: SQLite.SQLiteDatabase) => Promise<void>) {
      native.exec('BEGIN EXCLUSIVE');
      try {
        await task(wrapper as unknown as SQLite.SQLiteDatabase);
        native.exec('COMMIT');
      } catch (error) {
        native.exec('ROLLBACK');
        throw error;
      }
    },
    async closeAsync() { native.close(); },
  };
  return wrapper as unknown as TestDatabase;
}

async function seedSession(input?: { mode?: 'COUNTDOWN' | 'STOPWATCH'; durationSeconds?: number; startedAtUtcMs?: number }) {
  const mode = input?.mode ?? 'STOPWATCH';
  const startedAtUtcMs = input?.startedAtUtcMs ?? Date.parse('2026-10-18T00:00:00.000Z');
  await database.runAsync(
    `INSERT INTO sessions (id, user_id, mode, status, duration_seconds, started_at)
     VALUES ('session-1', 'user-1', ?, 'ACTIVE', ?, ?)`,
    mode,
    input?.durationSeconds ?? 0,
    new Date(startedAtUtcMs).toISOString(),
  );
  return startedAtUtcMs;
}

function createClock(overrides?: Partial<{
  utc: number;
  monotonic: number;
  processId: string;
  id: string;
}>) {
  const clock = {
    utc: Date.parse('2026-10-18T01:00:00.000Z'),
    monotonic: 10_000,
    processId: 'process-1',
    id: 'candidate-1',
    ...overrides,
  };
  return {
    clock,
    dependencies: {
      createId: () => clock.id,
      nowUtcMs: () => clock.utc,
      nowMonotonicMs: () => clock.monotonic,
      processInstanceId: clock.processId,
    },
  };
}

beforeEach(async () => {
  directory = fileSystem.mkdtempSync(path.join(operatingSystem.tmpdir(), 'dontlift-android-recovery-'));
  database = openDatabase(path.join(directory, 'test.db'));
  failOutboxInsert = false;
  await migrateLocalDatabase(database);
});

afterEach(async () => {
  if (database) await database.closeAsync();
  fileSystem.rmSync(directory, { recursive: true, force: true });
});

describe('Expo Go Android background recovery', () => {
  test('cancels a background candidate shorter than the three-second grace period', async () => {
    await seedSession();
    const { clock, dependencies } = createClock();
    await beginBackgroundCandidate(database, { sessionId: 'session-1', userId: 'user-1' }, dependencies);
    clock.utc += 2_000;
    clock.monotonic += 2_000;

    await expect(reconcileBackgroundCandidate(database, { sessionId: 'session-1', userId: 'user-1' }, dependencies))
      .resolves.toBe('cancelled');
    expect(await database.getFirstAsync('SELECT state FROM lifecycle_candidates')).toEqual({ state: 'CANCELLED' });
    expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM violation_logs')).toEqual({ count: 0 });
  });

  test('confirms exactly once at three seconds and commits its outbox event atomically', async () => {
    await seedSession();
    const { clock, dependencies } = createClock();
    const input = { sessionId: 'session-1', userId: 'user-1' };
    const candidateId = await beginBackgroundCandidate(database, input, dependencies);
    const repeatedId = await beginBackgroundCandidate(database, input, dependencies);
    expect(repeatedId).toBe(candidateId);
    clock.utc += 3_000;
    clock.monotonic += 3_000;

    await expect(reconcileBackgroundCandidate(database, input, dependencies)).resolves.toBe('confirmed');
    await expect(reconcileBackgroundCandidate(database, input, dependencies)).resolves.toBe('none');
    expect(await database.getFirstAsync('SELECT event_id, duration_seconds FROM violation_logs'))
      .toEqual({ event_id: 'candidate-1', duration_seconds: 0 });
    expect(await database.getFirstAsync("SELECT event_id, event_type FROM sync_outbox WHERE event_type = 'VIOLATION_RECORDED'"))
      .toEqual({ event_id: 'candidate-1', event_type: 'VIOLATION_RECORDED' });
  });

  test('reconciles a persisted candidate after a JavaScript process restart using UTC', async () => {
    await seedSession();
    const firstProcess = createClock();
    await beginBackgroundCandidate(database, { sessionId: 'session-1', userId: 'user-1' }, firstProcess.dependencies);
    const restartedProcess = createClock({
      utc: firstProcess.clock.utc + 4_000,
      monotonic: 500,
      processId: 'process-2',
      id: 'unused-candidate',
    });

    await expect(reconcileBackgroundCandidate(
      database,
      { sessionId: 'session-1', userId: 'user-1' },
      restartedProcess.dependencies,
    )).resolves.toBe('confirmed');
    expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM violation_logs')).toEqual({ count: 1 });
  });

  test('cancels a candidate when the app restarts before the grace period expires', async () => {
    await seedSession();
    const firstProcess = createClock();
    const input = { sessionId: 'session-1', userId: 'user-1' };
    await beginBackgroundCandidate(database, input, firstProcess.dependencies);
    const restartedProcess = createClock({
      utc: firstProcess.clock.utc + 2_000,
      monotonic: 500,
      processId: 'process-2',
    });

    await expect(reconcileBackgroundCandidate(database, input, restartedProcess.dependencies)).resolves.toBe('cancelled');
    expect(await database.getFirstAsync('SELECT state FROM lifecycle_candidates')).toEqual({ state: 'CANCELLED' });
    expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM violation_logs')).toEqual({ count: 0 });
  });

  test('does not assign a violation when the device clock moved backwards', async () => {
    await seedSession();
    const { clock, dependencies } = createClock();
    await beginBackgroundCandidate(database, { sessionId: 'session-1', userId: 'user-1' }, dependencies);
    clock.utc -= 1_000;
    clock.monotonic += 4_000;

    await expect(reconcileBackgroundCandidate(database, { sessionId: 'session-1', userId: 'user-1' }, dependencies))
      .resolves.toBe('needs-review');
    expect(await database.getFirstAsync('SELECT state FROM lifecycle_candidates')).toEqual({ state: 'NEEDS_REVIEW' });
    expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM violation_logs')).toEqual({ count: 0 });
  });

  test('loads the open foreground violation so restart recovery continues one lift', async () => {
    await seedSession();
    await database.runAsync(
      `INSERT INTO violation_logs (
         event_id, session_id, room_id, user_id, started_at, confirmed_at, ended_at,
         duration_seconds, sync_status, created_at, synced_at
       ) VALUES ('open-event', 'session-1', NULL, 'user-1', ?, ?, NULL, 3, 'PENDING', ?, NULL)`,
      new Date(10_000).toISOString(),
      new Date(13_000).toISOString(),
      new Date(13_000).toISOString(),
    );

    await expect(getActiveViolation(database, { sessionId: 'session-1', userId: 'user-1' }))
      .resolves.toEqual({ eventId: 'open-event', startedAtUtcMs: 10_000, confirmedAtUtcMs: 13_000 });
  });

  test('rolls candidate and violation writes back if the outbox insert fails', async () => {
    await seedSession();
    const { clock, dependencies } = createClock();
    const input = { sessionId: 'session-1', userId: 'user-1' };
    await beginBackgroundCandidate(database, input, dependencies);
    clock.utc += 4_000;
    clock.monotonic += 4_000;
    failOutboxInsert = true;

    await expect(reconcileBackgroundCandidate(database, input, dependencies)).rejects.toThrow('Injected outbox insert failure');
    expect(await database.getFirstAsync('SELECT state FROM lifecycle_candidates')).toEqual({ state: 'PENDING' });
    expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM violation_logs')).toEqual({ count: 0 });
  });

  test('clamps a background violation to the countdown end', async () => {
    const startedAtUtcMs = Date.parse('2026-10-18T01:00:00.000Z');
    await seedSession({ mode: 'COUNTDOWN', durationSeconds: 150, startedAtUtcMs });
    const { clock, dependencies } = createClock({ utc: startedAtUtcMs + 148_000 });
    const input = { sessionId: 'session-1', userId: 'user-1' };
    await beginBackgroundCandidate(database, input, dependencies);
    clock.utc += 10_000;
    clock.monotonic += 10_000;

    await expect(reconcileBackgroundCandidate(database, input, dependencies)).resolves.toBe('cancelled');
    expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM violation_logs')).toEqual({ count: 0 });
  });
});
