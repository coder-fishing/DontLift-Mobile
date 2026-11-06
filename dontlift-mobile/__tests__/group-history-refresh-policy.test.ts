import { shouldRefreshGroupHistoryOnReconnect } from '../src/features/history/group-history-refresh-policy';

test('only an offline to online edge requests an automatic History refresh', () => {
  expect(shouldRefreshGroupHistoryOnReconnect(false, true)).toBe(true);
  expect(shouldRefreshGroupHistoryOnReconnect(true, true)).toBe(false);
  expect(shouldRefreshGroupHistoryOnReconnect(true, false)).toBe(false);
  expect(shouldRefreshGroupHistoryOnReconnect(null, true)).toBe(false);
});
