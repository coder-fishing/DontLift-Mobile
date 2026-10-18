import { Accelerometer, type AccelerometerMeasurement } from 'expo-sensors';

export interface SensorPermission {
  granted: boolean;
  canAskAgain: boolean;
}

export interface AccelerometerAdapter {
  isAvailableAsync(): Promise<boolean>;
  getPermissionAsync(): Promise<SensorPermission>;
  requestPermissionAsync(): Promise<SensorPermission>;
  setUpdateInterval(intervalMs: number): void;
  subscribe(onMeasurement: (measurement: AccelerometerMeasurement) => void): { remove(): void };
}

export type SensorAvailabilityState =
  | { kind: 'checking' }
  | { kind: 'ready' }
  | { kind: 'permission-denied'; canAskAgain: boolean }
  | { kind: 'unavailable' }
  | { kind: 'error' };

export const accelerometerAdapter: AccelerometerAdapter = {
  isAvailableAsync: () => Accelerometer.isAvailableAsync(),
  async getPermissionAsync() {
    const permission = await Accelerometer.getPermissionsAsync();
    return { granted: permission.granted, canAskAgain: permission.canAskAgain };
  },
  async requestPermissionAsync() {
    const permission = await Accelerometer.requestPermissionsAsync();
    return { granted: permission.granted, canAskAgain: permission.canAskAgain };
  },
  setUpdateInterval: (intervalMs) => Accelerometer.setUpdateInterval(intervalMs),
  subscribe(onMeasurement) {
    return Accelerometer.addListener(onMeasurement);
  },
};
