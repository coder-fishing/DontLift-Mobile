import { createGroupCaptureWorkTracker } from '../src/features/rooms/group-capture-work';

test('waits for current capture work and work queued while it drains', async () => {
  const tracker = createGroupCaptureWorkTracker();
  let finishCapture!: () => void;
  let finishRecovery!: () => void;
  const capture = new Promise<void>(resolve => { finishCapture = resolve; });
  const recovery = new Promise<void>(resolve => { finishRecovery = resolve; });
  tracker.track(capture.then(() => { tracker.track(recovery); }));

  let idle = false;
  const waiting = tracker.waitForIdle().then(() => { idle = true; });
  finishCapture();
  await Promise.resolve();
  await Promise.resolve();
  expect(idle).toBe(false);

  finishRecovery();
  await waiting;
  expect(idle).toBe(true);
});
