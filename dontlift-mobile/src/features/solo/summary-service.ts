import type * as SQLite from 'expo-sqlite';
import { getLocalDatabase } from '../local/database';
import {
  enqueueSoloSessionCompleted,
  updateViolationRecordedEvent,
} from '../sync/outbox-repository';

export type SoloSessionSummary = {
  sessionId: string;
  userId: string;
  mode: 'COUNTDOWN' | 'STOPWATCH';
  durationSeconds: number;
  liftCount: number;
  violationDurationSeconds: number;
  penaltyScore: number;
  startedAt: string;
  completedAt: string;
};

type ActiveSessionRow = {
  id: string;
  user_id: string;
  mode: SoloSessionSummary['mode'];
  duration_seconds: number;
  started_at: string;
  completed_at: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
};

type SummaryDependencies = {
  now: () => number;
};

const defaultDependencies: SummaryDependencies = { now: () => Date.now() };

type ViolationSummaryRow = {
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

async function summarizeViolations(
  database: SQLite.SQLiteDatabase,
  input: { sessionId: string; userId: string; startedAt: string; completedAt: string },
): Promise<{ count: number; durationSeconds: number }> {
  const sessionStartedAtUtcMs = Date.parse(input.startedAt);
  const completionCutoffUtcMs = Date.parse(input.completedAt);
  if (!Number.isFinite(sessionStartedAtUtcMs) || !Number.isFinite(completionCutoffUtcMs)) {
    throw new Error('Solo session timestamps are invalid.');
  }

  const violations = await database.getAllAsync<ViolationSummaryRow>(
    `SELECT started_at, ended_at, created_at FROM violation_logs
     WHERE session_id = ? AND user_id = ?`,
    input.sessionId,
    input.userId,
  );
  let count = 0;
  let durationSeconds = 0;

  for (const violation of violations) {
    const startedAtUtcMs = Date.parse(violation.started_at);
    const createdAtUtcMs = Date.parse(violation.created_at);
    const endedAtUtcMs = violation.ended_at === null
      ? completionCutoffUtcMs
      : Date.parse(violation.ended_at);
    if (!Number.isFinite(startedAtUtcMs) || !Number.isFinite(createdAtUtcMs) || !Number.isFinite(endedAtUtcMs)) {
      throw new Error('Violation timestamps are invalid.');
    }

    // Chỉ tính vi phạm đã được xác nhận trong phiên và phần thời lượng nằm trước cutoff.
    if (
      createdAtUtcMs > completionCutoffUtcMs
      || startedAtUtcMs >= completionCutoffUtcMs
      || endedAtUtcMs <= sessionStartedAtUtcMs
    ) continue;

    const overlapStartedAtUtcMs = Math.max(startedAtUtcMs, sessionStartedAtUtcMs);
    const overlapEndedAtUtcMs = Math.min(endedAtUtcMs, completionCutoffUtcMs);
    if (overlapEndedAtUtcMs <= overlapStartedAtUtcMs) continue;
    count += 1;
    durationSeconds += Math.floor((overlapEndedAtUtcMs - overlapStartedAtUtcMs) / 1_000);
  }

  return { count, durationSeconds };
}

async function readSummary(
  database: SQLite.SQLiteDatabase,
  input: { userId: string; sessionId: string },
): Promise<SoloSessionSummary | null> {
  const session = await database.getFirstAsync<ActiveSessionRow>(
    `SELECT id, user_id, mode, duration_seconds, started_at, completed_at, status
     FROM sessions WHERE id = ? AND user_id = ?`,
    input.sessionId,
    input.userId,
  );
  if (!session || session.status !== 'COMPLETED' || !session.completed_at) return null;

  const violations = await summarizeViolations(database, {
    sessionId: session.id,
    userId: session.user_id,
    startedAt: session.started_at,
    completedAt: session.completed_at,
  });
  const liftCount = violations.count;
  const violationDurationSeconds = violations.durationSeconds;

  return {
    sessionId: session.id,
    userId: session.user_id,
    mode: session.mode,
    durationSeconds: session.duration_seconds,
    liftCount,
    violationDurationSeconds,
    penaltyScore: liftCount * 10 + violationDurationSeconds,
    startedAt: session.started_at,
    completedAt: session.completed_at,
  };
}

export async function completeSoloSession(
  database: SQLite.SQLiteDatabase,
  input: { userId: string; sessionId: string; completedAtUtcMs: number },
  dependencies: SummaryDependencies = defaultDependencies,
): Promise<SoloSessionSummary> {
  let summary: SoloSessionSummary | null = null;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const session = await transaction.getFirstAsync<ActiveSessionRow>(
      `SELECT id, user_id, mode, duration_seconds, started_at, completed_at, status
       FROM sessions WHERE id = ? AND user_id = ?`,
      input.sessionId,
      input.userId,
    );
    if (!session) throw new Error('Solo session was not found for this account.');

    if (session.status === 'COMPLETED') {
      summary = await readSummary(transaction, input);
      return;
    }
    if (session.status !== 'ACTIVE') throw new Error('Only an active Solo session can be completed.');

    const startedAtUtcMs = Date.parse(session.started_at);
    if (!Number.isFinite(startedAtUtcMs) || !Number.isFinite(input.completedAtUtcMs)) {
      throw new Error('Solo session timestamps are invalid.');
    }
    const requestedCompletionUtcMs = Math.max(startedAtUtcMs, input.completedAtUtcMs);
    const completionCutoffUtcMs = session.mode === 'COUNTDOWN'
      ? Math.min(requestedCompletionUtcMs, startedAtUtcMs + session.duration_seconds * 1_000)
      : requestedCompletionUtcMs;
    const durationSeconds = Math.floor((completionCutoffUtcMs - startedAtUtcMs) / 1_000);
    const completedAt = new Date(completionCutoffUtcMs).toISOString();

    const openViolations = await transaction.getAllAsync<{
      event_id: string;
      started_at: string;
    }>(
      `SELECT event_id, started_at FROM violation_logs
       WHERE session_id = ? AND user_id = ? AND ended_at IS NULL`,
      session.id,
      session.user_id,
    );
    for (const violation of openViolations) {
      const violationStartedAtUtcMs = Date.parse(violation.started_at);
      if (!Number.isFinite(violationStartedAtUtcMs)) throw new Error('Violation timestamp is invalid.');
      const violationEndedAtUtcMs = Math.max(violationStartedAtUtcMs, completionCutoffUtcMs);
      const violationDurationSeconds = Math.floor((violationEndedAtUtcMs - violationStartedAtUtcMs) / 1_000);
      const updated = await transaction.runAsync(
        `UPDATE violation_logs SET ended_at = ?, duration_seconds = ?
         WHERE event_id = ? AND ended_at IS NULL`,
        new Date(violationEndedAtUtcMs).toISOString(),
        violationDurationSeconds,
        violation.event_id,
      );
      if (updated.changes !== 1) throw new Error('Active violation could not be closed at session completion.');
      await updateViolationRecordedEvent(transaction, {
        eventId: violation.event_id,
        startedAtUtcMs: violationStartedAtUtcMs,
        endedAtUtcMs: violationEndedAtUtcMs,
        durationSeconds: violationDurationSeconds,
      });
    }

    const violations = await summarizeViolations(transaction, {
      sessionId: session.id,
      userId: session.user_id,
      startedAt: session.started_at,
      completedAt,
    });
    const liftCount = violations.count;
    const violationDurationSeconds = violations.durationSeconds;
    const penaltyScore = liftCount * 10 + violationDurationSeconds;
    const createdAt = new Date(dependencies.now()).toISOString();

    await enqueueSoloSessionCompleted(transaction, {
      sessionId: session.id,
      actorUid: session.user_id,
      occurredAtUtcMs: completionCutoffUtcMs,
      createdAt,
      payload: {
        durationSeconds,
        liftCount,
        violationDurationSeconds,
        penaltyScore,
        startedAtUtcMs,
        completedAtUtcMs: completionCutoffUtcMs,
      },
    });
    const completed = await transaction.runAsync(
      `UPDATE sessions SET status = 'COMPLETED', duration_seconds = ?, completed_at = ?
       WHERE id = ? AND user_id = ? AND status = 'ACTIVE'`,
      durationSeconds,
      completedAt,
      session.id,
      session.user_id,
    );
    if (completed.changes !== 1) throw new Error('Solo session changed before completion could be saved.');

    summary = {
      sessionId: session.id,
      userId: session.user_id,
      mode: session.mode,
      durationSeconds,
      liftCount,
      violationDurationSeconds,
      penaltyScore,
      startedAt: session.started_at,
      completedAt,
    };
  });

  if (!summary) throw new Error('Solo session completion transaction returned no summary.');
  return summary;
}

export async function getCompletedSoloSessionSummary(
  database: SQLite.SQLiteDatabase,
  input: { userId: string; sessionId: string },
): Promise<SoloSessionSummary | null> {
  let summary: SoloSessionSummary | null = null;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    summary = await readSummary(transaction, input);
  });
  return summary;
}

export function createSoloSummaryRepository(dependencies: SummaryDependencies = defaultDependencies) {
  return {
    async complete(input: { userId: string; sessionId: string; completedAtUtcMs: number }) {
      return completeSoloSession(await getLocalDatabase(), input, dependencies);
    },
    async get(input: { userId: string; sessionId: string }) {
      return getCompletedSoloSessionSummary(await getLocalDatabase(), input);
    },
  };
}
