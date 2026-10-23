import type * as SQLite from 'expo-sqlite';
import { getLocalDatabase } from '../local/database';

export type FeedbackSettings = {
  hapticsEnabled: boolean;
  soundEnabled: boolean;
};

export const DEFAULT_FEEDBACK_SETTINGS: FeedbackSettings = {
  // PRD mô tả haptic là phản hồi mặc định; người dùng có thể tắt trong Settings.
  hapticsEnabled: true,
  soundEnabled: false,
};

type SettingsDatabase = Pick<SQLite.SQLiteDatabase, 'getAllAsync' | 'withExclusiveTransactionAsync'>;

export function createSettingsRepository(getDatabase: () => Promise<SettingsDatabase> = getLocalDatabase) {
  const keyFor = (uid: string, setting: keyof FeedbackSettings) => {
    if (!uid.trim()) throw new Error('A signed-in user is required to read settings.');
    return `feedback:${uid}:${setting}`;
  };

  return {
    async getFeedbackSettings(uid: string): Promise<FeedbackSettings> {
      const hapticsKey = keyFor(uid, 'hapticsEnabled');
      const soundKey = keyFor(uid, 'soundEnabled');
      const database = await getDatabase();
      const rows = await database.getAllAsync<{ key: string; value: string }>(
        'SELECT key, value FROM app_settings WHERE key IN (?, ?)', hapticsKey, soundKey,
      );
      const values = new Map(rows.map(row => [row.key, row.value]));
      return {
        hapticsEnabled: values.get(hapticsKey) === 'true'
          ? true
          : values.get(hapticsKey) === 'false' ? false : DEFAULT_FEEDBACK_SETTINGS.hapticsEnabled,
        soundEnabled: values.get(soundKey) === 'true'
          ? true
          : values.get(soundKey) === 'false' ? false : DEFAULT_FEEDBACK_SETTINGS.soundEnabled,
      };
    },

    async saveFeedbackSettings(uid: string, settings: FeedbackSettings): Promise<void> {
      const hapticsKey = keyFor(uid, 'hapticsEnabled');
      const soundKey = keyFor(uid, 'soundEnabled');
      const database = await getDatabase();
      await database.withExclusiveTransactionAsync(async transaction => {
        await transaction.runAsync(
          'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          hapticsKey, String(settings.hapticsEnabled),
        );
        await transaction.runAsync(
          'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          soundKey, String(settings.soundEnabled),
        );
      });
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
