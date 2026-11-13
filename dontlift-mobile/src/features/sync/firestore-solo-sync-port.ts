import * as Crypto from 'expo-crypto';
import type { Auth } from 'firebase/auth';
import { doc, runTransaction, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore';
import type { SoloSyncOutcome, SoloSyncWireEvent, SyncWorkerTransport } from './sync-worker';

type FirestoreSoloSyncPortInput = {
  firestore: Firestore;
  auth: Auth;
  userId: string;
  now?: () => number;
};

function canonicalEvent(event: SoloSyncWireEvent): string {
  return JSON.stringify({
    eventId: event.eventId,
    eventType: event.eventType,
    schemaVersion: event.schemaVersion,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    sessionId: event.sessionId,
    occurredAtUtcMs: event.occurredAtUtcMs,
    payload: {
      durationSeconds: event.payload.durationSeconds,
      liftCount: event.payload.liftCount,
      violationDurationSeconds: event.payload.violationDurationSeconds,
      penaltyScore: event.payload.penaltyScore,
      startedAtUtcMs: event.payload.startedAtUtcMs,
      completedAtUtcMs: event.payload.completedAtUtcMs,
    },
  });
}

function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error) || typeof error.code !== 'string') {
    return 'unavailable';
  }
  return error.code.replace(/^firestore\//, '').slice(0, 80);
}

function isPermanent(code: string): boolean {
  return ['invalid-argument', 'permission-denied', 'failed-precondition', 'not-found', 'already-exists'].includes(code);
}

export function createFirestoreSoloSyncPort(input: FirestoreSoloSyncPortInput): SyncWorkerTransport {
  const now = input.now ?? Date.now;

  async function sendOne(event: SoloSyncWireEvent): Promise<SoloSyncOutcome> {
    if (input.auth.currentUser?.uid !== input.userId) {
      return { eventId: event.eventId, status: 'FAILED', retryable: true, errorCode: 'unauthenticated' };
    }

    const destinationRef = `users/${input.userId}/sessions/${event.sessionId}`;
    try {
      const payloadHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        canonicalEvent(event),
      );
      if (input.auth.currentUser?.uid !== input.userId) {
        return { eventId: event.eventId, status: 'FAILED', retryable: true, errorCode: 'unauthenticated' };
      }
      const summaryRef = doc(input.firestore, 'users', input.userId, 'sessions', event.sessionId);
      const payload = {
        durationSeconds: event.payload.durationSeconds,
        liftCount: event.payload.liftCount,
        violationDurationSeconds: event.payload.violationDurationSeconds,
        penaltyScore: event.payload.penaltyScore,
        startedAt: Timestamp.fromMillis(event.payload.startedAtUtcMs),
        completedAt: Timestamp.fromMillis(event.payload.completedAtUtcMs),
        payloadHash,
        createdAt: serverTimestamp(),
      };

      await runTransaction(input.firestore, async transaction => {
        const existing = await transaction.get(summaryRef);
        if (existing.exists()) {
          if (existing.data()?.payloadHash !== payloadHash) {
            throw Object.assign(new Error('A different Solo summary already uses this session ID.'), {
              code: 'already-exists',
            });
          }
          return;
        }
        transaction.set(summaryRef, payload);
      });

      return { eventId: event.eventId, status: 'SYNCED', retryable: false, destinationRef };
    } catch (error) {
      const code = errorCode(error);
      return {
        eventId: event.eventId,
        status: 'FAILED',
        retryable: !isPermanent(code),
        errorCode: code,
      };
    }
  }

  return {
    async sendBatch(events) {
      const outcomes = await Promise.all(events.map(sendOne));
      return { version: 1, serverTimeUtcMs: now(), outcomes };
    },
  };
}
