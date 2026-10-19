import type { AppStateStatus } from 'react-native';
import type { BackgroundRecoveryInput, BackgroundRecoveryResult } from '../src/features/solo/background-recovery';
import { createSessionLifecycleController } from '../src/features/solo/session-lifecycle-controller';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function setup(initialState: AppStateStatus = 'active') {
  let now = { utcMs: 10_000, monotonicMs: 5_000 };
  const detection = {
    orientation: 'UNKNOWN' as const, isGraceActive: false, isViolationActive: false,
    graceSeconds: 0, violationsCount: 0, violationDurationSeconds: 0,
  };
  const detector = {
    getViewState: jest.fn(() => detection),
    observeOrientation: jest.fn(async () => detection),
    initialize: jest.fn(async () => detection),
  };
  const repository = {
    begin: jest.fn(async (_input: BackgroundRecoveryInput) => 'candidate-1'),
    reconcile: jest.fn(async (_input: BackgroundRecoveryInput): Promise<BackgroundRecoveryResult> => 'confirmed'),
  };
  const onPendingChange = jest.fn();
  const onRecovered = jest.fn();
  const onError = jest.fn();
  const controller = createSessionLifecycleController({
    session: { sessionId: 'session-1', userId: 'user-1' },
    initialState,
    repository,
    getDetector: () => detector,
    captureTime: () => ({ ...now }),
    onPendingChange,
    onRecovered,
    onError,
  });
  return {
    controller, repository, detector, detection, onPendingChange, onRecovered, onError,
    advance: (ms: number) => {
      now = { utcMs: now.utcMs + ms, monotonicMs: now.monotonicMs + ms };
    },
  };
}

describe('iOS Expo Go lifecycle ordering', () => {
  test('inactive then background saves one candidate with the original transition time', async () => {
    const test = setup();
    const inactive = test.controller.handleChange('inactive');
    expect(test.onPendingChange).toHaveBeenLastCalledWith(true);
    test.advance(1_000);
    const background = test.controller.handleChange('background');
    await Promise.all([inactive, background]);
    expect(test.repository.begin).toHaveBeenCalledTimes(1);
    expect(test.repository.begin).toHaveBeenCalledWith({
      sessionId: 'session-1', userId: 'user-1',
      observedAt: { utcMs: 10_000, monotonicMs: 5_000 },
    });
    expect(test.repository.reconcile).not.toHaveBeenCalled();
  });

  test('waits for durable begin before reconciling a fast foreground return', async () => {
    const test = setup();
    const write = deferred();
    test.repository.begin.mockImplementation(async () => {
      await write.promise;
      return 'candidate-1';
    });
    const inactive = test.controller.handleChange('inactive');
    await Promise.resolve();
    test.advance(2_000);
    const active = test.controller.handleChange('active');
    test.advance(20_000);
    expect(test.repository.reconcile).not.toHaveBeenCalled();
    expect(test.onPendingChange.mock.calls.some(([pending]) => pending === false)).toBe(false);
    write.resolve();
    await Promise.all([inactive, active]);
    expect(test.repository.reconcile).toHaveBeenCalledWith({
      sessionId: 'session-1', userId: 'user-1',
      observedAt: { utcMs: 12_000, monotonicMs: 7_000 },
    });
    expect(test.onPendingChange).toHaveBeenLastCalledWith(false);
    expect(test.onRecovered).toHaveBeenCalledTimes(1);
  });

  test('does not unlock manual or countdown completion until the detector is restored', async () => {
    const test = setup();
    const restore = deferred();
    const restoreStarted = deferred();
    test.detector.initialize.mockImplementation(async () => {
      restoreStarted.resolve();
      await restore.promise;
      return test.detection;
    });
    await test.controller.handleChange('inactive');
    const active = test.controller.handleChange('active');
    await restoreStarted.promise;
    expect(test.onPendingChange.mock.calls.some(([pending]) => pending === false)).toBe(false);
    restore.resolve();
    await active;
    expect(test.onRecovered).toHaveBeenCalledWith('confirmed', test.detection);
    expect(test.onPendingChange).toHaveBeenLastCalledWith(false);
  });

  test('keeps finalization blocked when recovery fails and retries on the next foreground transition', async () => {
    const test = setup();
    test.repository.reconcile.mockRejectedValueOnce(new Error('SQLite busy'));
    await test.controller.handleChange('inactive');
    await test.controller.handleChange('active');
    expect(test.onPendingChange).toHaveBeenLastCalledWith(true);
    expect(test.onError).toHaveBeenCalledWith('reconcile');
    expect(test.onRecovered).not.toHaveBeenCalled();
    await test.controller.handleChange('inactive');
    await test.controller.handleChange('active');
    expect(test.onPendingChange).toHaveBeenLastCalledWith(false);
    expect(test.onRecovered).toHaveBeenCalledTimes(1);
  });

  test('keeps the lock if a second background transition arrives during recovery', async () => {
    const test = setup();
    const restore = deferred();
    const restoreStarted = deferred();
    test.detector.initialize.mockImplementationOnce(async () => {
      restoreStarted.resolve();
      await restore.promise;
      return test.detection;
    });
    await test.controller.handleChange('inactive');
    const active = test.controller.handleChange('active');
    await restoreStarted.promise;
    const background = test.controller.handleChange('inactive');
    restore.resolve();
    await Promise.all([active, background]);
    expect(test.onPendingChange.mock.calls.some(([pending]) => pending === false)).toBe(false);
    expect(test.onRecovered).not.toHaveBeenCalled();
    await test.controller.handleChange('active');
    expect(test.onPendingChange).toHaveBeenLastCalledWith(false);
  });

  test('does not create a second lift when a foreground violation is already open', async () => {
    const test = setup();
    test.detector.getViewState.mockReturnValue({ ...test.detection, isViolationActive: true });
    await test.controller.handleChange('inactive');
    expect(test.repository.begin).not.toHaveBeenCalled();
    await test.controller.handleChange('active');
    expect(test.detector.initialize).toHaveBeenCalledTimes(1);
    expect(test.onPendingChange).toHaveBeenLastCalledWith(false);
  });

  test('does not publish recovery to a disposed screen', async () => {
    const test = setup();
    const restore = deferred();
    const restoreStarted = deferred();
    test.detector.initialize.mockImplementation(async () => {
      restoreStarted.resolve();
      await restore.promise;
      return test.detection;
    });
    await test.controller.handleChange('inactive');
    const active = test.controller.handleChange('active');
    await restoreStarted.promise;
    test.controller.dispose();
    restore.resolve();
    await active;
    expect(test.onRecovered).not.toHaveBeenCalled();
    expect(test.onPendingChange.mock.calls.some(([pending]) => pending === false)).toBe(false);
  });

  test('replays background transitions captured while session persistence was pending', async () => {
    const test = setup();
    const departure = { utcMs: 20_000, monotonicMs: 15_000 };
    const resume = { utcMs: 24_000, monotonicMs: 19_000 };
    const leaving = test.controller.handleChangeAt('inactive', departure);
    const returning = test.controller.handleChangeAt('active', resume);
    await Promise.all([leaving, returning]);
    expect(test.repository.begin).toHaveBeenCalledWith({
      sessionId: 'session-1', userId: 'user-1', observedAt: departure,
    });
    expect(test.repository.reconcile).toHaveBeenCalledWith({
      sessionId: 'session-1', userId: 'user-1', observedAt: resume,
    });
    expect(test.onRecovered).toHaveBeenCalledWith('confirmed', test.detection);
    expect(test.onPendingChange).toHaveBeenLastCalledWith(false);
  });
  test('ignores duplicate active notifications', async () => {
    const test = setup();
    await test.controller.handleChange('active');
    await test.controller.handleChange('active');
    expect(test.repository.begin).not.toHaveBeenCalled();
    expect(test.repository.reconcile).not.toHaveBeenCalled();
  });
});
describe('lifecycle persistence retry timestamps', () => {
  test('retries a failed reconciliation with the first resume timestamp before starting a new cycle', async () => {
    const test = setup();
    await test.controller.handleChange('inactive');
    test.advance(4_000);
    test.repository.reconcile.mockRejectedValueOnce(new Error('busy'));
    await test.controller.handleChange('active');
    test.advance(60_000);
    await test.controller.handleChange('inactive');
    const calls = test.repository.reconcile.mock.calls;
    expect(calls[0][0].observedAt?.utcMs).toBe(14_000);
    expect(calls[1][0].observedAt?.utcMs).toBe(14_000);
    expect(test.onPendingChange).toHaveBeenLastCalledWith(true);
    test.advance(2_000);
    await test.controller.handleChange('active');
    expect(test.onPendingChange).toHaveBeenLastCalledWith(false);
    expect(test.onRecovered).toHaveBeenCalledTimes(1);
  });

  test('retries a failed candidate write using the initial inactive timestamp', async () => {
    const test = setup();
    test.repository.begin.mockRejectedValueOnce(new Error('busy'));
    await test.controller.handleChange('inactive');
    test.advance(2_000);
    await test.controller.handleChange('active');
    expect(test.repository.begin).toHaveBeenCalledTimes(2);
    expect(test.repository.begin.mock.calls[0]).toEqual(test.repository.begin.mock.calls[1]);
    expect(test.onPendingChange).toHaveBeenLastCalledWith(false);
  });

  test('keeps finalization locked when detector restoration fails after a successful database recovery', async () => {
    const test = setup();
    test.repository.reconcile.mockResolvedValueOnce('needs-review');
    test.detector.initialize.mockRejectedValueOnce(new Error('read failed'));
    await test.controller.handleChange('inactive');
    await test.controller.handleChange('active');
    expect(test.onPendingChange).toHaveBeenLastCalledWith(true);
    expect(test.onRecovered).not.toHaveBeenCalled();
    expect(test.onError).toHaveBeenCalledWith('reconcile');
    // Duplicate active có thể retry thao tác cũ, không tạo thêm một lần rời app.
    await test.controller.handleChange('active');
    expect(test.repository.begin).toHaveBeenCalledTimes(1);
    expect(test.repository.reconcile).toHaveBeenCalledTimes(1);
    expect(test.onRecovered).toHaveBeenCalledWith('needs-review', test.detection);
    expect(test.onPendingChange).toHaveBeenLastCalledWith(false);
  });
});