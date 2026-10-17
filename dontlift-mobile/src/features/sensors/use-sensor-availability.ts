import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  createSensorAvailabilityController,
  type SensorAvailabilityController,
} from './sensor-availability';
import type { SensorAvailabilityState } from './sensor-adapter';

export function useSensorAvailability() {
  const controller = useRef<SensorAvailabilityController | null>(null);
  if (!controller.current) controller.current = createSensorAvailabilityController();

  const [state, setState] = useState<SensorAvailabilityState>(controller.current.getState());

  useEffect(() => {
    const activeController = controller.current;
    if (!activeController) return undefined;
    const unsubscribe = activeController.subscribe(setState);
    const appState = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void activeController.check();
    });
    void activeController.check();

    return () => {
      appState.remove();
      unsubscribe();
      activeController.dispose();
    };
  }, []);

  return {
    state,
    retry: () => controller.current?.check() ?? Promise.resolve(state),
  };
}
