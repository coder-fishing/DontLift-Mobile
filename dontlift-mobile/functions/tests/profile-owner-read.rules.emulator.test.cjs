'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');
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

  await t.test('clients cannot read or write command receipts', async () => {
    const owner = environment.authenticatedContext(uid).firestore();
    const receipt = doc(owner, `${userPath}/commandReceipts/receipt-1`);
    await assertFails(getDoc(receipt));
    await assertFails(setDoc(receipt, { payloadHash: 'client' }));
  });
});
