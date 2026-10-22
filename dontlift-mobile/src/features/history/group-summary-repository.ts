import type * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { readGroupSummary, type GroupHistoryStatus, type GroupLocalSummary } from './group-history-model';

type Recording = { roomId: string; userId: string; status: GroupHistoryStatus; cutoffUtcMs: number };
// Caller đã drain capture/recovery và normalize cutoff; summary và outbox cùng transaction với completion projection.
export async function recordGroupSummary(transaction: SQLite.SQLiteDatabase, input: Recording,
  createId: () => string = Crypto.randomUUID): Promise<void> {
  const existing = await transaction.getFirstAsync<{ room_id: string }>(
    'SELECT room_id FROM group_history WHERE actor_uid = ? AND room_id = ?', input.userId, input.roomId);
  if (existing) return;
  const session = await transaction.getFirstAsync<{ started_at: string }>(
    "SELECT started_at FROM sessions WHERE id = ? AND user_id = ? AND mode = 'GROUP'", input.roomId, input.userId);
  if (!session) return; // Phòng WAITING chưa ghi recording không tạo phiên focus giả.
  const completedAtUtcMs = Math.floor(input.cutoffUtcMs);
  const startedAtUtcMs = Date.parse(session.started_at);
  if (!Number.isSafeInteger(completedAtUtcMs) || !Number.isSafeInteger(startedAtUtcMs) || completedAtUtcMs < startedAtUtcMs) {
    throw new Error('group-history-invalid-cutoff');
  }
  const totals = await transaction.getFirstAsync<{ lifts: number; duration: number }>(
    `SELECT COUNT(*) AS lifts, COALESCE(SUM(duration_seconds), 0) AS duration FROM violation_logs
     WHERE room_id = ? AND user_id = ? AND ended_at IS NOT NULL AND confirmed_at IS NOT NULL
       AND started_at >= ? AND ended_at <= ? AND confirmed_at <= ? AND duration_seconds >= 3`,
    input.roomId, input.userId, session.started_at, new Date(completedAtUtcMs).toISOString(), new Date(completedAtUtcMs).toISOString());
  const summary: GroupLocalSummary = { version: 1, eventId: createId(), actorUid: input.userId, roomId: input.roomId,
    status: input.status, startedAtUtcMs, completedAtUtcMs, liftCount: totals?.lifts ?? 0,
    violationDurationSeconds: totals?.duration ?? 0, penaltyScore: (totals?.lifts ?? 0) * 10 + (totals?.duration ?? 0) };
  if (!readGroupSummary(summary, input.userId, input.roomId)) throw new Error('group-history-invalid-summary');
  const json = JSON.stringify(summary);
  await transaction.runAsync(`INSERT INTO group_history (actor_uid, room_id, completed_at_utc_ms, summary_json, sync_status)
    VALUES (?, ?, ?, ?, 'PENDING')`, input.userId, input.roomId, completedAtUtcMs, json);
  await transaction.runAsync(`INSERT INTO sync_outbox (event_id, event_type, schema_version, aggregate_type, aggregate_id,
    session_id, actor_uid, occurred_at_utc_ms, payload_json, sync_status, attempt_count, created_at)
    VALUES (?, 'GROUP_SESSION_LOCAL_SUMMARY', 1, 'GROUP_SESSION', ?, ?, ?, ?, ?, 'PENDING', 0, ?)`,
    summary.eventId, input.roomId, input.roomId, input.userId, completedAtUtcMs, json, new Date().toISOString());
}

export async function recoverGroupSummaries(database: SQLite.SQLiteDatabase, userId: string): Promise<void> {
  const recordings = await database.getAllAsync<{ room_id: string; completed_at: string; room_status: string; member_status: string }>(
      `SELECT s.id AS room_id, s.completed_at, r.status AS room_status, m.status AS member_status FROM sessions s
       JOIN rooms r ON r.room_id = s.id JOIN room_members m ON m.room_id = s.id AND m.uid = s.user_id
       WHERE s.user_id = ? AND s.mode = 'GROUP' AND s.status IN ('COMPLETED', 'CANCELLED') AND s.completed_at IS NOT NULL
         AND (m.status = 'EARLY_EXIT' OR r.status IN ('COMPLETED', 'ABORTED', 'CANCELLED'))
         AND NOT EXISTS (SELECT 1 FROM group_history h WHERE h.actor_uid = s.user_id AND h.room_id = s.id)`, userId);
  if (!recordings.length) return;
  await database.withExclusiveTransactionAsync(async tx => {
    for (const row of recordings) {
      await recordGroupSummary(tx, { roomId: row.room_id, userId, cutoffUtcMs: Date.parse(row.completed_at),
        status: row.member_status === 'EARLY_EXIT' ? 'EARLY_EXIT' : row.room_status as GroupHistoryStatus });
    }
  });
}
