import { createHistoryController, type HistoryRepository } from '../src/features/history/history-controller';
import { mergeHistoryEntries, readCloudHistoryEntry, type SoloHistoryEntry, type HistoryPage } from '../src/features/history/history-model';

const entry = (id: string, completedAt = '2026-10-19T10:00:00.000Z', syncStatus: SoloHistoryEntry['syncStatus'] = 'synced'): SoloHistoryEntry => ({
  sessionId: id, userId: 'owner', mode: 'COUNTDOWN', durationSeconds: 60,
  liftCount: 1, violationDurationSeconds: 4, penaltyScore: 14,
  startedAt: new Date(Date.parse(completedAt) - 60_000).toISOString(), completedAt, syncStatus,
});
const page = (items: SoloHistoryEntry[], hasMore = false): HistoryPage => ({
  items, hasMore, cursor: items.length ? { completedAt: items[items.length - 1].completedAt, sessionId: items[items.length - 1].sessionId } : null,
});
const context = { userId: 'owner', localPremium: false, serverPremium: false, nowUtcMs: Date.parse('2026-10-19T12:00:00Z') };
function setup(overrides: Partial<HistoryRepository> = {}) {
  const repository: HistoryRepository = {
    readLocalPage: jest.fn(async () => page([entry('local', undefined, 'pending')])),
    readCloudPage: jest.fn(async () => page([entry('cloud')])),
    ...overrides,
  };
  const changed = jest.fn();
  const controller = createHistoryController(repository, context, changed);
  return { controller, repository, changed };
}

test('overlapping pages have stable order and only one row per session', () => {
  expect(mergeHistoryEntries([entry('b'), entry('a')], [entry('b'), entry('c', '2026-10-18T10:00:00Z')]).map(item => item.sessionId)).toEqual(['b', 'a', 'c']);
});

test('canonical cloud data replaces synced rows but never overwrites an unsynced local summary', () => {
  const pending = entry('same', undefined, 'pending');
  expect(mergeHistoryEntries([pending], [{ ...pending, syncStatus: 'synced', penaltyScore: 99 }])[0]).toEqual(pending);
  expect(mergeHistoryEntries([entry('same')], [{ ...entry('same'), mode: null, penaltyScore: 20 }])[0]).toMatchObject({ mode: 'COUNTDOWN', penaltyScore: 20 });
});

test('cloud summaries retain canonical metrics without inventing a timer mode', () => {
  const data = { durationSeconds: 60, liftCount: 2, violationDurationSeconds: 5, penaltyScore: 25,
    startedAt: { toMillis: () => 1_000 }, completedAt: { toMillis: () => 61_000 } };
  expect(readCloudHistoryEntry('owner', 'session', data)).toMatchObject({ mode: null, syncStatus: 'synced', penaltyScore: 25 });
  expect(readCloudHistoryEntry('owner', 'bad', { ...data, penaltyScore: -1 })).toBeNull();
  expect(readCloudHistoryEntry('owner', 'bad', { ...data, completedAt: null })).toBeNull();
});

test('offline shows local history without requesting cloud', async () => {
  const { controller, repository } = setup();
  await controller.load(false);
  expect(controller.getState()).toMatchObject({ offline: true, loading: false, items: [expect.objectContaining({ sessionId: 'local' })] });
  expect(repository.readCloudPage).not.toHaveBeenCalled();
});

test('offline without history finishes loading with an empty list', async () => {
  const { controller } = setup({ readLocalPage: async () => page([]) });
  await controller.load(false);
  expect(controller.getState()).toMatchObject({ items: [], loading: false, cloudLoading: false, offline: true, hasMore: false });
});

test('cloud failure preserves local rows and retry fills gaps without duplicates', async () => {
  const readCloudPage = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(page([entry('cloud'), entry('local')]));
  const { controller } = setup({ readCloudPage });
  await controller.load(true);
  expect(controller.getState()).toMatchObject({ error: expect.any(String), items: [expect.objectContaining({ sessionId: 'local' })] });
  await controller.load(true);
  expect(controller.getState().items).toHaveLength(2);
  expect(controller.getState().error).toBeNull();
});

test('local rows publish before a delayed cloud request finishes', async () => {
  let resolveCloud!: (value: HistoryPage) => void;
  const { controller } = setup({ readCloudPage: () => new Promise(resolve => { resolveCloud = resolve; }) });
  const loading = controller.load(true);
  await Promise.resolve();
  expect(controller.getState().items[0].sessionId).toBe('local');
  resolveCloud(page([entry('cloud')]));
  await loading;
});

test('pagination merges overlap and keeps independent cursors', async () => {
  const readLocalPage = jest.fn().mockResolvedValueOnce(page([entry('a')], true)).mockResolvedValue(page([entry('a'), entry('b')]));
  const readCloudPage = jest.fn().mockResolvedValueOnce(page([entry('b')], true)).mockResolvedValue(page([entry('b'), entry('c')]));
  const { controller } = setup({ readLocalPage, readCloudPage });
  await controller.load(true);
  await controller.loadMore();
  expect(controller.getState().items).toHaveLength(3);
  expect(controller.getState().hasMore).toBe(false);
  expect(readLocalPage.mock.calls[1][0]).toMatchObject({ sessionId: 'a' });
  expect(readCloudPage.mock.calls[1][0]).toMatchObject({ sessionId: 'b' });
});

test('pagination retries the same cursor after a cloud failure', async () => {
  const readCloudPage = jest.fn().mockResolvedValueOnce(page([entry('a')], true))
    .mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(page([entry('b')]));
  const { controller } = setup({ readLocalPage: async () => page([]), readCloudPage });
  await controller.load(true);
  await controller.loadMore();
  expect(controller.getState()).toMatchObject({ items: [entry('a')], error: expect.any(String), hasMore: true });
  await controller.loadMore();
  expect(readCloudPage.mock.calls[1][0]).toEqual(readCloudPage.mock.calls[2][0]);
  expect(controller.getState().items).toHaveLength(2);
});

test('disposed controller ignores an in-flight result after account change', async () => {
  let resolveCloud!: (value: HistoryPage) => void;
  const { controller, changed } = setup({ readCloudPage: () => new Promise(resolve => { resolveCloud = resolve; }) });
  const loading = controller.load(true);
  await Promise.resolve();
  controller.dispose();
  changed.mockClear();
  resolveCloud(page([entry('private')]));
  await loading;
  expect(changed).not.toHaveBeenCalled();
});

test('refresh replaces stale local sync status and removes rows outside the new local page', async () => {
  const readLocalPage = jest.fn().mockResolvedValueOnce(page([entry('same', undefined, 'pending'), entry('expired')]))
    .mockResolvedValueOnce(page([entry('same', undefined, 'synced')]));
  const { controller } = setup({ readLocalPage });
  await controller.load(false);
  await controller.load(false);
  expect(controller.getState().items).toEqual([entry('same')]);
});

test('refresh advances the retention cutoff while pagination keeps one consistent cutoff', async () => {
  const { controller, repository } = setup({ readLocalPage: jest.fn(async () => page([entry('a')], true)) });
  const now = context.nowUtcMs + 86_400_000;
  await controller.load(true, now);
  await controller.loadMore();
  expect(repository.readLocalPage).toHaveBeenNthCalledWith(1, null, expect.objectContaining({ nowUtcMs: now }));
  expect(repository.readLocalPage).toHaveBeenNthCalledWith(2, expect.any(Object), expect.objectContaining({ nowUtcMs: now }));
});
