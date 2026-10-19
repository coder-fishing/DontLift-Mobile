import type * as SQLite from 'expo-sqlite';

import type { SoloSyncEvent } from './sync-worker';

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

type OutboxSyncRow = {
  event_id: string;
  session_id: string;
  aggregate_id: string;
  occurred_at_utc_ms: number;
  payload_json: string;
  attempt_count: number;
  created_at: string;
};

export function createOutboxSyncRepository(database: SQLite.SQLiteDatabase) {
  return {
    async claimBatch(input: {
      userId: string;
      nowUtcMs: number;
      leaseExpiresAtUtcMs: number;
      limit: number;
      ignoreBackoff?: boolean;
    }): Promise<SoloSyncEvent[]> {
      let claimed: SoloSyncEvent[] = [];
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const rows = await transaction.getAllAsync<OutboxSyncRow>(
          `SELECT event_id, session_id, aggregate_id, occurred_at_utc_ms,
                  payload_json, attempt_count, created_at
           FROM sync_outbox
           WHERE actor_uid = ? AND event_type = 'SOLO_SESSION_COMPLETED'
             AND sync_status = 'PENDING'
             AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
             AND (? = 1 OR next_attempt_at IS NULL OR next_attempt_at <= ?)
           ORDER BY occurred_at_utc_ms ASC, aggregate_id ASC
           LIMIT ?`,
          input.userId,
          input.nowUtcMs,
          input.ignoreBackoff ? 1 : 0,
          input.nowUtcMs,
          Math.max(1, Math.min(20, Math.floor(input.limit))),
        );
        for (const row of rows) {
          const leased = await transaction.runAsync(
            `UPDATE sync_outbox SET lease_expires_at = ?
             WHERE event_id = ? AND actor_uid = ? AND sync_status = 'PENDING'
               AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`,
            input.leaseExpiresAtUtcMs,
            row.event_id,
            input.userId,
            input.nowUtcMs,
          );
          if (leased.changes !== 1) throw new Error('Could not lease a pending Solo summary.');
        }
        claimed = rows.map((row) => ({
          eventId: row.event_id,
          sessionId: row.session_id,
          aggregateId: row.aggregate_id,
          occurredAtUtcMs: row.occurred_at_utc_ms,
          payload: JSON.parse(row.payload_json) as SoloSyncEvent['payload'],
          attemptCount: row.attempt_count,
          createdAt: row.created_at,
        }));
      });
      return claimed;
    },
    async markSynced(input: { userId: string; eventId: string; syncedAtUtcMs: number }) {
      await database.runAsync(
        `UPDATE sync_outbox SET sync_status = 'SYNCED', synced_at = ?,
           lease_expires_at = NULL, next_attempt_at = NULL, last_error_code = NULL
         WHERE event_id = ? AND actor_uid = ? AND event_type = 'SOLO_SESSION_COMPLETED'
           AND sync_status = 'PENDING'`,
        new Date(input.syncedAtUtcMs).toISOString(), input.eventId, input.userId,
      );
    },
    async markFailed(input: { userId: string; eventId: string; errorCode: string }) {
      await database.runAsync(
        `UPDATE sync_outbox SET sync_status = 'FAILED', last_error_code = ?,
           lease_expires_at = NULL, next_attempt_at = NULL
         WHERE event_id = ? AND actor_uid = ? AND event_type = 'SOLO_SESSION_COMPLETED'
           AND sync_status = 'PENDING'`,
        input.errorCode.slice(0, 80), input.eventId, input.userId,
      );
    },
    async scheduleRetry(input: { userId: string; eventId: string; nextAttemptAtUtcMs: number; errorCode: string }) {
      await database.runAsync(
        `UPDATE sync_outbox SET attempt_count = attempt_count + 1,
           next_attempt_at = ?, lease_expires_at = NULL, last_error_code = ?
         WHERE event_id = ? AND actor_uid = ? AND event_type = 'SOLO_SESSION_COMPLETED'
           AND sync_status = 'PENDING'`,
        input.nextAttemptAtUtcMs, input.errorCode.slice(0, 80), input.eventId, input.userId,
      );
    },
    async releaseLease(input: { userId: string; eventId: string }) {
      await database.runAsync(
        `UPDATE sync_outbox SET lease_expires_at = NULL
         WHERE event_id = ? AND actor_uid = ? AND event_type = 'SOLO_SESSION_COMPLETED'
           AND sync_status = 'PENDING'`,
        input.eventId, input.userId,
      );
    },
    async getStatus(input: { userId: string; sessionId: string }): Promise<'pending' | 'synced' | 'failed' | 'unknown'> {
      const row = await database.getFirstAsync<{ sync_status: string }>(
        `SELECT sync_status FROM sync_outbox
         WHERE actor_uid = ? AND session_id = ? AND event_type = 'SOLO_SESSION_COMPLETED'`,
        input.userId, input.sessionId,
      );
      if (row?.sync_status === 'SYNCED') return 'synced';
      if (row?.sync_status === 'FAILED') return 'failed';
      return row?.sync_status === 'PENDING' ? 'pending' : 'unknown';
    },
  };
}
