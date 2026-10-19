'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } = require('firebase/firestore');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');
const { assertFails } = require('@firebase/rules-unit-testing');

test('syncEvents stores Solo summaries once and rejects event ID collisions', async (t) => {
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  if (!projectId?.startsWith('demo-')) throw Error('Tests require a demo-* project.');
  const authAddress = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestoreAddress = process.env.FIRESTORE_EMULATOR_HOST;
  const functionsAddress = process.env.FUNCTIONS_EMULATOR_HOST;
  if (!authAddress || !firestoreAddress || !functionsAddress) throw Error('Tests require Auth, Firestore and Functions emulators.');

  const app = initializeApp({ projectId, apiKey: 'demo-api-key' }, 'solo-sync-' + randomUUID());
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const functions = getFunctions(app);
  const [authHost, authPort] = authAddress.split(':');
  const [firestoreHost, firestorePort] = firestoreAddress.split(':');
  const [functionsHost, functionsPort] = functionsAddress.split(':');
  connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(firestore, firestoreHost, Number(firestorePort));
  connectFunctionsEmulator(functions, functionsHost, Number(functionsPort));
  t.after(async () => deleteApp(app));

  const user = (await signInAnonymously(auth)).user;
  const sessionId = randomUUID();
  const event = {
    eventId: sessionId,
    eventType: 'SOLO_SESSION_COMPLETED',
    schemaVersion: 1,
    aggregateType: 'SOLO_SESSION',
    aggregateId: sessionId,
    sessionId,
    occurredAtUtcMs: 1_090_000,
    payload: {
      durationSeconds: 90,
      liftCount: 1,
      violationDurationSeconds: 8,
      penaltyScore: 18,
      startedAtUtcMs: 1_000_000,
      completedAtUtcMs: 1_090_000,
    },
  };
  const syncEvents = httpsCallable(functions, 'syncEvents');
  const request = { version: 1, events: [event] };
  const first = await syncEvents(request);
  assert.equal(first.data.outcomes[0].status, 'SYNCED');
  assert.equal(first.data.outcomes[0].eventId, sessionId);

  const summaryRef = doc(firestore, `users/${user.uid}/sessions/${sessionId}`);
  const summary = await getDoc(summaryRef);
  assert.equal(summary.data().durationSeconds, 90);
  assert.equal(summary.data().startedAt.toMillis(), event.payload.startedAtUtcMs);
  assert.equal(summary.data().completedAt.toMillis(), event.payload.completedAtUtcMs);
  await assertFails(setDoc(doc(firestore, `users/${user.uid}/sessions/${randomUUID()}`), { durationSeconds: 1 }));

  const replay = await syncEvents(request);
  assert.deepEqual(replay.data.outcomes[0], first.data.outcomes[0]);

  const collision = {
    ...event,
    payload: { ...event.payload, liftCount: 2, penaltyScore: 28 },
  };
  const collided = await syncEvents({ version: 1, events: [collision] });
  assert.equal(collided.data.outcomes[0].status, 'FAILED');
  assert.equal(collided.data.outcomes[0].errorCode, 'already-exists');
});

test('syncEvents rejects anonymous calls and isolates permanent failures per event', async (t) => {
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  if (!projectId?.startsWith('demo-')) throw Error('Tests require a demo-* project.');
  const functionsAddress = process.env.FUNCTIONS_EMULATOR_HOST;
  const authAddress = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!functionsAddress || !authAddress) throw Error('Tests require Auth and Functions emulators.');
  const app = initializeApp({ projectId, apiKey: 'demo-api-key' }, 'solo-sync-anon-' + randomUUID());
  const auth = getAuth(app);
  const [authHost, authPort] = authAddress.split(':');
  connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
  const functions = getFunctions(app);
  const [functionsHost, functionsPort] = functionsAddress.split(':');
  connectFunctionsEmulator(functions, functionsHost, Number(functionsPort));
  t.after(async () => deleteApp(app));
  const syncEvents = httpsCallable(functions, 'syncEvents');
  await assert.rejects(syncEvents({ version: 1, events: [{ eventType: 'SOLO_SESSION_COMPLETED' }] }), /unauthenticated/);

  await signInAnonymously(auth);
  const result = await syncEvents({ version: 1, events: [
    { eventId: randomUUID(), eventType: 'GROUP_SESSION_LOCAL_SUMMARY' },
  ] });
  assert.equal(result.data.outcomes[0].status, 'FAILED');
  assert.equal(result.data.outcomes[0].errorCode, 'invalid-argument');
});
