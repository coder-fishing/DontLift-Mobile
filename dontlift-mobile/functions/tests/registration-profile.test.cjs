'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const { loadAppTypeScript, requireFromApp } = require('./helpers/load-app-typescript.cjs');
const { initializeApp, deleteApp } = requireFromApp('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } = requireFromApp('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, getDocFromServer } = requireFromApp('firebase/firestore');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');
const { completeRegistrationProfile } = loadAppTypeScript('src/features/auth/firebase-profile.ts');

test('actual JS SDK profile bootstrap is owner-only, create-only and retryable without Functions', async (t) => {
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  if (!projectId?.startsWith('demo-')) throw Error('Tests require a demo-* project.');
  const authAddress = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestoreAddress = process.env.FIRESTORE_EMULATOR_HOST;
  if (!authAddress || !firestoreAddress) throw Error('Tests require local Auth and Firestore emulators.');
  const environment = await createRulesEnvironment();
  const app = initializeApp({ projectId, apiKey: 'demo-api-key' }, 'profile-test');
  const auth = getAuth(app);
  const database = getFirestore(app);
  connectAuthEmulator(auth, 'http://' + authAddress, { disableWarnings: true });
  const [host, port] = firestoreAddress.split(':'); connectFirestoreEmulator(database, host, Number(port));
  t.after(async () => { await deleteApp(app); await environment.cleanup(); });
  const request = { version: 1, requestId: randomUUID(), displayName: '  Nguyen An  ' };
  await assert.rejects(completeRegistrationProfile(auth, database, request), /signed-in/);
  const user = (await createUserWithEmailAndPassword(auth, 'profile-' + Date.now() + '@example.invalid', 'local-test-password')).user;
  const [first, concurrent] = await Promise.all([
    completeRegistrationProfile(auth, database, request), completeRegistrationProfile(auth, database, request),
  ]);
  assert.equal(first.profile.uid, user.uid); assert.equal(first.profile.email, user.email);
  assert.equal(first.profile.displayName, 'Nguyen An'); assert.equal(first.profile.isPremium, false);
  assert.equal(first.profile.createdAtUtcMs, concurrent.profile.createdAtUtcMs);
  assert.ok(first.profile.createdAtUtcMs > 0);
  const snapshot = await getDocFromServer(doc(database, 'users', user.uid));
  assert.equal(snapshot.data().createdAt.toMillis(), first.profile.createdAtUtcMs);
  assert.equal(snapshot.data().updatedAt.toMillis(), first.profile.createdAtUtcMs);
  const retried = await completeRegistrationProfile(auth, database, { ...request, requestId: randomUUID(), displayName: 'Changed' });
  assert.deepEqual(retried.profile, first.profile);
  await environment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('users/' + user.uid).update({ isPremium: true });
  });
  const existingPremium = await completeRegistrationProfile(auth, database, request);
  assert.equal(existingPremium.profile.isPremium, true);
  assert.equal(existingPremium.profile.createdAtUtcMs, first.profile.createdAtUtcMs);
  await assert.rejects(completeRegistrationProfile(auth, database, { ...request, displayName: ' '.repeat(3) }), /name/);
  await signOut(auth);
  await assert.rejects(completeRegistrationProfile(auth, database, request), /signed-in/);
});
