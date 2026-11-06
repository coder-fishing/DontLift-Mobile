import { Colors } from './theme';

export type GroupHistoryPalette = typeof Colors.light | typeof Colors.dark;
export type GroupHistoryColorScheme = 'light' | 'dark' | null | undefined;

export function getGroupHistoryPalette(scheme: GroupHistoryColorScheme): GroupHistoryPalette {
  return scheme === 'dark' ? Colors.dark : Colors.light;
}
