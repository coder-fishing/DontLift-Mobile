import type * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { readGroupSummary, type GroupHistoryStatus, type GroupLocalSummary } from './group-history-model';

type Recording = { roomId: string; userId: string; status: GroupHistoryStatus; cutoffUtcMs: number; startedAtUtcMs?: number; terminalConfirmed?: boolean };
// Local projection có thể được sửa theo cutoff server đến muộn; identity/outbox vẫn giữ nguyên.
export async function recordGroupSummary(transaction: SQLite.SQLiteDatabase, input: Recording,
  createId: () => string = Crypto.randomUUID): Promise<void> {
  const row = await transaction.getFirstAsync<{ summary_json: string; source: string; sync_status: string }>(
    'SELECT summary_json, source, sync_status FROM group_history WHERE actor_uid = ? AND room_id = ?', input.userId, input.roomId);
  if (row?.source === 'CLOUD') return;
  const previous = row ? readGroupSummary(JSON.parse(row.summary_json), input.userId, input.roomId) : null;
  const session = await transaction.getFirstAsync<{ started_at: string }>(
    "SELECT started_at FROM sessions WHERE id = ? AND user_id = ? AND mode = 'GROUP'", input.roomId, input.userId);
  if (!session && !previous) return;
  const cutoff = Math.floor(input.cutoffUtcMs);
  const completedAtUtcMs = previous ? Math.min(previous.completedAtUtcMs, cutoff) : cutoff;
  const status = previous?.status === 'EARLY_EXIT' ? 'EARLY_EXIT' : input.status;
  const startedAtUtcMs = input.startedAtUtcMs ?? previous?.startedAtUtcMs ?? Date.parse(session!.started_at);
  if (!Number.isSafeInteger(completedAtUtcMs) || !Number.isSafeInteger(startedAtUtcMs) || completedAtUtcMs < startedAtUtcMs) {
    throw new Error('group-history-invalid-cutoff');
  }
  if (previous && previous.completedAtUtcMs === completedAtUtcMs && previous.status === status && previous.startedAtUtcMs === startedAtUtcMs) {
    if (input.terminalConfirmed) await transaction.runAsync('UPDATE group_history SET terminal_confirmed = 1 WHERE actor_uid = ? AND room_id = ?', input.userId, input.roomId);
    return;
  }
  const intervals = await transaction.getAllAsync<{ started_at: string; confirmed_at: string; ended_at: string }>(
    `SELECT started_at, confirmed_at, ended_at FROM violation_logs
     WHERE room_id = ? AND user_id = ? AND ended_at IS NOT NULL AND confirmed_at IS NOT NULL`, input.roomId, input.userId);
  let liftCount = 0; let violationDurationSeconds = 0;
  for (const interval of intervals) {
    const start = Date.parse(interval.started_at); const confirmed = Date.parse(interval.confirmed_at);
    const ended = Math.min(Date.parse(interval.ended_at), completedAtUtcMs);
    const duration = Math.floor((ended - start) / 1000);
    if (!Number.isFinite(start) || !Number.isFinite(confirmed) || !Number.isFinite(ended)
      || start < startedAtUtcMs || confirmed > completedAtUtcMs || duration < 3) continue;
    liftCount++; violationDurationSeconds += duration;
  }
  if (previous && previous.completedAtUtcMs === completedAtUtcMs) {
    // Chỉ đổi status thì giữ nguyên thống kê đã ghi; không đếm thêm log đến muộn.
    liftCount = previous.liftCount; violationDurationSeconds = previous.violationDurationSeconds;
  } else if (previous && intervals.length < previous.liftCount) {
    // Không sửa thành 0 khi raw interval đã mất; giữ bản cũ để retry/điều tra.
    throw new Error('group-history-missing-intervals');
  }
  const summary: GroupLocalSummary = { version: 1, eventId: previous?.eventId ?? createId(), actorUid: input.userId, roomId: input.roomId,
    status, startedAtUtcMs, completedAtUtcMs, liftCount, violationDurationSeconds, penaltyScore: liftCount * 10 + violationDurationSeconds };
  if (!readGroupSummary(summary, input.userId, input.roomId)) throw new Error('group-history-invalid-summary');
  const json = JSON.stringify(summary);
  await transaction.runAsync(`INSERT INTO group_history (actor_uid, room_id, completed_at_utc_ms, summary_json, sync_status, terminal_confirmed)
    VALUES (?, ?, ?, ?, 'PENDING', ?) ON CONFLICT(actor_uid, room_id) DO UPDATE SET completed_at_utc_ms=excluded.completed_at_utc_ms,
    summary_json=excluded.summary_json, sync_status='PENDING', terminal_confirmed=excluded.terminal_confirmed`,
    input.userId, input.roomId, completedAtUtcMs, json, input.terminalConfirmed ? 1 : 0);
  await transaction.runAsync(`INSERT INTO sync_outbox (event_id, event_type, schema_version, aggregate_type, aggregate_id,
    session_id, actor_uid, occurred_at_utc_ms, payload_json, sync_status, attempt_count, created_at)
    VALUES (?, 'GROUP_SESSION_LOCAL_SUMMARY', 1, 'GROUP_SESSION', ?, ?, ?, ?, ?, 'PENDING', 0, ?)
    ON CONFLICT(event_id) DO UPDATE SET payload_json=excluded.payload_json, occurred_at_utc_ms=excluded.occurred_at_utc_ms,
    sync_status='PENDING', synced_at=NULL, last_error_code=NULL`,
    summary.eventId, input.roomId, input.roomId, input.userId, completedAtUtcMs, json, new Date().toISOString());
  await transaction.runAsync(`UPDATE sessions SET completed_at = ?, duration_seconds = ? WHERE id = ? AND user_id = ? AND mode = 'GROUP'
    AND status IN ('COMPLETED', 'CANCELLED')`, new Date(completedAtUtcMs).toISOString(), Math.floor((completedAtUtcMs - startedAtUtcMs) / 1000), input.roomId, input.userId);
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
    for (const row of recordings) await recordGroupSummary(tx, { roomId: row.room_id, userId, cutoffUtcMs: Date.parse(row.completed_at),
      status: row.member_status === 'EARLY_EXIT' ? 'EARLY_EXIT' : row.room_status as GroupHistoryStatus });
  });
}
