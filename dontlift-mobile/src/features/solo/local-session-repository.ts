import * as Crypto from 'expo-crypto';
import type * as SQLite from 'expo-sqlite';
import { getLocalDatabase } from '../local/database';
import { updateViolationRecordedEvent } from '../sync/outbox-repository';
import type {
  SoloSession,
  SoloSessionMode,
  SoloSessionRepositoryPort,
  SoloSessionStartResult,
} from './session-controller';

type StartOrResumeInput = {
  userId: string;
  mode: SoloSessionMode;
  durationSeconds: number;
};

type RepositoryDependencies = {
  createId: () => string;
  now: () => Date;
};

type SessionRow = {
  id: string;
  user_id: string;
  mode: SoloSessionMode;
  duration_seconds: number;
  started_at: string;
};

const defaultDependencies: RepositoryDependencies = {
  createId: () => Crypto.randomUUID(),
  now: () => new Date(),
};

function toSoloSession(row: SessionRow): SoloSession {
  return {
    id: row.id,
    userId: row.user_id,
    mode: row.mode,
    durationSeconds: row.duration_seconds,
    startedAt: row.started_at,
  };
}

export async function startOrResumeLocalSession(
  database: SQLite.SQLiteDatabase,
  input: StartOrResumeInput,
  dependencies: RepositoryDependencies = defaultDependencies,
): Promise<SoloSessionStartResult> {
  let result: SoloSessionStartResult | undefined;

  await database.withExclusiveTransactionAsync(async (transaction) => {
    // Đọc và tạo trong cùng transaction để hai lần chạm Start không sinh hai session ACTIVE.
    const active = await transaction.getFirstAsync<SessionRow>(
      `SELECT id, user_id, mode, duration_seconds, started_at
       FROM sessions
       WHERE user_id = ? AND mode IN ('COUNTDOWN', 'STOPWATCH') AND status = 'ACTIVE'
       LIMIT 1`,
      input.userId,
    );

    if (active) {
      result = { session: toSoloSession(active), resumed: true };
      return;
    }

    const startedAt = dependencies.now().toISOString();
    const id = dependencies.createId();
    await transaction.runAsync(
      `INSERT INTO sessions (id, user_id, mode, status, duration_seconds, started_at)
       VALUES (?, ?, ?, 'ACTIVE', ?, ?)`,
      id,
      input.userId,
      input.mode,
      input.durationSeconds,
      startedAt,
    );
    result = {
      session: {
        id,
        userId: input.userId,
        mode: input.mode,
        durationSeconds: input.durationSeconds,
        startedAt,
      },
      resumed: false,
    };
  });

  if (!result) throw new Error('Local Solo session transaction completed without a result.');
  return result;
}

export async function cancelActiveLocalSession(
  database: SQLite.SQLiteDatabase,
  input: { userId: string; sessionId: string },
): Promise<boolean> {
  let cancelled = false;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const session = await transaction.getFirstAsync<{ id: string }>(
      `SELECT id FROM sessions
       WHERE id = ? AND user_id = ? AND mode IN ('COUNTDOWN', 'STOPWATCH') AND status = 'ACTIVE'`,
      input.sessionId,
      input.userId,
    );
    if (!session) return;

    const cancelledAtUtcMs = Date.now();
    const cancelledAt = new Date(cancelledAtUtcMs).toISOString();
    const openViolations = await transaction.getAllAsync<{
      event_id: string;
      started_at: string;
    }>(
      `SELECT event_id, started_at FROM violation_logs
       WHERE session_id = ? AND user_id = ? AND ended_at IS NULL`,
      input.sessionId,
      input.userId,
    );
    for (const violation of openViolations) {
      const startedAtUtcMs = Date.parse(violation.started_at);
      if (!Number.isFinite(startedAtUtcMs)) throw new Error('Violation timestamp is invalid.');
      const endedAtUtcMs = Math.max(startedAtUtcMs, cancelledAtUtcMs);
      const durationSeconds = Math.floor((endedAtUtcMs - startedAtUtcMs) / 1_000);
      const updated = await transaction.runAsync(
        `UPDATE violation_logs SET ended_at = ?, duration_seconds = ?
         WHERE event_id = ? AND ended_at IS NULL`,
        new Date(endedAtUtcMs).toISOString(),
        durationSeconds,
        violation.event_id,
      );
      if (updated.changes !== 1) throw new Error('Active violation could not be closed while canceling the session.');
      await updateViolationRecordedEvent(transaction, {
        eventId: violation.event_id,
        startedAtUtcMs,
        endedAtUtcMs,
        durationSeconds,
      });
    }

    // Session và violation cùng commit; lỗi ghi hủy sẽ giữ nguyên violation ACTIVE để retry.
    const result = await transaction.runAsync(
      `UPDATE sessions SET status = 'CANCELLED', completed_at = ?
       WHERE id = ? AND user_id = ? AND mode IN ('COUNTDOWN', 'STOPWATCH') AND status = 'ACTIVE'`,
      cancelledAt,
      input.sessionId,
      input.userId,
    );
    cancelled = result.changes === 1;
  });
  return cancelled;
}

export function createLocalSessionRepository(): SoloSessionRepositoryPort {
  return {
    async startOrResume(input) {
      const database = await getLocalDatabase();
      return startOrResumeLocalSession(database, input);
    },
    async cancelActive(input) {
      const database = await getLocalDatabase();
      return cancelActiveLocalSession(database, input);
    },
  };
}
