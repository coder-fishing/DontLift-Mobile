export type GroupHistoryStatus = 'COMPLETED' | 'CANCELLED' | 'ABORTED' | 'EARLY_EXIT';
export type GroupLocalSummary = {
  version: 1; eventId: string; actorUid: string; roomId: string; status: GroupHistoryStatus;
  startedAtUtcMs: number; completedAtUtcMs: number;
  liftCount: number; violationDurationSeconds: number; penaltyScore: number;
};
export type GroupHistoryEntry = { summary: GroupLocalSummary; syncStatus: 'PENDING' | 'SYNCED' | 'FAILED' };
export type GroupHistoryCursor = { completedAtUtcMs: number; roomId: string };
export const GROUP_HISTORY_PAGE_SIZE = 20;
export const GROUP_HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function readGroupSummary(value: unknown, actorUid: string, roomId?: string): GroupLocalSummary | null {
  if (typeof value !== 'object' || value === null) return null;
  const d = value as Record<string, unknown>;
  if (d.version !== 1 || d.actorUid !== actorUid || typeof d.roomId !== 'string' || !uuid.test(d.roomId)
    || (roomId != null && d.roomId !== roomId) || typeof d.eventId !== 'string' || !uuid.test(d.eventId)
    || typeof d.status !== 'string' || !['COMPLETED', 'CANCELLED', 'ABORTED', 'EARLY_EXIT'].includes(d.status)) return null;
  for (const key of ['startedAtUtcMs', 'completedAtUtcMs', 'liftCount', 'violationDurationSeconds', 'penaltyScore']) {
    if (!Number.isSafeInteger(d[key]) || Number(d[key]) < 0) return null;
  }
  if (Number(d.completedAtUtcMs) < Number(d.startedAtUtcMs)
    || d.penaltyScore !== Number(d.liftCount) * 10 + Number(d.violationDurationSeconds)) return null;
  return { version: 1, eventId: d.eventId, actorUid, roomId: d.roomId, status: d.status as GroupHistoryStatus,
    startedAtUtcMs: Number(d.startedAtUtcMs), completedAtUtcMs: Number(d.completedAtUtcMs),
    liftCount: Number(d.liftCount), violationDurationSeconds: Number(d.violationDurationSeconds), penaltyScore: Number(d.penaltyScore) };
}
export function summaryCursor(entry: GroupHistoryEntry): GroupHistoryCursor {
  return { completedAtUtcMs: entry.summary.completedAtUtcMs, roomId: entry.summary.roomId };
}
export function mergeGroupHistory(local: GroupHistoryEntry[], cloud: GroupHistoryEntry[]): GroupHistoryEntry[] {
  const map = new Map<string, GroupHistoryEntry>();
  for (const item of local) map.set(`${item.summary.actorUid}/${item.summary.roomId}`, item);
  for (const item of cloud) {
    const key = `${item.summary.actorUid}/${item.summary.roomId}`;
    // Bản server đã sửa cutoff được ưu tiên khi local không còn pending.
    if (!map.has(key) || map.get(key)!.syncStatus === 'SYNCED') map.set(key, item);
  }
  return [...map.values()].sort((a, b) => b.summary.completedAtUtcMs - a.summary.completedAtUtcMs
    || (a.summary.roomId < b.summary.roomId ? 1 : a.summary.roomId > b.summary.roomId ? -1 : 0));
}
