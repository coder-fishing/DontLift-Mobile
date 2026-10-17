import { Accelerometer } from 'expo-sensors';

export interface SensorPermission {
  granted: boolean;
  canAskAgain: boolean;
}

export interface AccelerometerAdapter {
  isAvailableAsync(): Promise<boolean>;
  getPermissionAsync(): Promise<SensorPermission>;
  requestPermissionAsync(): Promise<SensorPermission>;
  subscribe(onMeasurement: () => void): { remove(): void };
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
  subscribe(onMeasurement) {
    return Accelerometer.addListener(() => onMeasurement());
  },
};
