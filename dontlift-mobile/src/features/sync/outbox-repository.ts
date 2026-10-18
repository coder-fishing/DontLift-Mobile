import type * as SQLite from 'expo-sqlite';

export type ViolationRecordedEvent = {
  eventId: string;
  sessionId: string;
  actorUid: string;
  startedAtUtcMs: number;
  endedAtUtcMs: number;
  durationSeconds: number;
  createdAt: string;
};

export type SoloSessionCompletedEvent = {
  sessionId: string;
  actorUid: string;
  occurredAtUtcMs: number;
  payload: {
    durationSeconds: number;
    liftCount: number;
    violationDurationSeconds: number;
    penaltyScore: number;
    startedAtUtcMs: number;
    completedAtUtcMs: number;
  };
  createdAt: string;
};

export async function enqueueSoloSessionCompleted(
  transaction: SQLite.SQLiteDatabase,
  event: SoloSessionCompletedEvent,
): Promise<void> {
  const payload = JSON.stringify(event.payload);
  // sessionId là idempotency key theo contract; hoàn tất lặp không tạo summary event thứ hai.
  await transaction.runAsync(
    `INSERT INTO sync_outbox (
       event_id, event_type, schema_version, aggregate_type, aggregate_id,
       session_id, actor_uid, occurred_at_utc_ms, payload_json, sync_status,
       attempt_count, next_attempt_at, lease_expires_at, last_error_code, created_at, synced_at
     ) VALUES (?, 'SOLO_SESSION_COMPLETED', 1, 'SOLO_SESSION', ?, ?, ?, ?, ?, 'PENDING', 0, NULL, NULL, NULL, ?, NULL)`,
    event.sessionId,
    event.sessionId,
    event.sessionId,
    event.actorUid,
    event.occurredAtUtcMs,
    payload,
    event.createdAt,
  );
}

export async function enqueueViolationRecorded(
  transaction: SQLite.SQLiteDatabase,
  event: ViolationRecordedEvent,
): Promise<void> {
  const payload = JSON.stringify({
    startedAtUtcMs: event.startedAtUtcMs,
    endedAtUtcMs: event.endedAtUtcMs,
    durationSeconds: event.durationSeconds,
  });

  await transaction.runAsync(
    `INSERT INTO sync_outbox (
       event_id, event_type, schema_version, aggregate_type, aggregate_id,
       session_id, actor_uid, occurred_at_utc_ms, payload_json, sync_status,
       attempt_count, next_attempt_at, lease_expires_at, last_error_code, created_at, synced_at
     ) VALUES (?, 'VIOLATION_RECORDED', 1, 'SOLO_SESSION', ?, ?, ?, ?, ?, 'PENDING', 0, NULL, NULL, NULL, ?, NULL)`,
    event.eventId,
    event.sessionId,
    event.sessionId,
    event.actorUid,
    event.endedAtUtcMs,
    payload,
    event.createdAt,
  );
}

export async function updateViolationRecordedEvent(
  transaction: SQLite.SQLiteDatabase,
  event: Pick<ViolationRecordedEvent, 'eventId' | 'startedAtUtcMs' | 'endedAtUtcMs' | 'durationSeconds'>,
): Promise<void> {
  const payload = JSON.stringify({
    startedAtUtcMs: event.startedAtUtcMs,
    endedAtUtcMs: event.endedAtUtcMs,
    durationSeconds: event.durationSeconds,
  });
  const result = await transaction.runAsync(
    `UPDATE sync_outbox SET payload_json = ?
     WHERE event_id = ? AND event_type = 'VIOLATION_RECORDED' AND sync_status = 'PENDING'`,
    payload,
    event.eventId,
  );
  if (result.changes !== 1) throw new Error('Pending violation outbox event was not found.');
}
