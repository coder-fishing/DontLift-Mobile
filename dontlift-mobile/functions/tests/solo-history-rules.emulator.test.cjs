'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, documentId, limit, startAfter, Timestamp, serverTimestamp } = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

test('Solo history owner reads and creates personal summaries with stable pagination', async t => {
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
  await t.test('owner can create a valid summary only under their own UUID path', async () => {
    const id = '8f46529e-fb4c-4cc0-a647-60b88a580ec9';
    const startedAt = Timestamp.fromMillis(Date.now() - 60_000);
    const completedAt = Timestamp.fromMillis(startedAt.toMillis() + 60_000);
    await assertSucceeds(setDoc(doc(owner, `${path}/${id}`), {
      durationSeconds: 60, liftCount: 1, violationDurationSeconds: 3, penaltyScore: 13,
      startedAt, completedAt, payloadHash: 'a'.repeat(64), createdAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(owner, `${path}/not-a-session-id`), {
      durationSeconds: 60, liftCount: 1, violationDurationSeconds: 3, penaltyScore: 13,
      startedAt, completedAt, payloadHash: 'a'.repeat(64), createdAt: serverTimestamp(),
    }));
  });
  await t.test('anonymous and another user cannot create summaries', async () => {
    const id = 'cb202fa4-bce6-4256-972c-922a17d94d43';
    const summary = {
      durationSeconds: 60, liftCount: 1, violationDurationSeconds: 3, penaltyScore: 13,
      startedAt: Timestamp.fromMillis(Date.now() - 60_000),
      completedAt: Timestamp.fromMillis(Date.now()), payloadHash: 'b'.repeat(64), createdAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), `${path}/${id}`), summary));
    await assertFails(setDoc(doc(env.authenticatedContext('other').firestore(), `${path}/${id}`), summary));
  });
  await t.test('owner cannot create malformed summaries or update/delete a summary', async () => {
    const id = '1bf0b1d2-999d-4cb8-8aae-b1fd05852709';
    const startedAt = Timestamp.fromMillis(Date.now() - 60_000);
    const completedAt = Timestamp.fromMillis(startedAt.toMillis() + 60_000);
    const valid = {
      durationSeconds: 60, liftCount: 1, violationDurationSeconds: 3, penaltyScore: 13,
      startedAt, completedAt, payloadHash: 'c'.repeat(64), createdAt: serverTimestamp(),
    };
    const invalidSummaries = [
      (() => { const { penaltyScore, ...missing } = valid; return missing; })(),
      { ...valid, extra: true },
      { ...valid, durationSeconds: '60' },
      { ...valid, liftCount: -1 },
      { ...valid, liftCount: Number.MAX_SAFE_INTEGER + 1 },
      { ...valid, completedAt: Timestamp.fromMillis(startedAt.toMillis() - 1) },
      { ...valid, durationSeconds: 59 },
      { ...valid, penaltyScore: 12 },
      { ...valid, payloadHash: 'not-a-hash' },
      { ...valid, createdAt: Timestamp.fromMillis(Date.now()) },
    ];
    for (const [index, summary] of invalidSummaries.entries()) {
      await assertFails(setDoc(doc(owner, `${path}/1bf0b1d2-999d-4cb8-8aae-b1fd058527${String(index).padStart(2, '0')}`), summary));
    }
    await assertFails(updateDoc(doc(owner, `${path}/a`), { penaltyScore: 0 }));
    await assertFails(deleteDoc(doc(owner, `${path}/a`)));
  });
});
