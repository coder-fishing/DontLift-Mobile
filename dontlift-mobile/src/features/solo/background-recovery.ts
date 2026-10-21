import * as Crypto from 'expo-crypto';
import type * as SQLite from 'expo-sqlite';
import { getLocalDatabase } from '../local/database';

export const BACKGROUND_GRACE_PERIOD_MS = 3_000;
// Các mốc được đọc liên tiếp nên lệch tối đa 1 giây vẫn được xem là sai số nhỏ.
const MAX_CLOCK_DIVERGENCE_MS = 1_000;

export type BackgroundTimestamp = { utcMs: number; monotonicMs: number };
export type BackgroundRecoveryInput = {
  sessionId: string;
  userId: string;
  observedAt?: BackgroundTimestamp;
  // Cutoff server của room hoặc early-exit; background interval không được vượt qua mốc này.
  cutoffUtcMs?: number;
};

type RecoveryDependencies = {
  createId: () => string;
  nowUtcMs: () => number;
  nowMonotonicMs: () => number;
  processInstanceId: string;
};

type CandidateRow = {
  id: string;
  session_id: string;
  user_id: string;
  transition_at_utc_ms: number;
  transition_at_monotonic_ms: number;
  process_instance_id: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  mode: 'COUNTDOWN' | 'STOPWATCH' | 'GROUP';
  duration_seconds: number;
  started_at: string;
  status: string;
};

export type BackgroundRecoveryResult = 'none' | 'cancelled' | 'confirmed' | 'needs-review';

const processInstanceId = Crypto.randomUUID();

function monotonicNowMs(): number {
  const value = globalThis.performance?.now?.();
  return Number.isFinite(value) ? Math.floor(value as number) : Date.now();
}

const defaultDependencies: RecoveryDependencies = {
  createId: () => Crypto.randomUUID(),
  nowUtcMs: () => Date.now(),
  nowMonotonicMs: monotonicNowMs,
  processInstanceId,
};

export async function beginBackgroundCandidate(
  database: SQLite.SQLiteDatabase,
  input: BackgroundRecoveryInput,
  dependencies: RecoveryDependencies = defaultDependencies,
): Promise<string | null> {
  let candidateId: string | null = null;
  const transitionAtUtcMs = input.observedAt?.utcMs ?? dependencies.nowUtcMs();
  const transitionAtMonotonicMs = input.observedAt?.monotonicMs ?? dependencies.nowMonotonicMs();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const session = await transaction.getFirstAsync<{ id: string }>(
      `SELECT id FROM sessions
       WHERE id = ? AND user_id = ? AND mode IN ('COUNTDOWN', 'STOPWATCH', 'GROUP') AND status = 'ACTIVE'`,
      input.sessionId,
      input.userId,
    );
    if (!session) return;
    // Sensor queue có thể vừa commit violation trước transaction này dù snapshot UI chưa cập nhật.
    if (await hasOpenViolation(transaction, input)) return;

    const pending = await transaction.getFirstAsync<{ id: string }>(
      `SELECT id FROM lifecycle_candidates
       WHERE session_id = ? AND user_id = ? AND state = 'PENDING'
       LIMIT 1`,
      input.sessionId,
      input.userId,
    );
    if (pending) {
      candidateId = pending.id;
      return;
    }

    candidateId = dependencies.createId();
    // Candidate được commit ngay ở callback AppState để còn có thể đối chiếu sau khi process bị dừng.
    await transaction.runAsync(
      `INSERT INTO lifecycle_candidates (
         id, session_id, user_id, transition_at_utc_ms, transition_at_monotonic_ms,
         process_instance_id, state, resolved_at_utc_ms
       ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NULL)`,
      candidateId,
      input.sessionId,
      input.userId,
      transitionAtUtcMs,
      transitionAtMonotonicMs,
      dependencies.processInstanceId,
    );
  });
  return candidateId;
}

export async function reconcileBackgroundCandidate(
  database: SQLite.SQLiteDatabase,
  input: BackgroundRecoveryInput,
  dependencies: RecoveryDependencies = defaultDependencies,
): Promise<BackgroundRecoveryResult> {
  let result: BackgroundRecoveryResult = 'none';
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const candidate = await transaction.getFirstAsync<CandidateRow>(
      `SELECT id, session_id, user_id, transition_at_utc_ms, transition_at_monotonic_ms, process_instance_id
       FROM lifecycle_candidates
       WHERE session_id = ? AND user_id = ? AND state = 'PENDING'
       LIMIT 1`,
      input.sessionId,
      input.userId,
    );
    if (!candidate) return;

    const nowUtcMs = input.observedAt?.utcMs ?? dependencies.nowUtcMs();
    const session = await transaction.getFirstAsync<SessionRow>(
      `SELECT id, user_id, mode, duration_seconds, started_at, status
       FROM sessions WHERE id = ? AND user_id = ?`,
      input.sessionId,
      input.userId,
    );
    if (!session || session.status !== 'ACTIVE') {
      await resolveCandidate(transaction, candidate.id, 'CANCELLED', nowUtcMs);
      result = 'cancelled';
      return;
    }

    // Một foreground lift đã mở bao phủ khoảng background; không thêm lift cho cùng một lần nhấc máy.
    if (await hasOpenViolation(transaction, input)) {
      await resolveCandidate(transaction, candidate.id, 'CANCELLED', nowUtcMs);
      result = 'cancelled';
      return;
    }

    // Monotonic đo thời gian thật trong process; so với UTC để phát hiện đồng hồ hệ thống bị chỉnh.
    const sameProcess = candidate.process_instance_id === dependencies.processInstanceId;
    if (!sameProcess) {
      // Sau khi process khởi động lại, Expo Go không còn mốc monotonic cũ để xác minh UTC.
      await resolveCandidate(transaction, candidate.id, 'NEEDS_REVIEW', nowUtcMs);
      result = 'needs-review';
      return;
    }

    const elapsedUtcMs = nowUtcMs - candidate.transition_at_utc_ms;
    const elapsedMonotonicMs = (input.observedAt?.monotonicMs ?? dependencies.nowMonotonicMs()) - candidate.transition_at_monotonic_ms;
    if (
      !Number.isFinite(elapsedUtcMs)
      || elapsedUtcMs < 0
      || !Number.isFinite(elapsedMonotonicMs)
      || elapsedMonotonicMs < 0
      || Math.abs(elapsedUtcMs - elapsedMonotonicMs) > MAX_CLOCK_DIVERGENCE_MS
    ) {
      await resolveCandidate(transaction, candidate.id, 'NEEDS_REVIEW', nowUtcMs);
      result = 'needs-review';
      return;
    }
    const elapsedMs = elapsedMonotonicMs;
    if (elapsedMs < BACKGROUND_GRACE_PERIOD_MS) {
      await resolveCandidate(transaction, candidate.id, 'CANCELLED', nowUtcMs);
      result = 'cancelled';
      return;
    }

    const startedAtUtcMs = Date.parse(session.started_at);
    if (!Number.isFinite(startedAtUtcMs)) {
      await resolveCandidate(transaction, candidate.id, 'NEEDS_REVIEW', nowUtcMs);
      result = 'needs-review';
      return;
    }
    const sessionCutoffUtcMs = session.mode === 'COUNTDOWN'
      ? startedAtUtcMs + session.duration_seconds * 1_000
      : Number.POSITIVE_INFINITY;
    const endedAtUtcMs = Math.min(nowUtcMs, sessionCutoffUtcMs, input.cutoffUtcMs ?? Number.POSITIVE_INFINITY);
    const confirmedAtUtcMs = candidate.transition_at_utc_ms + BACKGROUND_GRACE_PERIOD_MS;
    if (endedAtUtcMs < confirmedAtUtcMs) {
      await resolveCandidate(transaction, candidate.id, 'CANCELLED', nowUtcMs);
      result = 'cancelled';
      return;
    }

    const durationSeconds = Math.max(
      0,
      Math.floor((endedAtUtcMs - candidate.transition_at_utc_ms) / 1_000),
    );
    const createdAt = new Date(nowUtcMs).toISOString();
    const startedAt = new Date(candidate.transition_at_utc_ms).toISOString();
    const confirmedAt = new Date(confirmedAtUtcMs).toISOString();
    const endedAt = new Date(endedAtUtcMs).toISOString();

    // Candidate UUID là event ID nên retry/relaunch không thể tạo thêm violation hoặc outbox event.
    await transaction.runAsync(
      `INSERT INTO violation_logs (
         event_id, session_id, room_id, user_id, started_at, confirmed_at, ended_at,
         duration_seconds, sync_status, created_at, synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, NULL)`,
      candidate.id,
      session.id,
      session.mode === 'GROUP' ? session.id : null,
      session.user_id,
      startedAt,
      confirmedAt,
      endedAt,
      durationSeconds,
      createdAt,
    );
    if (session.mode === 'GROUP') {
      // Lifecycle event và outbox cùng SQLite transaction; sync worker chỉ gửi event đã kết thúc.
      await transaction.runAsync(
        `INSERT OR IGNORE INTO sync_outbox (
           event_id, event_type, schema_version, aggregate_type, aggregate_id, session_id, actor_uid,
           occurred_at_utc_ms, payload_json, sync_status, attempt_count, next_attempt_at, lease_expires_at,
           last_error_code, created_at, synced_at
         ) VALUES (?, 'VIOLATION_RECORDED', 1, 'ROOM', ?, ?, ?, ?, ?, 'PENDING', 0, NULL, NULL, NULL, ?, NULL)`,
        candidate.id, session.id, session.id, session.user_id, endedAtUtcMs,
        JSON.stringify({ startedAtUtcMs: candidate.transition_at_utc_ms, endedAtUtcMs, durationSeconds }), createdAt,
      );
    }
    await resolveCandidate(transaction, candidate.id, 'CONFIRMED', nowUtcMs);
    result = 'confirmed';
  });
  return result;
}


async function hasOpenViolation(
  transaction: SQLite.SQLiteDatabase,
  input: BackgroundRecoveryInput,
): Promise<boolean> {
  const violation = await transaction.getFirstAsync<{ event_id: string }>(
    'SELECT event_id FROM violation_logs WHERE session_id = ? AND user_id = ? AND ended_at IS NULL LIMIT 1',
    input.sessionId,
    input.userId,
  );
  return violation !== null;
}

async function resolveCandidate(
  transaction: SQLite.SQLiteDatabase,
  candidateId: string,
  state: 'CANCELLED' | 'CONFIRMED' | 'NEEDS_REVIEW',
  resolvedAtUtcMs: number,
): Promise<void> {
  const update = await transaction.runAsync(
    `UPDATE lifecycle_candidates SET state = ?, resolved_at_utc_ms = ?
     WHERE id = ? AND state = 'PENDING'`,
    state,
    resolvedAtUtcMs,
    candidateId,
  );
  if (update.changes !== 1) throw new Error('Background lifecycle candidate changed before reconciliation completed.');
}

export function createBackgroundRecoveryRepository(dependencies: RecoveryDependencies = defaultDependencies) {
  return {
    // Chụp mốc lúc AppState phát sự kiện, không dùng thời điểm SQLite xử lý xong queue.
    captureTime(): BackgroundTimestamp {
      return { utcMs: dependencies.nowUtcMs(), monotonicMs: dependencies.nowMonotonicMs() };
    },
    async begin(input: BackgroundRecoveryInput) {
      return beginBackgroundCandidate(await getLocalDatabase(), input, dependencies);
    },
    async reconcile(input: BackgroundRecoveryInput) {
      return reconcileBackgroundCandidate(await getLocalDatabase(), input, dependencies);
    },
    async reconcileAtCutoff(input: Omit<BackgroundRecoveryInput, 'cutoffUtcMs'>, cutoffUtcMs: number) {
      if (!Number.isFinite(cutoffUtcMs)) throw new Error('Background recovery cutoff must be a finite timestamp.');
      return reconcileBackgroundCandidate(
        await getLocalDatabase(),
        { ...input, cutoffUtcMs },
        dependencies,
      );
    },
  };
}
