import { classifyPhoneOrientation } from '../src/features/sensors/phone-down-engine';
import { GRACE_PERIOD_MS, GracePeriodEngine } from '../src/features/solo/grace-period-engine';
import { createForegroundDetectionController } from '../src/features/solo/foreground-detection-controller';

describe('phone-down orientation', () => {
  test('distinguishes unknown, face-down, lifted and unusable samples', () => {
    expect(classifyPhoneOrientation(null)).toBe('UNKNOWN');
    expect(classifyPhoneOrientation({ x: 0, y: 0, z: -1 })).toBe('FACE_DOWN');
    expect(classifyPhoneOrientation({ x: 0, y: 0, z: 1 })).toBe('LIFTED');
    expect(classifyPhoneOrientation({ x: 0, y: 0, z: Number.NaN })).toBe('INVALID');
    expect(classifyPhoneOrientation({ x: 0, y: 0, z: 2 })).toBe('INVALID');
  });
});

describe('foreground grace period', () => {
  test('cancels a candidate when the phone returns face-down before three seconds', () => {
    const engine = new GracePeriodEngine();
    engine.observe('FACE_DOWN', 10_000);
    const candidate = engine.observe('LIFTED', 11_000);

    expect(candidate.graceRemainingMs).toBe(GRACE_PERIOD_MS);
    expect(engine.snapshot(13_900).shouldConfirm).toBe(false);
    const grounded = engine.observe('FACE_DOWN', 13_900);

    expect(grounded.candidateStartedAtUtcMs).toBeNull();
    expect(grounded.shouldConfirm).toBe(false);
  });

  test('confirms once after three seconds and ends the violation on re-ground', () => {
    const engine = new GracePeriodEngine();
    engine.observe('LIFTED', 20_000);

    expect(engine.snapshot(20_000 + GRACE_PERIOD_MS - 1).shouldConfirm).toBe(false);
    expect(engine.snapshot(20_000 + GRACE_PERIOD_MS).shouldConfirm).toBe(true);

    engine.markConfirmed('event-1', 23_000);
    expect(engine.observe('LIFTED', 23_200).shouldConfirm).toBe(false);
    expect(engine.observe('LIFTED', 24_000).activeViolation?.eventId).toBe('event-1');
    expect(engine.observe('FACE_DOWN', 24_500).shouldEndViolation).toBe(true);

    engine.markEnded();
    expect(engine.observe('FACE_DOWN', 24_501).activeViolation).toBeNull();
  });

  test('keeps a violation due when the phone returns face-down after the grace deadline', () => {
    const engine = new GracePeriodEngine();
    engine.observe('LIFTED', 25_000);
    const groundedAfterDeadline = engine.observe('FACE_DOWN', 28_000);

    expect(groundedAfterDeadline.shouldConfirm).toBe(true);
    engine.markConfirmed('event-3', 28_000);
    expect(engine.snapshot(28_000).shouldEndViolation).toBe(true);
  });

  test('does not treat UNKNOWN samples as a clean state or start a violation', () => {
    const engine = new GracePeriodEngine();
    const unknown = engine.observe('UNKNOWN', 30_000);

    expect(unknown.candidateStartedAtUtcMs).toBeNull();
    expect(unknown.graceRemainingMs).toBeNull();
    expect(unknown.shouldConfirm).toBe(false);
  });

  test('clears an unconfirmed candidate when sensor data becomes UNKNOWN', () => {
    const engine = new GracePeriodEngine();
    engine.observe('LIFTED', 35_000);
    const stale = engine.observe('UNKNOWN', 36_000);

    expect(stale.candidateStartedAtUtcMs).toBeNull();
    expect(stale.shouldConfirm).toBe(false);
  });

  test('retries confirmation without creating engine state before persistence succeeds', () => {
    const engine = new GracePeriodEngine();
    engine.observe('INVALID', 40_000);
    const due = engine.snapshot(43_000);

    expect(due.shouldConfirm).toBe(true);
    expect(engine.snapshot(43_100).shouldConfirm).toBe(true);
    engine.markConfirmed('event-2', 43_100);
    expect(engine.snapshot(50_000).shouldConfirm).toBe(false);
  });
});

describe('foreground detection persistence', () => {
  test('persists only after the grace deadline and closes duration on re-ground', async () => {
    const repository = {
      start: jest.fn(async (input) => ({
        eventId: 'event-1',
        sessionId: input.sessionId,
        startedAtUtcMs: input.startedAtUtcMs,
        endedAtUtcMs: null,
        durationSeconds: 3,
      })),
      end: jest.fn(async () => true),
      getSummary: jest.fn(async () => ({ count: 0, durationSeconds: 0 })),
    };
    const controller = createForegroundDetectionController(
      { id: 'session-1', userId: 'owner-1' },
      repository,
    );
    await controller.initialize();
    await controller.observeOrientation('LIFTED', 1_000);
    expect(repository.start).not.toHaveBeenCalled();

    await controller.observeOrientation('LIFTED', 4_000);
    const confirmed = await controller.tick(1_000 + GRACE_PERIOD_MS);
    expect(repository.start).toHaveBeenCalledTimes(1);
    expect(confirmed).toMatchObject({ isViolationActive: true, violationsCount: 1, violationDurationSeconds: 3 });

    const stillActive = await controller.observeOrientation('LIFTED', 5_000);
    expect(repository.start).toHaveBeenCalledTimes(1);
    expect(stillActive.violationDurationSeconds).toBe(4);

    const ended = await controller.observeOrientation('FACE_DOWN', 6_000);
    expect(repository.end).toHaveBeenCalledWith({ eventId: 'event-1', endedAtUtcMs: 6_000 });
    expect(ended).toMatchObject({ isViolationActive: false, violationsCount: 1, violationDurationSeconds: 5 });
  });

  test('keeps a failed local write pending and retries without showing a false violation', async () => {
    const repository = {
      start: jest.fn()
        .mockRejectedValueOnce(new Error('disk unavailable'))
        .mockResolvedValueOnce({
          eventId: 'event-2', sessionId: 'session-1', startedAtUtcMs: 10_000,
          endedAtUtcMs: null, durationSeconds: 3,
        }),
      end: jest.fn(async () => true),
      getSummary: jest.fn(async () => ({ count: 0, durationSeconds: 0 })),
    };
    const controller = createForegroundDetectionController({ id: 'session-1', userId: 'owner-1' }, repository);
    await controller.initialize();
    await controller.observeOrientation('LIFTED', 10_000);

    await controller.observeOrientation('LIFTED', 12_999);
    const failed = await controller.tick(13_000);
    expect(failed).toMatchObject({ isViolationActive: false, violationsCount: 0 });
    expect(failed.persistenceError).toBeDefined();
    await controller.observeOrientation('LIFTED', 13_999);
    await controller.tick(13_999);
    expect(repository.start).toHaveBeenCalledTimes(1);

    const retried = await controller.tick(14_000);
    expect(repository.start).toHaveBeenCalledTimes(2);
    expect(retried).toMatchObject({ isViolationActive: true, violationsCount: 1 });
    expect(retried.persistenceError).toBeUndefined();
  });
});
