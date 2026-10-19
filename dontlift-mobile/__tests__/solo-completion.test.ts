import type * as SQLite from 'expo-sqlite';
const fileSystem = require('node:fs') as {
  mkdtempSync: (prefix: string) => string;
  rmSync: (path: string, options: { recursive: boolean; force: boolean }) => void;
};
const operatingSystem = require('node:os') as { tmpdir: () => string };
const path = require('node:path') as { join: (...parts: string[]) => string };
import { migrateLocalDatabase } from '../src/features/local/migrations';
import {
  completeSoloSession,
  getCompletedSoloSessionSummary,
} from '../src/features/solo/summary-service';
import { createSoloSessionCompletionController } from '../src/features/solo/session-completion-controller';

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
  execAsync: (sql: string) => Promise<void>;
  getFirstAsync: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
  runAsync: (sql: string, ...params: unknown[]) => Promise<{ changes: number }>;
  withExclusiveTransactionAsync: (task: (transaction: TestDatabase) => Promise<void>) => Promise<void>;
  closeAsync: () => Promise<void>;
};

function createDatabase(databasePath = ':memory:') {
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (path: string) => NativeDatabase;
  };
  const native = new DatabaseSync(databasePath);
  const database: TestDatabase = {
    async execAsync(sql: string) { native.exec(sql); },
    async getFirstAsync<T>(sql: string, ...params: unknown[]) {
      return (native.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]) {
      return native.prepare(sql).all(...params) as T[];
    },
    async runAsync(sql, ...params) {
      return native.prepare(sql).run(...params);
    },
    async withExclusiveTransactionAsync(task) {
      native.exec('BEGIN EXCLUSIVE');
      try {
        await task(database);
        native.exec('COMMIT');
      } catch (error) {
        native.exec('ROLLBACK');
        throw error;
      }
    },
    async closeAsync() { native.close(); },
  } as TestDatabase;
  return { database, native };
}

async function insertActiveSession(
  database: TestDatabase,
  input: { mode: 'COUNTDOWN' | 'STOPWATCH'; durationSeconds: number; startedAt: string },
) {
  await database.runAsync(
    `INSERT INTO sessions (id, user_id, mode, status, duration_seconds, started_at)
     VALUES ('session-1', 'user-1', ?, 'ACTIVE', ?, ?)`,
    input.mode,
    input.durationSeconds,
    input.startedAt,
  );
}

async function insertViolation(database: TestDatabase, input: {
  eventId: string;
  startedAtUtcMs: number;
  endedAtUtcMs: number | null;
  durationSeconds: number;
}) {
  const startedAt = new Date(input.startedAtUtcMs).toISOString();
  const endedAt = input.endedAtUtcMs === null ? null : new Date(input.endedAtUtcMs).toISOString();
  await database.runAsync(
    `INSERT INTO violation_logs (
       event_id, session_id, room_id, user_id, started_at, ended_at,
       duration_seconds, sync_status, created_at, synced_at
     ) VALUES (?, 'session-1', NULL, 'user-1', ?, ?, ?, 'PENDING', ?, NULL)`,
    input.eventId,
    startedAt,
    endedAt,
    input.durationSeconds,
    startedAt,
  );
}

describe('Solo session completion', () => {
  test('saves early-stop duration and summary in one transaction, then reloads it offline', async () => {
    const directory = fileSystem.mkdtempSync(path.join(operatingSystem.tmpdir(), 'dontlift-solo-summary-'));
    const databasePath = path.join(directory, 'solo.db');
    const { database } = createDatabase(databasePath);
    await migrateLocalDatabase(database);
    const startedAt = Date.parse('2026-10-18T10:00:00.000Z');
    await insertActiveSession(database, {
      mode: 'STOPWATCH', durationSeconds: 0, startedAt: new Date(startedAt).toISOString(),
    });
    await insertViolation(database, {
      eventId: 'violation-1', startedAtUtcMs: startedAt + 5_000,
      endedAtUtcMs: startedAt + 17_000, durationSeconds: 12,
    });

    const summary = await completeSoloSession(database, {
      userId: 'user-1', sessionId: 'session-1', completedAtUtcMs: startedAt + 154_000,
    });

    expect(summary).toMatchObject({
      sessionId: 'session-1', mode: 'STOPWATCH', durationSeconds: 154,
      liftCount: 1, violationDurationSeconds: 12, penaltyScore: 22,
    });
    expect(await getCompletedSoloSessionSummary(database, { userId: 'user-1', sessionId: 'session-1' }))
      .toEqual(summary);
    expect(await database.getFirstAsync('SELECT status, duration_seconds FROM sessions WHERE id = ?', 'session-1'))
      .toEqual({ status: 'COMPLETED', duration_seconds: 154 });
    const completionEvent = await database.getFirstAsync<{ event_id: string; event_type: string; payload_json: string }>(
      `SELECT event_id, event_type, payload_json FROM sync_outbox WHERE event_type = 'SOLO_SESSION_COMPLETED'`,
    );
    expect(completionEvent?.event_id).toBe('session-1');
    expect(JSON.parse(completionEvent?.payload_json ?? '{}')).toMatchObject({
      durationSeconds: 154, liftCount: 1, violationDurationSeconds: 12, penaltyScore: 22,
    });
    await database.runAsync(
      `INSERT INTO sessions (id, user_id, mode, status, duration_seconds, started_at)
       VALUES ('session-2', 'user-1', 'STOPWATCH', 'ACTIVE', 0, ?)`,
      new Date(startedAt + 200_000).toISOString(),
    );
    expect(await getCompletedSoloSessionSummary(database, { userId: 'user-1', sessionId: 'session-1' }))
      .toEqual(summary);
    // Worker có thể đã ACK và dọn outbox; domain rows vẫn đủ để dựng lại summary.
    await database.runAsync("DELETE FROM sync_outbox WHERE event_type = 'SOLO_SESSION_COMPLETED'");
    await database.closeAsync();
    const reopened = createDatabase(databasePath).database;
    expect(await getCompletedSoloSessionSummary(reopened, { userId: 'user-1', sessionId: 'session-1' }))
      .toEqual(summary);
    expect(await reopened.getFirstAsync('SELECT id FROM sessions WHERE status = \'COMPLETED\' AND id = ?', 'session-1'))
      .toEqual({ id: 'session-1' });
    await reopened.closeAsync();
    fileSystem.rmSync(directory, { recursive: true, force: true });
  });

  test('caps an overdue countdown at its configured duration and closes an open violation at that cutoff', async () => {
    const { database } = createDatabase();
    await migrateLocalDatabase(database);
    const startedAt = Date.parse('2026-10-18T10:00:00.000Z');
    await insertActiveSession(database, {
      mode: 'COUNTDOWN', durationSeconds: 300, startedAt: new Date(startedAt).toISOString(),
    });
    await insertViolation(database, {
      eventId: 'violation-open', startedAtUtcMs: startedAt + 290_000,
      endedAtUtcMs: null, durationSeconds: 3,
    });

    const summary = await completeSoloSession(database, {
      userId: 'user-1', sessionId: 'session-1', completedAtUtcMs: startedAt + 330_000,
    });

    expect(summary).toMatchObject({
      durationSeconds: 300, liftCount: 1, violationDurationSeconds: 10, penaltyScore: 20,
      completedAt: new Date(startedAt + 300_000).toISOString(),
    });
    expect(await database.getFirstAsync('SELECT ended_at, duration_seconds FROM violation_logs WHERE event_id = ?', 'violation-open'))
      .toEqual({ ended_at: new Date(startedAt + 300_000).toISOString(), duration_seconds: 10 });
    await database.closeAsync();
  });

  test('returns the same summary for duplicate completion and does not enqueue a duplicate event', async () => {
    const { database } = createDatabase();
    await migrateLocalDatabase(database);
    const startedAt = Date.parse('2026-10-18T10:00:00.000Z');
    await insertActiveSession(database, {
      mode: 'STOPWATCH', durationSeconds: 0, startedAt: new Date(startedAt).toISOString(),
    });

    const first = await completeSoloSession(database, {
      userId: 'user-1', sessionId: 'session-1', completedAtUtcMs: startedAt + 30_000,
    });
    const duplicate = await completeSoloSession(database, {
      userId: 'user-1', sessionId: 'session-1', completedAtUtcMs: startedAt + 45_000,
    });

    expect(duplicate).toEqual(first);
    expect(await database.getFirstAsync(
      "SELECT COUNT(*) AS count FROM sync_outbox WHERE event_type = 'SOLO_SESSION_COMPLETED'",
    )).toEqual({ count: 1 });
    await database.closeAsync();
  });

  test('rolls session completion back if the summary outbox insert fails', async () => {
    const { database, native } = createDatabase();
    await migrateLocalDatabase(database);
    const startedAt = Date.parse('2026-10-18T10:00:00.000Z');
    await insertActiveSession(database, {
      mode: 'STOPWATCH', durationSeconds: 0, startedAt: new Date(startedAt).toISOString(),
    });
    await insertViolation(database, {
      eventId: 'violation-open', startedAtUtcMs: startedAt + 5_000,
      endedAtUtcMs: null, durationSeconds: 3,
    });
    native.exec(`CREATE TRIGGER reject_solo_summary BEFORE INSERT ON sync_outbox
      WHEN NEW.event_type = 'SOLO_SESSION_COMPLETED' BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END;`);

    await expect(completeSoloSession(database, {
      userId: 'user-1', sessionId: 'session-1', completedAtUtcMs: startedAt + 30_000,
    })).rejects.toThrow('outbox unavailable');
    expect(await database.getFirstAsync('SELECT status, completed_at FROM sessions WHERE id = ?', 'session-1'))
      .toEqual({ status: 'ACTIVE', completed_at: null });
    expect(await database.getFirstAsync('SELECT ended_at, duration_seconds FROM violation_logs WHERE event_id = ?', 'violation-open'))
      .toEqual({ ended_at: null, duration_seconds: 3 });
    expect(await database.getFirstAsync(
      "SELECT COUNT(*) AS count FROM sync_outbox WHERE event_type = 'SOLO_SESSION_COMPLETED'",
    )).toEqual({ count: 0 });
    await database.closeAsync();
  });

  test('does not award a violation score to a clean session', async () => {
    const { database } = createDatabase();
    await migrateLocalDatabase(database);
    const startedAt = Date.parse('2026-10-18T10:00:00.000Z');
    await insertActiveSession(database, {
      mode: 'COUNTDOWN', durationSeconds: 300, startedAt: new Date(startedAt).toISOString(),
    });

    const summary = await completeSoloSession(database, {
      userId: 'user-1', sessionId: 'session-1', completedAtUtcMs: startedAt + 300_000,
    });

    expect(summary).toMatchObject({ durationSeconds: 300, liftCount: 0, violationDurationSeconds: 0, penaltyScore: 0 });
    await database.closeAsync();
  });

  test('does not create a completion summary for a canceled session', async () => {
    const { database } = createDatabase();
    await migrateLocalDatabase(database);
    const startedAt = Date.parse('2026-10-18T10:00:00.000Z');
    await insertActiveSession(database, {
      mode: 'STOPWATCH', durationSeconds: 0, startedAt: new Date(startedAt).toISOString(),
    });
    await database.runAsync("UPDATE sessions SET status = 'CANCELLED' WHERE id = 'session-1'");

    await expect(completeSoloSession(database, {
      userId: 'user-1', sessionId: 'session-1', completedAtUtcMs: startedAt + 30_000,
    })).rejects.toThrow('Only an active Solo session can be completed.');
    expect(await database.getFirstAsync(
      "SELECT COUNT(*) AS count FROM sync_outbox WHERE event_type = 'SOLO_SESSION_COMPLETED'",
    )).toEqual({ count: 0 });
    await database.closeAsync();
  });

  test('coalesces simultaneous completion requests for one session', async () => {
    const summary = {
      sessionId: 'session-1', userId: 'user-1', mode: 'STOPWATCH' as const,
      durationSeconds: 20, liftCount: 0, violationDurationSeconds: 0,
      penaltyScore: 0, startedAt: 'start', completedAt: 'end',
    };
    let resolveCompletion: ((value: typeof summary) => void) | undefined;
    const repository = {
      complete: jest.fn(() => new Promise<typeof summary>((resolve) => { resolveCompletion = resolve; })),
      get: jest.fn(async () => summary),
    };
    const controller = createSoloSessionCompletionController(repository);
    const input = { userId: 'user-1', sessionId: 'session-1', completedAtUtcMs: 20_000 };

    const first = controller.complete(input);
    const duplicate = controller.complete({ ...input, completedAtUtcMs: 25_000 });
    expect(duplicate).toBe(first);
    expect(repository.complete).toHaveBeenCalledTimes(1);
    resolveCompletion?.(summary);
    await expect(first).resolves.toEqual(summary);
  });
});
