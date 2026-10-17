'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { initializeApp, deleteApp } = require('firebase/app');
const {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} = require('firebase/auth');
const { connectFirestoreEmulator, doc, getDoc, getFirestore } = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

function parseHostPort(value, name) {
  const [host, portText] = (value || '').split(':');
  if (!host || !Number.isInteger(Number(portText))) throw new Error(`${name} must be host:port.`);
  return { host, port: Number(portText) };
}

test('login reads only the signed-in owner profile and logout clears access', async (t) => {
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  if (!projectId || !projectId.startsWith('demo-')) {
    throw new Error('Login Rules tests require a demo-* project and local emulators.');
  }
  const authAddress = parseHostPort(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'FIREBASE_AUTH_EMULATOR_HOST');
  const firestoreAddress = parseHostPort(process.env.FIRESTORE_EMULATOR_HOST, 'FIRESTORE_EMULATOR_HOST');
  const environment = await createRulesEnvironment();
  const app = initializeApp({ projectId, apiKey: 'demo-api-key' }, `login-profile-${Date.now()}`);
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  connectAuthEmulator(auth, `http://${authAddress.host}:${authAddress.port}`, { disableWarnings: true });
  connectFirestoreEmulator(firestore, firestoreAddress.host, firestoreAddress.port);
  t.after(async () => {
    await deleteApp(app);
    await environment.cleanup();
  });

  const password = 'local-test-password';
  const userA = (await createUserWithEmailAndPassword(auth, `login-a-${Date.now()}@example.invalid`, password)).user;
  await signOut(auth);
  const userB = (await createUserWithEmailAndPassword(auth, `login-b-${Date.now()}@example.invalid`, password)).user;

  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`users/${userA.uid}`).set({
      displayName: 'Account A', email: userA.email, isPremium: false, createdAt: new Date(0),
    });
    await context.firestore().doc(`users/${userB.uid}`).set({
      displayName: 'Account B', email: userB.email, isPremium: false, createdAt: new Date(1),
    });
  });

  await signInWithEmailAndPassword(auth, userA.email, password);
  const ownA = await assertSucceeds(getDoc(doc(firestore, `users/${userA.uid}`)));
  assert.equal(ownA.data().displayName, 'Account A');
  await assertFails(getDoc(doc(firestore, `users/${userB.uid}`)));

  await signOut(auth);
  await assertFails(getDoc(doc(firestore, `users/${userA.uid}`)));
  await signInWithEmailAndPassword(auth, userB.email, password);
  const ownB = await assertSucceeds(getDoc(doc(firestore, `users/${userB.uid}`)));
  assert.equal(ownB.data().displayName, 'Account B');
  await assertFails(getDoc(doc(firestore, `users/${userA.uid}`)));
});
