'use strict';
const test = require('node:test');
const { doc, setDoc, getDoc, writeBatch, serverTimestamp, Timestamp } = require('firebase/firestore');
const { assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');
const roomId = '10000000-0000-4000-8000-000000000027';
const publication = '20000000-0000-4000-8000-000000000027';
const requestId = '30000000-0000-4000-8000-000000000027';
const root = `rooms/${roomId}`;
async function seed(env, override = false, amount = 1000) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, root), { hostId: 'host', status: 'COMPLETED', reconciliationStatus: 'FINALIZED',
      calculationVersion: 1, billRequestId: publication, billShareCount: 2, billRevision: override ? 1 : 0,
      ...(override ? { billOverrideRequestId: publication } : {}) });
    for (const uid of ['host', 'member']) await setDoc(doc(db, `${root}/members/${uid}`), { role: uid === 'host' ? 'HOST' : 'MEMBER', status: 'ACTIVE' });
    await setDoc(doc(db, `${root}/settlementDetails/current`), { expiresAt: Timestamp.fromMillis(Date.now() + 3600000) });
    await setDoc(doc(db, override ? `${root}/billOverrides/${publication}/shares/member` : `${root}/billShares/member`),
      { uid: 'member', requestId: publication, shareVnd: amount, updatedAt: serverTimestamp() });
  });
}
function mark(db, { override = false, parts = ['share', 'room', 'receipt'], revision = override ? 1 : 0, amount = 1000, id = requestId } = {}) {
  const batch = writeBatch(db);
  if (parts.includes('share')) batch.update(doc(db, override ? `${root}/billOverrides/${publication}/shares/member` : `${root}/billShares/member`),
    { paymentStatus: 'MARKED_AS_PAID', paidAt: serverTimestamp(), paidBy: 'host', paymentRequestId: id });
  if (parts.includes('room')) batch.update(doc(db, root), { billPaidCount: 1, lastPaymentRequestId: id });
  if (parts.includes('receipt')) batch.set(doc(db, `${root}/billPaymentCommands/${id}`), { version: 1, requestId: id, roomId,
    memberUid: 'member', actorUid: 'host', targetStatus: 'MARKED_AS_PAID', publicationRequestId: publication,
    expectedRevision: revision, shareVnd: amount, paidAt: serverTimestamp() });
  return batch.commit();
}
test('SL027 payment authorization and atomicity', async t => {
  const env = await createRulesEnvironment();
  try {
    for (const override of [false, true]) await t.test(`Host current ${override ? 'override' : 'default'} share`, async () => {
      await env.clearFirestore(); await seed(env, override);
      const db = env.authenticatedContext('host').firestore();
      await assertSucceeds(getDoc(doc(db, `${root}/billPaymentCommands/${requestId}`)));
      await assertSucceeds(mark(db, { override }));
      await assertFails(mark(db, { override, id: '40000000-0000-4000-8000-000000000027' }));
    });
    for (const parts of [['share'], ['room'], ['receipt'], ['share', 'room']]) await t.test(`reject partial ${parts}`, async () => {
      await env.clearFirestore(); await seed(env);
      await assertFails(mark(env.authenticatedContext('host').firestore(), { parts }));
    });
    for (const uid of ['member', 'outsider']) await t.test(`reject actor ${uid}`, async () => {
      await env.clearFirestore(); await seed(env);
      await assertFails(mark(env.authenticatedContext(uid).firestore()));
    });
    await t.test('stale revision and zero amount rejected', async () => {
      await env.clearFirestore(); await seed(env);
      await assertFails(mark(env.authenticatedContext('host').firestore(), { revision: 1 }));
      await env.clearFirestore(); await seed(env, false, 0);
      await assertFails(mark(env.authenticatedContext('host').firestore(), { amount: 0 }));
    });
    await t.test('paid fields and amount cannot be reversed or edited', async () => {
      await env.clearFirestore(); await seed(env);
      const db = env.authenticatedContext('host').firestore();
      await assertSucceeds(mark(db));
      for (const data of [{ paymentStatus: 'UNPAID' }, { shareVnd: 999 }, { paidBy: 'member' }]) {
        const batch = writeBatch(db); batch.update(doc(db, `${root}/billShares/member`), data);
        await assertFails(batch.commit());
      }
    });
    await t.test('expired settlement denies confirmation', async () => {
      await env.clearFirestore(); await seed(env);
      await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), `${root}/settlementDetails/current`), { expiresAt: Timestamp.fromMillis(1) }));
      await assertFails(mark(env.authenticatedContext('host').firestore()));
    });
    await t.test('superseded default share cannot be changed with a valid current override receipt', async () => {
      await env.clearFirestore(); await seed(env, true);
      await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), `${root}/billShares/member`), { uid: 'member', requestId: publication, shareVnd: 1000 }));
      const db = env.authenticatedContext('host').firestore();
      const batch = writeBatch(db);
      const paid = { paymentStatus: 'MARKED_AS_PAID', paidAt: serverTimestamp(), paidBy: 'host', paymentRequestId: requestId };
      batch.update(doc(db, `${root}/billShares/member`), paid);
      batch.update(doc(db, `${root}/billOverrides/${publication}/shares/member`), paid);
      batch.update(doc(db, root), { billPaidCount: 1, lastPaymentRequestId: requestId });
      batch.set(doc(db, `${root}/billPaymentCommands/${requestId}`), { version: 1, requestId, roomId, memberUid: 'member', actorUid: 'host',
        targetStatus: 'MARKED_AS_PAID', publicationRequestId: publication, expectedRevision: 1, shareVnd: 1000, paidAt: serverTimestamp() });
      await assertFails(batch.commit());
    });
  } finally { await env.cleanup(); }
});
