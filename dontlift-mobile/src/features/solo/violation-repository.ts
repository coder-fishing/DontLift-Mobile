import * as Crypto from 'expo-crypto';
import type * as SQLite from 'expo-sqlite';
import { getLocalDatabase } from '../local/database';
import { enqueueViolationRecorded, updateViolationRecordedEvent } from '../sync/outbox-repository';
import type { ActiveViolation } from './grace-period-engine';

export type ViolationRecord = {
  eventId: string;
  sessionId: string;
  startedAtUtcMs: number;
  endedAtUtcMs: number | null;
  durationSeconds: number;
};

export type ViolationSummary = {
  count: number;
  durationSeconds: number;
};

type ViolationRepositoryDependencies = {
  createId: () => string;
  now: () => number;
};

const defaultDependencies: ViolationRepositoryDependencies = {
  createId: () => Crypto.randomUUID(),
  now: () => Date.now(),
};

export async function recordViolationStart(
  database: SQLite.SQLiteDatabase,
  input: { sessionId: string; userId: string; startedAtUtcMs: number; confirmedAtUtcMs: number },
  dependencies: ViolationRepositoryDependencies = defaultDependencies,
): Promise<ViolationRecord> {
  const eventId = dependencies.createId();
  const createdAt = new Date(dependencies.now()).toISOString();
  const confirmedAtUtcMs = Math.max(input.startedAtUtcMs + 3_000, input.confirmedAtUtcMs);
  const confirmedAt = new Date(confirmedAtUtcMs).toISOString();
  const durationSeconds = Math.floor((confirmedAtUtcMs - input.startedAtUtcMs) / 1_000);

  await database.withExclusiveTransactionAsync(async (transaction) => {
    // Domain record và outbox luôn commit cùng nhau để không có violation bị mất đường sync.
    await transaction.runAsync(
      `INSERT INTO violation_logs (
         event_id, session_id, room_id, user_id, started_at, confirmed_at, ended_at,
         duration_seconds, sync_status, created_at, synced_at
       ) VALUES (?, ?, NULL, ?, ?, ?, NULL, ?, 'PENDING', ?, NULL)`,
      eventId,
      input.sessionId,
      input.userId,
      new Date(input.startedAtUtcMs).toISOString(),
      confirmedAt,
      durationSeconds,
      createdAt,
    );
    await enqueueViolationRecorded(transaction, {
      eventId,
      sessionId: input.sessionId,
      actorUid: input.userId,
      startedAtUtcMs: input.startedAtUtcMs,
      endedAtUtcMs: confirmedAtUtcMs,
      durationSeconds,
      createdAt,
    });
  });

  return {
    eventId,
    sessionId: input.sessionId,
    startedAtUtcMs: input.startedAtUtcMs,
    endedAtUtcMs: null,
    durationSeconds,
  };
}

export async function endViolation(
  database: SQLite.SQLiteDatabase,
  input: { eventId: string; endedAtUtcMs: number },
): Promise<boolean> {
  let ended = false;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const row = await transaction.getFirstAsync<{
      session_id: string;
      user_id: string;
      started_at: string;
      ended_at: string | null;
    }>(
      `SELECT session_id, user_id, started_at, ended_at
       FROM violation_logs WHERE event_id = ?`,
      input.eventId,
    );
    if (!row || row.ended_at !== null) return;

    const startedAtUtcMs = Date.parse(row.started_at);
    const endedAtUtcMs = Math.max(startedAtUtcMs, input.endedAtUtcMs);
    const durationSeconds = Math.floor((endedAtUtcMs - startedAtUtcMs) / 1_000);
    const result = await transaction.runAsync(
      `UPDATE violation_logs SET ended_at = ?, duration_seconds = ?
       WHERE event_id = ? AND ended_at IS NULL`,
      new Date(endedAtUtcMs).toISOString(),
      durationSeconds,
      input.eventId,
    );
    if (result.changes !== 1) return;

    await updateViolationRecordedEvent(transaction, {
      eventId: input.eventId,
      startedAtUtcMs,
      endedAtUtcMs,
      durationSeconds,
    });
    ended = true;
  });
  return ended;
}

export async function getViolationSummary(
  database: SQLite.SQLiteDatabase,
  sessionId: string,
): Promise<ViolationSummary> {
  const row = await database.getFirstAsync<{ count: number; duration_seconds: number | null }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(duration_seconds), 0) AS duration_seconds
     FROM violation_logs WHERE session_id = ?`,
    sessionId,
  );
  return { count: row?.count ?? 0, durationSeconds: row?.duration_seconds ?? 0 };
}

export async function getActiveViolation(
  database: SQLite.SQLiteDatabase,
  input: { sessionId: string; userId: string },
): Promise<ActiveViolation | null> {
  const row = await database.getFirstAsync<{
    event_id: string;
    started_at: string;
    confirmed_at: string | null;
  }>(
    `SELECT event_id, started_at, confirmed_at
     FROM violation_logs WHERE session_id = ? AND user_id = ? AND ended_at IS NULL
     ORDER BY started_at ASC LIMIT 1`,
    input.sessionId,
    input.userId,
  );
  if (!row || !row.confirmed_at) return null;
  const startedAtUtcMs = Date.parse(row.started_at);
  const confirmedAtUtcMs = Date.parse(row.confirmed_at);
  if (!Number.isFinite(startedAtUtcMs) || !Number.isFinite(confirmedAtUtcMs)) {
    throw new Error('Open violation timestamps are invalid.');
  }
  return { eventId: row.event_id, startedAtUtcMs, confirmedAtUtcMs };
}

export function createViolationRepository(dependencies: ViolationRepositoryDependencies = defaultDependencies) {
  return {
    async start(input: { sessionId: string; userId: string; startedAtUtcMs: number; confirmedAtUtcMs: number }) {
      return recordViolationStart(await getLocalDatabase(), input, dependencies);
    },
    async end(input: { eventId: string; endedAtUtcMs: number }) {
      return endViolation(await getLocalDatabase(), input);
    },
    async getSummary(sessionId: string) {
      return getViolationSummary(await getLocalDatabase(), sessionId);
    },
    async getActive(input: { sessionId: string; userId: string }) {
      return getActiveViolation(await getLocalDatabase(), input);
    },
  };
}
