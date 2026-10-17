'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const { initializeApp, deleteApp } = require('firebase/app');
const { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, updateProfile } = require('firebase/auth');
const { connectFunctionsEmulator, getFunctions, httpsCallable } = require('firebase/functions');
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = require('firebase-admin/app');
const { getFirestore: getAdminFirestore } = require('firebase-admin/firestore');
const { doc, getDoc, getFirestore, connectFirestoreEmulator } = require('firebase/firestore');

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001';

function requireLocalEmulators() {
  if (!projectId || !projectId.startsWith('demo-') || !authHost || !firestoreHost || !functionsHost) {
    throw new Error('Registration integration tests require demo-* Auth, Firestore and Functions emulators.');
  }
}

function parseHostPort(value) {
  const [host, port] = value.split(':');
  if (!host || !Number.isInteger(Number(port))) throw new Error(`Invalid emulator host: ${value}`);
  return { host, port: Number(port) };
}

test('completeRegistrationProfile enforces its contract, identity and idempotency', async (t) => {
  requireLocalEmulators();

  const app = initializeApp({ projectId, apiKey: 'demo-api-key' }, `registration-${randomUUID()}`);
  const clientAuth = getAuth(app);
  const authAddress = parseHostPort(authHost);
  connectAuthEmulator(clientAuth, `http://${authAddress.host}:${authAddress.port}`, { disableWarnings: true });
  const firestoreAddress = parseHostPort(firestoreHost);
  const clientDb = getFirestore(app);
  connectFirestoreEmulator(clientDb, firestoreAddress.host, firestoreAddress.port);
  const functionsAddress = parseHostPort(functionsHost);
  const functions = getFunctions(app, 'asia-southeast1');
  connectFunctionsEmulator(functions, functionsAddress.host, functionsAddress.port);
  const complete = httpsCallable(functions, 'completeRegistrationProfile');

  const adminApp = initializeAdminApp({ projectId }, `registration-admin-${randomUUID()}`);
  const adminDb = getAdminFirestore(adminApp);
  t.after(async () => {
    await deleteApp(app);
    await deleteAdminApp(adminApp);
  });

  const suffix = randomUUID();
  const created = await createUserWithEmailAndPassword(clientAuth, `sl003-${suffix}@example.invalid`, 'local-test-password');
  await updateProfile(created.user, { displayName: 'Auth display name' });

  await t.test('creates a profile from verified Auth identity and trims its name', async () => {
    const requestId = randomUUID();
    const first = (await complete({ version: 1, requestId, displayName: '  Lift Friend  ' })).data;
    const replay = (await complete({ version: 1, requestId, displayName: 'Lift Friend' })).data;

    assert.deepEqual(replay, first);
    assert.equal(first.profile.uid, created.user.uid);
    assert.equal(first.profile.email, created.user.email);
    assert.equal(first.profile.displayName, 'Lift Friend');
    assert.equal(first.profile.isPremium, false);
    const stored = (await getDoc(doc(clientDb, `users/${created.user.uid}`))).data();
    assert.equal(stored.displayName, 'Lift Friend');
    assert.equal(stored.email, created.user.email);
    assert.equal(stored.isPremium, false);
  });

  await t.test('rejects invalid envelopes and names, and rejects request-ID collisions', async () => {
    await assert.rejects(
      complete({ version: 1, requestId: randomUUID(), displayName: '   ' }),
      (error) => error.code === 'functions/invalid-argument',
    );
    await assert.rejects(
      complete({ version: 1, requestId: randomUUID(), displayName: 'Valid', uid: 'forged' }),
      (error) => error.code === 'functions/invalid-argument',
    );
    const requestId = randomUUID();
    await complete({ version: 1, requestId, displayName: 'First' });
    await assert.rejects(
      complete({ version: 1, requestId, displayName: 'Second' }),
      (error) => error.code === 'functions/already-exists',
    );
  });

  await t.test('preserves a pre-existing canonical profile', async () => {
    const existingUser = await createUserWithEmailAndPassword(clientAuth, `existing-${suffix}@example.invalid`, 'local-test-password');
    await adminDb.doc(`users/${existingUser.user.uid}`).set({
      displayName: 'Original Name',
      email: 'canonical@example.invalid',
      isPremium: true,
      createdAt: new Date(1_700_000_000_000),
    });

    const response = (await complete({
      version: 1,
      requestId: randomUUID(),
      displayName: 'Replacement Name',
    })).data;
    const after = (await adminDb.doc(`users/${existingUser.user.uid}`).get()).data();

    assert.equal(after.displayName, 'Original Name');
    assert.equal(after.email, 'canonical@example.invalid');
    assert.equal(after.isPremium, true);
    assert.equal(response.profile.displayName, 'Original Name');
    assert.equal(response.profile.email, 'canonical@example.invalid');
    assert.equal(response.profile.isPremium, true);
  });

  await t.test('requires verified authentication', async () => {
    await clientAuth.signOut();
    await assert.rejects(
      complete({ version: 1, requestId: randomUUID(), displayName: 'No User' }),
      (error) => error.code === 'functions/unauthenticated',
    );
  });
});
