import * as Crypto from 'expo-crypto';
import type * as SQLite from 'expo-sqlite';
import { getLocalDatabase } from '../local/database';
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
    // UID và ID cùng ràng buộc câu UPDATE để không hủy nhầm phiên của tài khoản khác.
    const result = await transaction.runAsync(
      `UPDATE sessions
       SET status = 'CANCELLED', completed_at = ?
       WHERE id = ? AND user_id = ? AND mode IN ('COUNTDOWN', 'STOPWATCH') AND status = 'ACTIVE'`,
      new Date().toISOString(),
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
