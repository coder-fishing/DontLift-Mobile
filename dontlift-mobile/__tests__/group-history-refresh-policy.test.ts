import { shouldRefreshGroupHistoryOnReconnect } from '../src/features/history/group-history-refresh-policy';

test('refreshes only on an observed offline-to-online transition', () => {
  expect(shouldRefreshGroupHistoryOnReconnect(false, true)).toBe(true);
  expect(shouldRefreshGroupHistoryOnReconnect(false, false)).toBe(false);
  expect(shouldRefreshGroupHistoryOnReconnect(true, true)).toBe(false);
  expect(shouldRefreshGroupHistoryOnReconnect(true, false)).toBe(false);
  expect(shouldRefreshGroupHistoryOnReconnect(null, true)).toBe(false);
});
