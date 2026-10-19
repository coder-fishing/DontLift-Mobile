import { httpsCallable, type Functions } from 'firebase/functions';
import type { SoloSyncOutcome } from './sync-worker';

type SoloSyncWireEvent = {
  eventId: string;
  eventType: 'SOLO_SESSION_COMPLETED';
  schemaVersion: 1;
  aggregateType: 'SOLO_SESSION';
  aggregateId: string;
  sessionId: string;
  occurredAtUtcMs: number;
  payload: {
    durationSeconds: number;
    liftCount: number;
    violationDurationSeconds: number;
    penaltyScore: number;
    startedAtUtcMs: number;
    completedAtUtcMs: number;
  };
};

export function createSyncEventsPort(functions: Functions) {
  const callSyncEvents = httpsCallable<
    { version: 1; events: SoloSyncWireEvent[] },
    { version: 1; serverTimeUtcMs: number; outcomes: SoloSyncOutcome[] }
  >(functions, 'syncEvents');

  return {
    async sendBatch(events: SoloSyncWireEvent[]) {
      const result = await callSyncEvents({ version: 1, events });
      return result.data;
    },
  };
}
