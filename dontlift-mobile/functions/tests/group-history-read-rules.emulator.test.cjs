'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { doc, setDoc, getDoc, getDocs, collection, query, orderBy, limit, runTransaction, serverTimestamp, Timestamp, updateDoc, deleteDoc } = require('firebase/firestore');
const { assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');
const roomId = '10000000-0000-4000-8000-000000000028';
const eventId = '20000000-0000-4000-8000-000000000028';
const start = 1800000000123;
const end = start + 10000;
function payload(extra = {}) { return { version: 1, eventId, actorUid: 'member', roomId, status: 'COMPLETED',
  startedAtUtcMs: start, completedAtUtcMs: end, liftCount: 1, violationDurationSeconds: 3, penaltyScore: 13,
  uploadedAt: serverTimestamp(), ...extra }; }
async function seed(env, room = {}, member = {}) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `rooms/${roomId}`), { hostId: 'host', status: 'COMPLETED', startedAt: Timestamp.fromMillis(start), endedAt: Timestamp.fromMillis(end), ...room });
    await setDoc(doc(db, `rooms/${roomId}/members/member`), { role: 'MEMBER', status: 'ACTIVE', ...member });
  });
}
test('SL028 owner history and immutable receipt', async t => {
  const env = await createRulesEnvironment();
  try {
    await t.test('owner creates, reads and replays without room writes', async () => {
      await env.clearFirestore(); await seed(env);
      const db = env.authenticatedContext('member').firestore();
      const ref = doc(db, `users/member/groupHistory/${roomId}`);
      await assertSucceeds(setDoc(ref, payload()));
      await assertSucceeds(runTransaction(db, async tx => { const saved = await tx.get(ref); assert.equal(saved.data().eventId, eventId); }));
      assert.equal((await getDocs(query(collection(db, 'users/member/groupHistory'), orderBy('completedAtUtcMs', 'desc'), limit(20)))).size, 1);
      await assertFails(updateDoc(ref, { penaltyScore: 999 }));
      await assertFails(deleteDoc(ref));
      await assertFails(getDoc(doc(env.authenticatedContext('outsider').firestore(), ref.path)));
      await assertFails(getDocs(collection(env.authenticatedContext('outsider').firestore(), 'users/member/groupHistory')));
    });
    await t.test('outsider, cross-owner and malformed payload/cutoff denied', async () => {
      await env.clearFirestore(); await seed(env);
      const db = env.authenticatedContext('member').firestore();
      await assertFails(setDoc(doc(env.authenticatedContext('outsider').firestore(), `users/outsider/groupHistory/${roomId}`), payload({ actorUid: 'outsider' })));
      await assertFails(setDoc(doc(db, `users/host/groupHistory/${roomId}`), payload({ actorUid: 'host' })));
      for (const extra of [{ completedAtUtcMs: end + 1 }, { startedAtUtcMs: start - 1 }, { penaltyScore: 999 }, { bankAccount: 'secret' }, { eventId: 'bad' }, { liftCount: -1 }]) await assertFails(setDoc(doc(db, `users/member/groupHistory/${roomId}`), payload(extra)));
    });
    await t.test('approved exit keeps its earlier cutoff', async () => {
      await env.clearFirestore(); await seed(env, {}, { status: 'EARLY_EXIT', earlyExitAt: Timestamp.fromMillis(end - 1000) });
      const ref = doc(env.authenticatedContext('member').firestore(), `users/member/groupHistory/${roomId}`);
      await assertFails(setDoc(ref, payload()));
      await assertSucceeds(setDoc(ref, payload({ status: 'EARLY_EXIT', completedAtUtcMs: end - 1000 })));
    });
    await t.test('repairs mixed terminal status and later earlier cutoff without changing identity', async () => {
      await env.clearFirestore(); await seed(env, { status: 'CANCELLED' });
      const db = env.authenticatedContext('member').firestore();
      const ref = doc(db, `users/member/groupHistory/${roomId}`);
      await assertSucceeds(setDoc(ref, payload({ status: 'CANCELLED' })));
      await seed(env, { status: 'CANCELLED' }, { status: 'EARLY_EXIT', earlyExitAt: Timestamp.fromMillis(end) });
      await assertFails(updateDoc(ref, { status: 'EARLY_EXIT', liftCount: 2, penaltyScore: 23, uploadedAt: serverTimestamp() }));
      await assertSucceeds(updateDoc(ref, { status: 'EARLY_EXIT', uploadedAt: serverTimestamp() }));
      await seed(env, { status: 'ABORTED', endedAt: Timestamp.fromMillis(end - 2000) }, { status: 'EARLY_EXIT', earlyExitAt: Timestamp.fromMillis(end) });
      await assertFails(updateDoc(ref, { completedAtUtcMs: end - 2000, eventId: '30000000-0000-4000-8000-000000000028', uploadedAt: serverTimestamp() }));
      await assertSucceeds(updateDoc(ref, { completedAtUtcMs: end - 2000, violationDurationSeconds: 2, penaltyScore: 12, uploadedAt: serverTimestamp() }));
      await assertFails(updateDoc(ref, { completedAtUtcMs: end, uploadedAt: serverTimestamp() }));
      await assertFails(updateDoc(ref, { penaltyScore: 11, violationDurationSeconds: 1, uploadedAt: serverTimestamp() }));
    });
    await t.test('active room cannot be completed by a history write', async () => {
      await env.clearFirestore(); await seed(env, { status: 'ACTIVE', endedAt: null });
      await assertFails(setDoc(doc(env.authenticatedContext('member').firestore(), `users/member/groupHistory/${roomId}`), payload()));
    });
    for (const status of ['CANCELLED', 'ABORTED']) await t.test(`retains ${status}`, async () => {
      await env.clearFirestore(); await seed(env, { status });
      await assertSucceeds(setDoc(doc(env.authenticatedContext('member').firestore(), `users/member/groupHistory/${roomId}`), payload({ status })));
    });
    await t.test('submillisecond timestamps accept millisecond projection', async () => {
      await env.clearFirestore(); await seed(env, { startedAt: new Timestamp(Math.floor(start / 1000), 123001000), endedAt: new Timestamp(Math.floor(end / 1000), 123001000) });
      await assertSucceeds(setDoc(doc(env.authenticatedContext('member').firestore(), `users/member/groupHistory/${roomId}`), payload()));
    });
  } finally { await env.cleanup(); }
});
