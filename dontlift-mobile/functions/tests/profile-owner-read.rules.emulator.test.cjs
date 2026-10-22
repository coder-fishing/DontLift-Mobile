'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { doc, getDoc, setDoc, updateDoc, serverTimestamp, deleteDoc, getDocs, collection } = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

const uid = 'profile-owner';
const userPath = `users/${uid}`;

test('profile Rules enforce owner-only reads and server-owned writes', async (t) => {
  const environment = await createRulesEnvironment();
  t.after(async () => environment.cleanup());

  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), userPath), {
      displayName: 'Owner',
      email: 'owner@example.invalid',
      isPremium: false,
      createdAt: new Date(0),
    });
    await setDoc(doc(context.firestore(), `${userPath}/commandReceipts/receipt-1`), {
      payloadHash: 'server-only',
    });
  });

  await t.test('authenticated owner can read own profile', async () => {
    const owner = environment.authenticatedContext(uid).firestore();
    const snapshot = await assertSucceeds(getDoc(doc(owner, userPath)));
    assert.equal(snapshot.data().displayName, 'Owner');
  });

  await t.test('anonymous and cross-user profile reads are denied', async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    const otherUser = environment.authenticatedContext('another-user').firestore();
    await assertFails(getDoc(doc(anonymous, userPath)));
    await assertFails(getDoc(doc(otherUser, userPath)));
  });

  await t.test('clients cannot create or mutate server-owned profile fields', async () => {
    const owner = environment.authenticatedContext(uid).firestore();
    await assertFails(updateDoc(doc(owner, userPath), { isPremium: true }));
    await assertFails(setDoc(doc(owner, 'users/attacker'), { isPremium: true }));
  });

  await t.test('owners can read command receipts but cannot forge them', async () => {
    const owner = environment.authenticatedContext(uid).firestore();
    const receipt = doc(owner, `${userPath}/commandReceipts/receipt-1`);
    await assertSucceeds(getDoc(receipt));
    await assertFails(setDoc(receipt, { payloadHash: 'client' }));
  });
});


test('profile creation enforces owner identity, defaults, bounds, field whitelist and server time', async (t) => {
  const environment = await createRulesEnvironment();
  t.after(() => environment.cleanup());
  const email = 'owner@example.invalid';
  const uid = 'create-owner';
  const owner = environment.authenticatedContext(uid, { email }).firestore();
  const valid = () => ({ displayName: 'Owner', email, isPremium: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  const reference = doc(owner, 'users/' + uid);
  for (const bad of [
    { ...valid(), isPremium: true }, { ...valid(), isPremium: 'false' },
    { ...valid(), email: 'forged@example.invalid' }, { ...valid(), role: 'admin' },
    { ...valid(), displayName: '' }, { ...valid(), displayName: '   ' },
    { ...valid(), displayName: 'a'.repeat(41) }, { ...valid(), displayName: 7 },
    { ...valid(), createdAt: new Date(0) }, { ...valid(), updatedAt: new Date(0) },
    { displayName: 'Only a name' },
  ]) await assertFails(setDoc(reference, bad));
  await assertFails(setDoc(doc(owner, 'users/someone-else'), valid()));
  await assertFails(setDoc(doc(environment.unauthenticatedContext().firestore(), 'users/anonymous'), valid()));
  await assertSucceeds(setDoc(reference, valid()));
  await assertSucceeds(updateDoc(reference, { displayName: 'Updated Owner', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(reference, { displayName: '😀'.repeat(40), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(reference, { displayName: '😀'.repeat(41), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(reference, { email: 'changed@example.invalid', displayName: 'Changed', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(reference, { isPremium: true, displayName: 'Changed', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(reference, { displayName: 'a'.repeat(41), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(environment.authenticatedContext('other-user').firestore(), 'users/' + uid), {
    displayName: 'Cross user', updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(reference, { isPremium: true }));
  await assertFails(updateDoc(reference, { email: 'changed@example.invalid' }));
  await assertFails(updateDoc(reference, { displayName: 'Changed' }));
  await assertFails(deleteDoc(reference));
  await assertFails(getDocs(collection(owner, 'users')));
  await assertFails(setDoc(doc(owner, 'rooms/client-room'), { hostId: uid }));
});
