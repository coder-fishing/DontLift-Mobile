import type { SettingsRepository } from './settings-repository';

export type FeedbackAdapters = {
  vibrate: () => Promise<void>;
  playSound: () => Promise<void>;
  playEndSessionSound?: () => Promise<void>;
};

export function createFeedbackService(settings: Pick<SettingsRepository, 'getFeedbackSettings'>, adapters: FeedbackAdapters) {
  return {
    async notifySoloSessionCompleted(): Promise<void> {
      try {
        // The completion ring is separate from the optional violation beep setting.
        await Promise.resolve().then(() => adapters.playEndSessionSound?.()).catch(() => undefined);
      } catch {
        // Audio/settings lỗi không được ảnh hưởng kết quả session đã lưu.
      }
    },

    async notifyConfirmedViolation(uid: string): Promise<void> {
      try {
        const preferences = await settings.getFeedbackSettings(uid);
        const feedback: Array<() => Promise<void>> = [];
        if (preferences.hapticsEnabled) feedback.push(adapters.vibrate);
        if (preferences.soundEnabled) feedback.push(adapters.playSound);
        // Mỗi capability độc lập; lỗi một adapter không chặn adapter còn lại.
        await Promise.allSettled(feedback.map(run => Promise.resolve().then(run)));
      } catch {
        // Settings/native runtime lỗi không được ảnh hưởng bản ghi vi phạm hoặc điểm.
      }
    },
  };
}
