'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const { createSyncEventsHandler } = require('../src/sync-events.cjs');

function createMemoryFirestore() {
  const documents = new Map();
  return {
    documents,
    doc(path) { return { path }; },
    async runTransaction(callback) {
      const writes = [];
      const transaction = {
        async get(reference) {
          const value = documents.get(reference.path);
          return { exists: value !== undefined, data: () => value };
        },
        create(reference, value) { writes.push([reference.path, value]); },
      };
      const result = await callback(transaction);
      for (const [path, value] of writes) {
        if (documents.has(path)) throw new Error('ALREADY_EXISTS');
        documents.set(path, value);
      }
      return result;
    },
  };
}

function makeEvent(overrides = {}) {
  const sessionId = overrides.sessionId ?? randomUUID();
  const payload = {
    durationSeconds: 90,
    liftCount: 1,
    violationDurationSeconds: 8,
    penaltyScore: 18,
    startedAtUtcMs: 1_000_000,
    completedAtUtcMs: 1_090_000,
    ...overrides.payload,
  };
  return {
    eventId: sessionId,
    eventType: 'SOLO_SESSION_COMPLETED',
    schemaVersion: 1,
    aggregateType: 'SOLO_SESSION',
    aggregateId: sessionId,
    sessionId,
    occurredAtUtcMs: payload.completedAtUtcMs,
    payload,
    ...overrides,
  };
}

test('syncEvents derives owner from Auth and stores summary plus receipt idempotently', async () => {
  const db = createMemoryFirestore();
  const handler = createSyncEventsHandler({ db, now: () => 1_100_000 });
  const event = makeEvent();
  const request = { auth: { uid: 'owner-a' }, data: { version: 1, events: [event] } };

  const first = await handler(request);
  const replay = await handler(request);
  assert.deepEqual(replay.outcomes, first.outcomes);
  assert.equal(first.outcomes[0].status, 'SYNCED');
  assert.equal(db.documents.size, 2);
  assert.ok(db.documents.has(`users/owner-a/sessions/${event.sessionId}`));
  assert.ok(db.documents.has(`users/owner-a/syncReceipts/${event.eventId}`));
  assert.equal(db.documents.has(`users/another-user/sessions/${event.sessionId}`), false);
});

test('syncEvents rejects reuse of an event ID with a different summary payload', async () => {
  const db = createMemoryFirestore();
  const handler = createSyncEventsHandler({ db, now: () => 1_100_000 });
  const event = makeEvent();
  await handler({ auth: { uid: 'owner-a' }, data: { version: 1, events: [event] } });

  const changed = makeEvent({
    sessionId: event.sessionId,
    payload: { ...event.payload, liftCount: 2, penaltyScore: 28 },
  });
  const response = await handler({ auth: { uid: 'owner-a' }, data: { version: 1, events: [changed] } });
  assert.equal(response.outcomes[0].status, 'FAILED');
  assert.equal(response.outcomes[0].errorCode, 'already-exists');
  assert.equal(db.documents.size, 2);
});

test('syncEvents returns per-event permanent failures and rejects unauthenticated requests', async () => {
  const db = createMemoryFirestore();
  const handler = createSyncEventsHandler({ db, now: () => 1_100_000 });
  await assert.rejects(handler({ data: { version: 1, events: [makeEvent()] } }), { code: 'unauthenticated' });

  const unsupported = makeEvent({ eventType: 'GROUP_SESSION_LOCAL_SUMMARY' });
  const response = await handler({ auth: { uid: 'owner-a' }, data: { version: 1, events: [unsupported] } });
  assert.equal(response.outcomes[0].status, 'FAILED');
  assert.equal(response.outcomes[0].errorCode, 'invalid-argument');
  assert.equal(db.documents.size, 0);
});
