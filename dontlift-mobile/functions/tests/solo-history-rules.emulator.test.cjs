'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, documentId, limit, startAfter, Timestamp } = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

test('Solo history owner reads, stable pagination and server-only writes', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const uid = 'history-owner';
  const path = `users/${uid}/sessions`;
  const completedAt = Timestamp.fromMillis(Date.now());
  await env.withSecurityRulesDisabled(async context => {
    for (const id of ['a', 'b', 'c']) await setDoc(doc(context.firestore(), `${path}/${id}`), {
      durationSeconds: 60, liftCount: 1, violationDurationSeconds: 3, penaltyScore: 13,
      startedAt: Timestamp.fromMillis(completedAt.toMillis() - 60_000), completedAt,
    });
  });
  const owner = env.authenticatedContext(uid).firestore();
  await t.test('owner can read detail and paginate tied completion timestamps', async () => {
    await assertSucceeds(getDoc(doc(owner, `${path}/a`)));
    const source = collection(owner, path);
    const first = await assertSucceeds(getDocs(query(source, orderBy('completedAt', 'desc'), orderBy(documentId(), 'desc'), limit(2))));
    const second = await assertSucceeds(getDocs(query(source, orderBy('completedAt', 'desc'), orderBy(documentId(), 'desc'), startAfter(completedAt, first.docs.at(-1).id), limit(2))));
    assert.deepEqual([...first.docs, ...second.docs].map(item => item.id), ['c', 'b', 'a']);
  });
  await t.test('anonymous and another user cannot read list or detail', async () => {
    for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('other').firestore()]) {
      await assertFails(getDoc(doc(db, `${path}/a`)));
      await assertFails(getDocs(collection(db, path)));
    }
  });
  await t.test('even the owner cannot create, update, or delete summaries', async () => {
    await assertFails(setDoc(doc(owner, `${path}/new`), { durationSeconds: 1 }));
    await assertFails(updateDoc(doc(owner, `${path}/a`), { penaltyScore: 0 }));
    await assertFails(deleteDoc(doc(owner, `${path}/a`)));
  });
});
