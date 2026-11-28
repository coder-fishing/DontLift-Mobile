
import type * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import {
  readGroupSummary,
  type GroupHistoryStatus,
  type GroupLocalSummary,
} from "./group-history-model";

/** Lưu summary Group vào SQLite và tạo Outbox để đồng bộ. */

type Recording = {
  roomId: string;
  userId: string;
  status: GroupHistoryStatus;
  cutoffUtcMs: number;
  startedAtUtcMs?: number;
  terminalConfirmed?: boolean;
};

type HistoryRow = {
  summary_json: string;
  source: string;
  sync_status: string;
};

type ViolationRow = {
  started_at: string;
  confirmed_at: string;
  ended_at: string;
};

// Tính số lần nhấc máy và tổng thời gian vi phạm.
// tổng số lần * 10 + tổng thời gian
async function calculateViolations(
  db: SQLite.SQLiteDatabase,
  input: Recording,
  startedAt: number,
  completedAt: number,
  previous: GroupLocalSummary | null,
) {
  const intervals = await db.getAllAsync<ViolationRow>(
    `SELECT started_at, confirmed_at, ended_at
     FROM violation_logs
     WHERE room_id = ? AND user_id = ?
       AND ended_at IS NOT NULL
       AND confirmed_at IS NOT NULL`,
    input.roomId,
    input.userId,
  );

  if (previous?.completedAtUtcMs === completedAt) {
    return {
      liftCount: previous.liftCount,
      duration: previous.violationDurationSeconds,
    };
  }

  if (previous && intervals.length < previous.liftCount) {
    throw new Error("group-history-missing-intervals");
  }

  let liftCount = 0;
  let duration = 0;

  for (const row of intervals) {
    const start = Date.parse(row.started_at);
    const confirmed = Date.parse(row.confirmed_at);
    const end = Math.min(Date.parse(row.ended_at), completedAt);
    const seconds = Math.floor((end - start) / 1000);

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(confirmed) ||
      !Number.isFinite(end) ||
      start < startedAt ||
      confirmed > completedAt ||
      seconds < 3
    ) continue;

    liftCount++;
    duration += seconds;
  }

  return { liftCount, duration };
}

// Lưu lịch sử và Outbox trong cùng transaction.
async function saveSummary(
  db: SQLite.SQLiteDatabase,
  summary: GroupLocalSummary,
  terminalConfirmed: boolean,
) {
  const json = JSON.stringify(summary);
  const { actorUid, roomId, eventId, completedAtUtcMs } = summary;

  await db.runAsync(
    `INSERT INTO group_history
       (actor_uid, room_id, completed_at_utc_ms,
        summary_json, sync_status, terminal_confirmed)
     VALUES (?, ?, ?, ?, 'PENDING', ?)
     ON CONFLICT(actor_uid, room_id) DO UPDATE SET
       completed_at_utc_ms = excluded.completed_at_utc_ms,
       summary_json = excluded.summary_json,
       sync_status = 'PENDING',
       terminal_confirmed = excluded.terminal_confirmed`,
    actorUid,
    roomId,
    completedAtUtcMs,
    json,
    terminalConfirmed ? 1 : 0,
  );

  await db.runAsync(
    `INSERT INTO sync_outbox
       (event_id, event_type, schema_version, aggregate_type,
        aggregate_id, session_id, actor_uid,
        occurred_at_utc_ms, payload_json, sync_status,
        attempt_count, created_at)
     VALUES (?, 'GROUP_SESSION_LOCAL_SUMMARY', 1,
       'GROUP_SESSION', ?, ?, ?, ?, ?, 'PENDING', 0, ?)
     ON CONFLICT(event_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       occurred_at_utc_ms = excluded.occurred_at_utc_ms,
       sync_status = 'PENDING',
       synced_at = NULL,
       last_error_code = NULL`,
    eventId,
    roomId,
    roomId,
    actorUid,
    completedAtUtcMs,
    json,
    new Date().toISOString(),
  );

  await db.runAsync(
    `UPDATE sessions
     SET completed_at = ?, duration_seconds = ?
     WHERE id = ? AND user_id = ? AND mode = 'GROUP'
       AND status IN ('COMPLETED', 'CANCELLED')`,
    new Date(completedAtUtcMs).toISOString(),
    Math.floor(
      (completedAtUtcMs - summary.startedAtUtcMs) / 1000,
    ),
    roomId,
    actorUid,
  );
}

/** Tạo hoặc cập nhật summary Local và Outbox. */
export async function recordGroupSummary(
  db: SQLite.SQLiteDatabase,
  input: Recording,
  createId: () => string = Crypto.randomUUID,
): Promise<void> {
  const { userId, roomId } = input;

  const row = await db.getFirstAsync<HistoryRow>(
    `SELECT summary_json, source, sync_status
     FROM group_history
     WHERE actor_uid = ? AND room_id = ?`,
    userId,
    roomId,
  );

  if (row?.source === "CLOUD") return;

  const previous = row
    ? readGroupSummary(JSON.parse(row.summary_json), userId, roomId)
    : null;

  const session = await db.getFirstAsync<{ started_at: string }>(
    `SELECT started_at FROM sessions
     WHERE id = ? AND user_id = ? AND mode = 'GROUP'`,
    roomId,
    userId,
  );

  if (!session && !previous) return;

  const cutoff = Math.floor(input.cutoffUtcMs);
  const completedAt = previous
    ? Math.min(previous.completedAtUtcMs, cutoff)
    : cutoff;

  const startedAt =
    input.startedAtUtcMs ??
    previous?.startedAtUtcMs ??
    Date.parse(session!.started_at);

  const status =
    previous?.status === "EARLY_EXIT"
      ? "EARLY_EXIT"
      : input.status;

  if (
    !Number.isSafeInteger(startedAt) ||
    !Number.isSafeInteger(completedAt) ||
    completedAt < startedAt
  ) {
    throw new Error("group-history-invalid-cutoff");
  }

  // Không cần tính lại khi summary không thay đổi.
  if (
    previous &&
    previous.completedAtUtcMs === completedAt &&
    previous.startedAtUtcMs === startedAt &&
    previous.status === status
  ) {
    if (input.terminalConfirmed) {
      await db.runAsync(
        `UPDATE group_history
         SET terminal_confirmed = 1
         WHERE actor_uid = ? AND room_id = ?`,
        userId,
        roomId,
      );
    }
    return;
  }

  const { liftCount, duration } = await calculateViolations(
    db,
    input,
    startedAt,
    completedAt,
    previous,
  );

  const summary: GroupLocalSummary = {
    version: 1,
    eventId: previous?.eventId ?? createId(),
    actorUid: userId,
    roomId,
    status,
    startedAtUtcMs: startedAt,
    completedAtUtcMs: completedAt,
    liftCount,
    violationDurationSeconds: duration,
    penaltyScore: liftCount * 10 + duration,
  };

  if (!readGroupSummary(summary, userId, roomId)) {
    throw new Error("group-history-invalid-summary");
  }

  await saveSummary(db, summary, !!input.terminalConfirmed);
}

/** Khôi phục các lịch sử Group còn thiếu từ SQLite. */
export async function recoverGroupSummaries(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<void> {
  const rows = await db.getAllAsync<{
    room_id: string;
    completed_at: string;
    room_status: string;
    member_status: string;
  }>(
    `SELECT s.id AS room_id, s.completed_at,
            r.status AS room_status, m.status AS member_status
     FROM sessions s
     JOIN rooms r ON r.room_id = s.id
     JOIN room_members m
       ON m.room_id = s.id AND m.uid = s.user_id
     WHERE s.user_id = ?
       AND s.mode = 'GROUP'
       AND s.status IN ('COMPLETED', 'CANCELLED')
       AND s.completed_at IS NOT NULL
       AND (
         m.status = 'EARLY_EXIT'
         OR r.status IN ('COMPLETED', 'ABORTED', 'CANCELLED')
       )
       AND NOT EXISTS (
         SELECT 1 FROM group_history h
         WHERE h.actor_uid = s.user_id AND h.room_id = s.id
       )`,
    userId,
  );

  if (!rows.length) return;

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const row of rows) {
      await recordGroupSummary(tx, {
        roomId: row.room_id,
        userId,
        cutoffUtcMs: Date.parse(row.completed_at),
        status:
          row.member_status === "EARLY_EXIT"
            ? "EARLY_EXIT"
            : (row.room_status as GroupHistoryStatus),
      });
    }
  });
}
