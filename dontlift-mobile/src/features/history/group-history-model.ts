/** Các trạng thái phiên nhóm được phép lưu thành bản tóm tắt lịch sử. */
export type GroupHistoryStatus =
  | "COMPLETED"
  | "CANCELLED"
  | "ABORTED"
  | "EARLY_EXIT";
/** Bản summary cá nhân của một phiên nhóm, dùng cho lưu cục bộ và đồng bộ. */
export type GroupLocalSummary = {
  version: 1;
  eventId: string;
  actorUid: string;
  roomId: string;
  status: GroupHistoryStatus;
  startedAtUtcMs: number;
  completedAtUtcMs: number;
  liftCount: number;
  violationDurationSeconds: number;
  penaltyScore: number;
};
/** Một mục lịch sử nhóm kèm trạng thái đồng bộ và nguồn dữ liệu. */
export type GroupHistoryEntry = {
  summary: GroupLocalSummary;
  syncStatus: "PENDING" | "SYNCED" | "FAILED";
  source?: "PERSONAL" | "ROOM";
};
export type GroupHistoryCursor = { completedAtUtcMs: number; roomId: string };
export const GROUP_HISTORY_PAGE_SIZE = 20;
export const GROUP_HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Kiểm tra và chuyển dữ liệu chưa tin cậy thành summary đúng cấu trúc. */
export function readGroupSummary(
  value: unknown,
  actorUid: string,
  roomId?: string,
): GroupLocalSummary | null {
  if (typeof value !== "object" || value === null) return null;
  const d = value as Record<string, unknown>;
  if (
    d.version !== 1 ||
    d.actorUid !== actorUid ||
    typeof d.roomId !== "string" ||
    !uuid.test(d.roomId) ||
    (roomId != null && d.roomId !== roomId) ||
    typeof d.eventId !== "string" ||
    !uuid.test(d.eventId) ||
    typeof d.status !== "string" ||
    !["COMPLETED", "CANCELLED", "ABORTED", "EARLY_EXIT"].includes(d.status)
  )
    return null;
  for (const key of [
    "startedAtUtcMs",
    "completedAtUtcMs",
    "liftCount",
    "violationDurationSeconds",
    "penaltyScore",
  ]) {
    if (!Number.isSafeInteger(d[key]) || Number(d[key]) < 0) return null;
  }
  if (
    Number(d.completedAtUtcMs) < Number(d.startedAtUtcMs) ||
    d.penaltyScore !==
      Number(d.liftCount) * 10 + Number(d.violationDurationSeconds)
  )
    return null;
  return {
    version: 1,
    eventId: d.eventId,
    actorUid,
    roomId: d.roomId,
    status: d.status as GroupHistoryStatus,
    startedAtUtcMs: Number(d.startedAtUtcMs),
    completedAtUtcMs: Number(d.completedAtUtcMs),
    liftCount: Number(d.liftCount),
    violationDurationSeconds: Number(d.violationDurationSeconds),
    penaltyScore: Number(d.penaltyScore),
  };
}
/** Tạo cursor từ mục cuối trang để tải trang lịch sử tiếp theo. */
export function summaryCursor(entry: GroupHistoryEntry): GroupHistoryCursor {
  return {
    completedAtUtcMs: entry.summary.completedAtUtcMs,
    roomId: entry.summary.roomId,
  };
}
/** Gộp bản cục bộ và cloud, giữ dữ liệu chưa đồng bộ và sắp xếp theo thời gian. */
/**
 * Gộp lịch sử Group từ Local và Remote, loại bỏ bản ghi trùng.
 * Ưu tiên Local nếu chưa đồng bộ (PENDING/FAILED), ngược lại ưu tiên Remote.
 * Ưu tiên lịch sử PERSONAL hơn ROOM và sắp xếp mới nhất lên đầu.
 * Bảo vệ dữ liệu Local chưa đồng bộ, còn dữ liệu đã đồng bộ thì ưu tiên Remote.
 */export function mergeGroupHistory(
  local: GroupHistoryEntry[],
  cloud: GroupHistoryEntry[],
): GroupHistoryEntry[] {
  const map = new Map<string, GroupHistoryEntry>();
  for (const item of local) {
    const key = `${item.summary.actorUid}/${item.summary.roomId}`;
    const previous = map.get(key);
    if (!previous || (previous.source === "ROOM" && item.source !== "ROOM"))
      map.set(key, item);
  }
  for (const item of cloud) {
    const key = `${item.summary.actorUid}/${item.summary.roomId}`;
    if (map.get(key)?.source === "PERSONAL" && item.source === "ROOM") continue;
    // Bản server đã sửa cutoff được ưu tiên khi local không còn pending.
    if (!map.has(key) || map.get(key)!.syncStatus === "SYNCED")
      map.set(key, item);
  }
  return [...map.values()].sort(
    (a, b) =>
      b.summary.completedAtUtcMs - a.summary.completedAtUtcMs ||
      (a.summary.roomId < b.summary.roomId
        ? 1
        : a.summary.roomId > b.summary.roomId
          ? -1
          : 0),
  );
}
