'use strict';

const { createHash } = require('node:crypto');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH_SIZE = 20;

function fail(errorCode) {
  return { status: 'FAILED', retryable: false, errorCode };
}

function canonicalEvent(event) {
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

function validateSoloSummaryEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return 'invalid-argument';
  if (!UUID_PATTERN.test(event.eventId || '') || !UUID_PATTERN.test(event.sessionId || '') || !UUID_PATTERN.test(event.aggregateId || '')) return 'invalid-argument';
  if (event.eventId !== event.sessionId || event.aggregateId !== event.sessionId) return 'invalid-argument';
  if (event.eventType !== 'SOLO_SESSION_COMPLETED' || event.schemaVersion !== 1 || event.aggregateType !== 'SOLO_SESSION') return 'invalid-argument';
  if (!Number.isSafeInteger(event.occurredAtUtcMs) || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return 'invalid-argument';

  const payload = event.payload;
  const integerFields = ['durationSeconds', 'liftCount', 'violationDurationSeconds', 'penaltyScore', 'startedAtUtcMs', 'completedAtUtcMs'];
  if (integerFields.some((field) => !Number.isSafeInteger(payload[field]) || payload[field] < 0)) return 'invalid-argument';
  if (payload.startedAtUtcMs <= 0 || payload.completedAtUtcMs < payload.startedAtUtcMs) return 'invalid-argument';
  if (event.occurredAtUtcMs !== payload.completedAtUtcMs) return 'invalid-argument';
  if (payload.durationSeconds !== Math.floor((payload.completedAtUtcMs - payload.startedAtUtcMs) / 1000)) return 'invalid-argument';
  if (payload.penaltyScore !== payload.liftCount * 10 + payload.violationDurationSeconds) return 'invalid-argument';
  return null;
}

async function processSoloSummary({ db, uid, event, nowUtcMs }) {
  const invalidCode = validateSoloSummaryEvent(event);
  if (invalidCode) return { eventId: event?.eventId, ...fail(invalidCode) };
  const payloadHash = createHash('sha256').update(canonicalEvent(event)).digest('hex');
  const receiptRef = db.doc(`users/${uid}/syncReceipts/${event.eventId}`);
  const summaryRef = db.doc(`users/${uid}/sessions/${event.sessionId}`);

  return db.runTransaction(async (transaction) => {
    const receiptSnapshot = await transaction.get(receiptRef);
    if (receiptSnapshot.exists) {
      const receipt = receiptSnapshot.data();
      if (receipt.payloadHash !== payloadHash) return { eventId: event.eventId, ...fail('already-exists') };
      return { eventId: event.eventId, ...receipt.outcome };
    }

    const summarySnapshot = await transaction.get(summaryRef);
    if (summarySnapshot.exists && summarySnapshot.data().payloadHash !== payloadHash) {
      return { eventId: event.eventId, ...fail('already-exists') };
    }

    const outcome = {
      status: 'SYNCED',
      retryable: false,
      destinationRef: `users/${uid}/sessions/${event.sessionId}`,
    };
    if (!summarySnapshot.exists) {
      transaction.create(summaryRef, {
        durationSeconds: event.payload.durationSeconds,
        liftCount: event.payload.liftCount,
        violationDurationSeconds: event.payload.violationDurationSeconds,
        penaltyScore: event.payload.penaltyScore,
        startedAt: Timestamp.fromMillis(event.payload.startedAtUtcMs),
        completedAt: Timestamp.fromMillis(event.payload.completedAtUtcMs),
        payloadHash,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    transaction.create(receiptRef, {
      eventType: event.eventType,
      payloadHash,
      outcome,
      processedAt: FieldValue.serverTimestamp(),
      serverTimeUtcMs: nowUtcMs,
    });
    return { eventId: event.eventId, ...outcome };
  });
}

function createSyncEventsHandler({ db, now = () => Date.now() }) {
  return async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign-in is required.');
    const data = request.data;
    if (!data || data.version !== 1 || !Array.isArray(data.events) || data.events.length < 1 || data.events.length > MAX_BATCH_SIZE) {
      throw new HttpsError('invalid-argument', 'The sync batch is invalid.');
    }

    const serverTimeUtcMs = now();
    const outcomes = [];
    for (const event of data.events) {
      if (event?.eventType !== 'SOLO_SESSION_COMPLETED') {
        outcomes.push({ eventId: event?.eventId, ...fail('invalid-argument') });
        continue;
      }
      try {
        outcomes.push(await processSoloSummary({ db, uid, event, nowUtcMs: serverTimeUtcMs }));
      } catch {
        outcomes.push({ eventId: event.eventId, status: 'FAILED', retryable: true, errorCode: 'unavailable' });
      }
    }
    return { version: 1, serverTimeUtcMs, outcomes };
  };
}

if (getApps().length === 0) initializeApp();
const db = getFirestore();
const syncEventsHandler = createSyncEventsHandler({ db });
const syncEvents = onCall({ maxInstances: 10 }, syncEventsHandler);

module.exports = { createSyncEventsHandler, syncEvents, validateSoloSummaryEvent };
