export type HistoryContext = {
  userId: string;
  localPremium: boolean;
  serverPremium: boolean;
  nowUtcMs: number;
};

export type SoloHistoryEntry = {
  sessionId: string;
  userId: string;
  mode: 'COUNTDOWN' | 'STOPWATCH' | null;
  durationSeconds: number;
  liftCount: number;
  violationDurationSeconds: number;
  penaltyScore: number;
  startedAt: string;
  completedAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
};
export type HistoryCursor = { completedAt: string; sessionId: string };
export type HistoryPage = { items: SoloHistoryEntry[]; cursor: HistoryCursor | null; hasMore: boolean };
export const HISTORY_PAGE_SIZE = 20;
export const FREE_HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

export function mergeHistoryEntries(current: SoloHistoryEntry[], incoming: SoloHistoryEntry[]): SoloHistoryEntry[] {
  const entries = new Map(current.map(item => [item.sessionId, item]));
  for (const item of incoming) {
    const previous = entries.get(item.sessionId);
    if (previous && previous.userId !== item.userId) continue;
    // Summary chưa ACK vẫn thuộc SQLite; cloud không được thay dữ liệu đang chờ gửi.
    if (previous && previous.syncStatus !== 'synced' && item.syncStatus === 'synced') continue;
    entries.set(item.sessionId, { ...item, mode: item.mode ?? previous?.mode ?? null });
  }
  return [...entries.values()].sort((a, b) => {
    const time = Date.parse(b.completedAt) - Date.parse(a.completedAt);
    return time || (a.sessionId < b.sessionId ? 1 : a.sessionId > b.sessionId ? -1 : 0);
  });
}

export function readCloudHistoryEntry(userId: string, sessionId: string, data: Record<string, unknown>): SoloHistoryEntry | null {
  const millis = (value: unknown): number => {
    if (typeof value !== 'object' || value === null || !('toMillis' in value) || typeof value.toMillis !== 'function') return NaN;
    return value.toMillis();
  };
  const startedAt = millis(data.startedAt);
  const completedAt = millis(data.completedAt);
  const fields = ['durationSeconds', 'liftCount', 'violationDurationSeconds', 'penaltyScore'] as const;
  if (!Number.isSafeInteger(startedAt) || !Number.isSafeInteger(completedAt) || startedAt < 0 || completedAt < startedAt
    || completedAt > 8_640_000_000_000_000
    || fields.some(field => typeof data[field] !== 'number' || !Number.isSafeInteger(data[field]) || data[field] < 0)) return null;
  const durationSeconds = data.durationSeconds as number;
  const liftCount = data.liftCount as number;
  const violationDurationSeconds = data.violationDurationSeconds as number;
  const penaltyScore = data.penaltyScore as number;
  if (durationSeconds !== Math.floor((completedAt - startedAt) / 1_000) || penaltyScore !== liftCount * 10 + violationDurationSeconds) return null;
  return {
    sessionId, userId, mode: null, durationSeconds, liftCount, violationDurationSeconds, penaltyScore,
    startedAt: new Date(startedAt).toISOString(), completedAt: new Date(completedAt).toISOString(), syncStatus: 'synced',
  };
}
