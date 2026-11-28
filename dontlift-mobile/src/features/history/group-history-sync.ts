/** Khôi phục và tải summary nhóm cục bộ lên qua luồng outbox hiện có. */
import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  readGroupSummary,
  type GroupLocalSummary,
} from "./group-history-model";
import {
  readGroupHistoryAuthority,
} from "./group-history-authority";
import {
  decodeSummary,
  type GroupHistoryContext,
} from "./group-history-support";
import {
  recordGroupSummary,
  recoverGroupSummaries,
} from "./group-summary-repository";

/** So sánh summary, bỏ qua thời điểm tải lên do máy chủ tạo. */
export function sameGroupSummary(
  a: GroupLocalSummary,
  b: GroupLocalSummary,
): boolean {
  return Object.keys(a)
    .filter((key) => key !== "uploadedAt")
    .every(
      (key) =>
        a[key as keyof GroupLocalSummary] === b[key as keyof GroupLocalSummary],
    );
}
// Chỉ cập nhật summary cũ khi máy chủ xác nhận EARLY_EXIT hoặc thời điểm kết thúc sớm hơn.
export function canCorrectGroupSummary(
  before: GroupLocalSummary,
  after: GroupLocalSummary,
): boolean {
  return (
    ["version", "eventId", "actorUid", "roomId", "startedAtUtcMs"].every(
      (key) =>
        before[key as keyof GroupLocalSummary] ===
        after[key as keyof GroupLocalSummary],
    ) &&
    after.completedAtUtcMs <= before.completedAtUtcMs &&
    (after.completedAtUtcMs < before.completedAtUtcMs ||
      (before.status !== "EARLY_EXIT" && after.status === "EARLY_EXIT")) &&
    after.liftCount <= before.liftCount &&
    after.violationDurationSeconds <= before.violationDurationSeconds &&
    (after.completedAtUtcMs < before.completedAtUtcMs ||
      (after.liftCount === before.liftCount &&
        after.violationDurationSeconds === before.violationDurationSeconds))
  );
}

/** Tạo thao tác đồng bộ summary cục bộ tuần tự cho một phiên người dùng. */
export function createGroupHistorySync(context: GroupHistoryContext) {
  const { dependencies, database, isActor } = context;
  let running: { uid: string; task: Promise<void> } | null = null;
  return {
    // Thử lại summary đang chờ, xác nhận trạng thái từ máy chủ rồi cập nhật outbox.
    async syncPending(uid: string, retryFailed = false): Promise<void> {
      if (!isActor(uid)) return;
      if (running?.uid === uid) return running.task;
      const task = (async () => {
        const db = await database();
        if (!isActor(uid)) return;
        await recoverGroupSummaries(db, uid);
        let afterId = "";
        for (;;) {
          if (!isActor(uid)) return;
          const rows = await db.getAllAsync<{
            event_id: string;
            aggregate_id: string;
            payload_json: string;
          }>(
            `SELECT o.event_id, o.aggregate_id, o.payload_json FROM sync_outbox o
             JOIN group_history h ON h.actor_uid = o.actor_uid AND h.room_id = o.aggregate_id
             WHERE o.actor_uid = ? AND event_type = 'GROUP_SESSION_LOCAL_SUMMARY'
               AND (o.sync_status = 'PENDING' OR (? = 1 AND o.sync_status = 'FAILED')
                 OR (o.sync_status = 'SYNCED' AND h.terminal_confirmed = 0)) AND o.event_id > ?
             ORDER BY o.event_id LIMIT 20`,
            uid,
            retryFailed ? 1 : 0,
            afterId,
          );
          if (!rows.length) break;
          for (const row of rows) {
            afterId = row.event_id;
            if (!isActor(uid)) return;
            try {
              const authority = await (dependencies.readAuthority
                ? dependencies.readAuthority(uid, row.aggregate_id)
                : readGroupHistoryAuthority(
                    dependencies,
                    uid,
                    row.aggregate_id,
                  ));
              if (!isActor(uid)) return;
              await db.withExclusiveTransactionAsync((tx) =>
                recordGroupSummary(tx, {
                  roomId: row.aggregate_id,
                  userId: uid,
                  status: authority.status,
                  cutoffUtcMs: authority.cutoffUtcMs,
                  startedAtUtcMs: authority.startedAtUtcMs,
                  terminalConfirmed: authority.terminal,
                }),
              );
              const refreshed = await db.getFirstAsync<{
                payload_json: string;
              }>(
                "SELECT payload_json FROM sync_outbox WHERE event_id = ? AND actor_uid = ?",
                row.event_id,
                uid,
              );
              if (!refreshed) continue;
              row.payload_json = refreshed.payload_json;
              const summary = decodeSummary(
                row.payload_json,
                uid,
                row.aggregate_id,
              );
              if (!summary || summary.eventId !== row.event_id)
                throw new Error("invalid-argument");
              const ref = doc(
                dependencies.firestore,
                "users",
                uid,
                "groupHistory",
                summary.roomId,
              );
              await runTransaction(dependencies.firestore, async (tx) => {
                if (!isActor(uid)) throw new Error("account-changed");
                const saved = await tx.get(ref);
                if (saved.exists()) {
                  const previous = readGroupSummary(
                    saved.data(),
                    uid,
                    summary.roomId,
                  );
                  if (!previous) throw new Error("already-exists");
                  if (!sameGroupSummary(summary, previous)) {
                    if (!canCorrectGroupSummary(previous, summary))
                      throw new Error("already-exists");
                    tx.update(ref, {
                      ...summary,
                      uploadedAt: serverTimestamp(),
                    });
                  }
                  return;
                }
                tx.set(ref, { ...summary, uploadedAt: serverTimestamp() });
              });
              await db.withExclusiveTransactionAsync(async (tx) => {
                const updated = await tx.runAsync(
                  "UPDATE sync_outbox SET sync_status = 'SYNCED', synced_at = ?, last_error_code = NULL WHERE event_id = ? AND actor_uid = ? AND event_type = 'GROUP_SESSION_LOCAL_SUMMARY' AND payload_json = ?",
                  new Date().toISOString(),
                  row.event_id,
                  uid,
                  row.payload_json,
                );
                if (!updated.changes) return;
                await tx.runAsync(
                  "UPDATE group_history SET sync_status = 'SYNCED' WHERE actor_uid = ? AND room_id = ?",
                  uid,
                  row.aggregate_id,
                );
              });
            } catch (error) {
              const code =
                error instanceof Error
                  ? "code" in error
                    ? String(error.code).replace(/^firestore\//, "")
                    : error.message
                  : "unavailable";
              if (code === "account-changed" || !isActor(uid)) return;
              const permanent = [
                "permission-denied",
                "invalid-argument",
                "already-exists",
              ].includes(code);
              await db.withExclusiveTransactionAsync(async (tx) => {
                const updated = await tx.runAsync(
                  `UPDATE sync_outbox SET sync_status = ?, attempt_count = attempt_count + 1, last_error_code = ?
                  WHERE event_id = ? AND actor_uid = ? AND event_type = 'GROUP_SESSION_LOCAL_SUMMARY' AND payload_json = ?`,
                  permanent ? "FAILED" : "PENDING",
                  code,
                  row.event_id,
                  uid,
                  row.payload_json,
                );
                if (!updated.changes) return;
                await tx.runAsync(
                  "UPDATE group_history SET sync_status = ? WHERE actor_uid = ? AND room_id = ?",
                  permanent ? "FAILED" : "PENDING",
                  uid,
                  row.aggregate_id,
                );
              });
            }
          }
        }
      })();
      running = { uid, task };
      try {
        await task;
      } finally {
        if (running?.task === task) running = null;
      }
    },
  };
}
