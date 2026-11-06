jest.mock('../src/constants/theme', () => ({ Colors: { light: { mode: 'light' }, dark: { mode: 'dark' } } }));
import { getGroupHistoryPalette } from '../src/constants/group-history-theme';
import { Colors } from '../src/constants/theme';

test('Group History follows the system dark palette only for dark mode', () => {
  expect(getGroupHistoryPalette('dark')).toBe(Colors.dark);
  expect(getGroupHistoryPalette('light')).toBe(Colors.light);
  expect(getGroupHistoryPalette(null)).toBe(Colors.light);
});
