jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(),
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    addListener: jest.fn(),
  },
}));

import { createSensorAvailabilityController } from '../src/features/sensors/sensor-availability';
import type { AccelerometerAdapter, SensorAvailabilityState } from '../src/features/sensors/sensor-adapter';

function setup() {
  let available = true;
  let permission = { granted: true, canAskAgain: true };
  let requestedPermission = permission;
  let initializeSensor: () => void = () => {};
  let initializationError: unknown;
  let listener: ((measurement: { x: number; y: number; z: number; timestamp: number }) => void) | null = null;
  let removeCount = 0;
  let resolveSubscribed!: () => void;
  const subscribed = new Promise<void>((resolve) => { resolveSubscribed = resolve; });

  const adapter: AccelerometerAdapter = {
    async isAvailableAsync() { return available; },
    async getPermissionAsync() { return permission; },
    async requestPermissionAsync() { return requestedPermission; },
    setUpdateInterval() {},
    subscribe(onMeasurement) {
      if (initializationError) throw initializationError;
      listener = onMeasurement;
      resolveSubscribed();
      initializeSensor();
      return {
        remove() {
          removeCount += 1;
          listener = null;
        },
      };
    },
  };

  const controller = createSensorAvailabilityController(adapter, 20);
  return {
    controller,
    setAvailable(value: boolean) { available = value; },
    setPermission(value: typeof permission) { permission = value; },
    setRequestedPermission(value: typeof permission) { requestedPermission = value; },
    setInitializationError(value: unknown) { initializationError = value; },
    setInitializeSensor(action: () => void) { initializeSensor = action; },
    emitMeasurement() { listener?.({ x: 0, y: 0, z: -1, timestamp: 1 }); },
    getRemoveCount() { return removeCount; },
    waitForSubscription() { return subscribed; },
  };
}

describe('sensor availability controller', () => {
  it('blocks focus when the accelerometer is unavailable', async () => {
    const state = setup();
    state.setAvailable(false);

    await expect(state.controller.check()).resolves.toEqual({ kind: 'unavailable' });
    expect(state.getRemoveCount()).toBe(0);
  });

  it('returns a recovery state when the user denies motion access', async () => {
    const state = setup();
    state.setPermission({ granted: false, canAskAgain: true });
    state.setRequestedPermission({ granted: false, canAskAgain: false });

    await expect(state.controller.check()).resolves.toEqual({
      kind: 'permission-denied',
      canAskAgain: false,
    });
    expect(state.getRemoveCount()).toBe(0);
  });

  it('does not report ready when sensor subscription initialization fails, then can retry', async () => {
    const state = setup();
    state.setInitializationError(new Error('native module unavailable'));

    await expect(state.controller.check()).resolves.toEqual({ kind: 'error' });

    state.setInitializationError(undefined);
    state.setInitializeSensor(() => state.emitMeasurement());
    await expect(state.controller.check()).resolves.toEqual({ kind: 'ready' });
    expect(state.getRemoveCount()).toBe(1);
  });

  it('stays checking until a real sensor measurement arrives', async () => {
    const state = setup();
    const checkingStates: SensorAvailabilityState[] = [];
    state.controller.subscribe((next) => checkingStates.push(next));

    const checking = state.controller.check();
    await state.waitForSubscription();
    expect(state.controller.getState()).toEqual({ kind: 'checking' });
    state.emitMeasurement();
    await expect(checking).resolves.toEqual({ kind: 'ready' });
    expect(checkingStates).toContainEqual({ kind: 'checking' });
    expect(state.getRemoveCount()).toBe(1);
  });

  it('removes the temporary sensor listener when no measurement arrives', async () => {
    const state = setup();

    await expect(state.controller.check()).resolves.toEqual({ kind: 'error' });
    expect(state.getRemoveCount()).toBe(1);
  });

  it('releases the pending listener when a check is disposed', async () => {
    const state = setup();
    const checking = state.controller.check();
    await state.waitForSubscription();

    state.controller.dispose();

    await expect(checking).resolves.toEqual({ kind: 'checking' });
    expect(state.getRemoveCount()).toBe(1);
  });
});
