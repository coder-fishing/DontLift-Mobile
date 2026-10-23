const test = require('node:test');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, serverTimestamp, getDoc } = require('firebase/firestore');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

test('Premium profile fields are server-owned and preserve editable profile', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users/premium-owner'), { displayName: 'Owner', email: 'owner@example.invalid', isPremium: true,
      premiumExpiresAt: new Date(Date.now() + 86400000), createdAt: new Date(0), updatedAt: new Date(0) });
  });
  const db = env.authenticatedContext('premium-owner', { email: 'owner@example.invalid' }).firestore();
  await assertSucceeds(updateDoc(doc(db, 'users/premium-owner'), { displayName: 'Updated', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, 'users/premium-owner'), { premiumExpiresAt: new Date(Date.now() + 999999999) }));
  await assertFails(setDoc(doc(db, 'premiumOrders/42'), { uid: 'premium-owner', status: 'PAID' }));
  await assertFails(getDoc(doc(db, 'premiumOrders/42')));
});
