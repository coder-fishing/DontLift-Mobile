import { mergeHistoryEntries, type HistoryContext, type HistoryCursor, type HistoryPage, type SoloHistoryEntry } from './history-model';

export interface HistoryRepository {
  readLocalPage(cursor: HistoryCursor | null, context: HistoryContext): Promise<HistoryPage>;
  readCloudPage(cursor: HistoryCursor | null, context: HistoryContext): Promise<HistoryPage>;
}
export type HistoryState = {
  items: SoloHistoryEntry[];
  loading: boolean;
  loadingMore: boolean;
  cloudLoading: boolean;
  offline: boolean;
  error: string | null;
  hasMore: boolean;
};

export function createHistoryController(repository: HistoryRepository, context: HistoryContext, onChange: (state: HistoryState) => void) {
  let state: HistoryState = { items: [], loading: true, loadingMore: false, cloudLoading: false, offline: false, error: null, hasMore: false };
  let generation = 0;
  let disposed = false;
  let localCursor: HistoryCursor | null = null;
  let cloudCursor: HistoryCursor | null = null;
  let localHasMore = true;
  let cloudHasMore = true;
  let pageContext = context;
  const publish = (patch: Partial<HistoryState>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    onChange(state);
  };
  const accept = (page: HistoryPage, source: 'local' | 'cloud', replace = false) => {
    if (source === 'local') { localCursor = page.cursor; localHasMore = page.hasMore; }
    else { cloudCursor = page.cursor; cloudHasMore = page.hasMore; }
    const incoming = page.items.filter(item => item.userId === context.userId);
    const localIds = new Set(incoming.map(item => item.sessionId));
    const previous = replace ? [] : source === 'local'
      ? state.items.filter(item => !localIds.has(item.sessionId)) : state.items;
    publish({ items: mergeHistoryEntries(previous, incoming), hasMore: localHasMore || (!state.offline && cloudHasMore) });
  };
  const load = async (online: boolean, nowUtcMs = context.nowUtcMs) => {
    if (disposed) return;
    const request = ++generation;
    const currentContext = { ...context, nowUtcMs };
    pageContext = currentContext;
    localCursor = cloudCursor = null;
    localHasMore = cloudHasMore = true;
    publish({ loading: state.items.length === 0, loadingMore: false, cloudLoading: online, offline: !online, error: null });
    try {
      const local = await repository.readLocalPage(null, currentContext);
      if (disposed || request !== generation) return;
      // Đẩy local lên UI trước khi chờ Firestore, để offline vẫn mở được lịch sử.
      accept(local, 'local', true);
      publish({ loading: false });
    } catch {
      if (disposed || request !== generation) return;
      publish({ loading: false, error: 'Could not read history on this device. Retry to load it again.' });
    }
    if (!online || disposed || request !== generation) { publish({ cloudLoading: false }); return; }
    try {
      const cloud = await repository.readCloudPage(null, currentContext);
      if (disposed || request !== generation) return;
      accept(cloud, 'cloud');
    } catch {
      if (disposed || request !== generation) return;
      publish({ error: 'Cloud history is unavailable. Saved sessions are still available; retry when connected.' });
    } finally {
      if (!disposed && request === generation) publish({ loading: false, cloudLoading: false });
    }
  };
  const loadMore = async () => {
    if (disposed || state.loading || state.loadingMore || state.cloudLoading || !state.hasMore) return;
    const request = generation;
    publish({ loadingMore: true, error: null });
    try {
      if (localHasMore) {
        const page = await repository.readLocalPage(localCursor, pageContext);
        if (disposed || request !== generation) return;
        accept(page, 'local');
      }
      if (!state.offline && cloudHasMore) {
        const page = await repository.readCloudPage(cloudCursor, pageContext);
        if (disposed || request !== generation) return;
        accept(page, 'cloud');
      }
    } catch {
      if (!disposed && request === generation) publish({ error: 'Could not load more sessions. Your current list is preserved.' });
    } finally {
      if (!disposed && request === generation) publish({ loadingMore: false });
    }
  };
  return { getState: () => state, load, loadMore, dispose() { disposed = true; generation += 1; } };
}
