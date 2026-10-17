import {
  accelerometerAdapter,
  type AccelerometerAdapter,
  type SensorAvailabilityState,
} from './sensor-adapter';

const FIRST_MEASUREMENT_TIMEOUT_MS = 2_500;

function waitForMeasurement(adapter: AccelerometerAdapter, timeoutMs: number) {
  let finishCheck: ((error?: Error) => void) | undefined;
  const promise = new Promise<void>((resolve, reject) => {
    let settled = false;
    let subscription: { remove(): void } | undefined;
    const timeout = setTimeout(() => finish(new Error('Accelerometer did not respond.')), timeoutMs);

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription?.remove();
      finishCheck = undefined;
      if (error) reject(error);
      else resolve();
    }
    finishCheck = finish;

    try {
      subscription = adapter.subscribe(() => finish());
      if (settled) subscription.remove();
    } catch {
      finish(new Error('Accelerometer listener could not be initialized.'));
    }
  });
  return {
    promise,
    cancel: () => finishCheck?.(),
  };
}

export function createSensorAvailabilityController(
  adapter: AccelerometerAdapter = accelerometerAdapter,
  firstMeasurementTimeoutMs = FIRST_MEASUREMENT_TIMEOUT_MS,
) {
  let state: SensorAvailabilityState = { kind: 'checking' };
  let attempt = 0;
  let cancelMeasurement: (() => void) | undefined;
  const listeners = new Set<(next: SensorAvailabilityState) => void>();

  function publish(next: SensorAvailabilityState) {
    state = next;
    for (const listener of listeners) listener(next);
  }

  return {
    getState: () => state,
    subscribe(listener: (next: SensorAvailabilityState) => void) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    async check(): Promise<SensorAvailabilityState> {
      cancelMeasurement?.();
      cancelMeasurement = undefined;
      const currentAttempt = ++attempt;
      publish({ kind: 'checking' });
      try {
        if (!await adapter.isAvailableAsync()) {
          if (attempt === currentAttempt) publish({ kind: 'unavailable' });
          return state;
        }
        if (attempt !== currentAttempt) return state;

        let permission = await adapter.getPermissionAsync();
        if (!permission.granted && permission.canAskAgain) {
          permission = await adapter.requestPermissionAsync();
        }
        if (attempt !== currentAttempt) return state;
        if (!permission.granted) {
          const denied: SensorAvailabilityState = {
            kind: 'permission-denied',
            canAskAgain: permission.canAskAgain,
          };
          publish(denied);
          return denied;
        }

        const measurementCheck = waitForMeasurement(adapter, firstMeasurementTimeoutMs);
        cancelMeasurement = measurementCheck.cancel;
        await measurementCheck.promise;
        if (cancelMeasurement === measurementCheck.cancel) cancelMeasurement = undefined;
        if (attempt === currentAttempt) publish({ kind: 'ready' });
      } catch {
        if (attempt === currentAttempt) publish({ kind: 'error' });
      }
      return state;
    },
    dispose() {
      attempt += 1;
      cancelMeasurement?.();
      cancelMeasurement = undefined;
      listeners.clear();
    },
  };
}

export type SensorAvailabilityController = ReturnType<typeof createSensorAvailabilityController>;
