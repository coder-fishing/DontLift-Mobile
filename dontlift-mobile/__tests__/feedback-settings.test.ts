import { createFeedbackService } from '../src/features/settings/feedback-service';
import { DEFAULT_FEEDBACK_SETTINGS } from '../src/features/settings/settings-repository';

describe('feedback preferences and adapters', () => {
  test('defaults to haptic only and does not play sound', async () => {
    const settings = { getFeedbackSettings: jest.fn(async () => DEFAULT_FEEDBACK_SETTINGS) };
    const adapters = { vibrate: jest.fn(async () => undefined), playSound: jest.fn(async () => undefined) };
    const service = createFeedbackService(settings, adapters);

    await service.notifyConfirmedViolation('owner-1');

    expect(settings.getFeedbackSettings).toHaveBeenCalledWith('owner-1');
    expect(adapters.vibrate).toHaveBeenCalledTimes(1);
    expect(adapters.playSound).not.toHaveBeenCalled();
  });

  test('plays only selected feedback and tolerates a failing native capability', async () => {
    const settings = { getFeedbackSettings: jest.fn(async () => ({ hapticsEnabled: false, soundEnabled: true })) };
    const adapters = {
      vibrate: jest.fn(async () => undefined),
      playSound: jest.fn(async () => { throw new Error('Audio unavailable'); }),
    };
    const service = createFeedbackService(settings, adapters);

    await expect(service.notifyConfirmedViolation('owner-1')).resolves.toBeUndefined();

    expect(adapters.vibrate).not.toHaveBeenCalled();
    expect(adapters.playSound).toHaveBeenCalledTimes(1);
  });

  test('does not let a haptic failure prevent enabled sound', async () => {
    const settings = { getFeedbackSettings: jest.fn(async () => ({ hapticsEnabled: true, soundEnabled: true })) };
    const adapters = {
      vibrate: jest.fn(async () => { throw new Error('Haptics unavailable'); }),
      playSound: jest.fn(async () => undefined),
    };
    const service = createFeedbackService(settings, adapters);

    await service.notifyConfirmedViolation('owner-1');

    expect(adapters.vibrate).toHaveBeenCalledTimes(1);
    expect(adapters.playSound).toHaveBeenCalledTimes(1);
  });
});
