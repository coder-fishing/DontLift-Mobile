'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { doc, getDoc, getDocs, collection, runTransaction, serverTimestamp, setDoc, Timestamp, deleteDoc } = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

const roomId = '10000000-0000-4000-8000-000000000023';
const hostId = 'sl023-host';
const memberId = 'sl023-member';
const outsiderId = 'sl023-outsider';
const otherMemberId = 'sl023-other-member';
const otherRoomId = '20000000-0000-4000-8000-000000000023';

async function seedRoom(env, { finalized = true, ageDays = 2 } = {}) {
  const endedAt = Timestamp.fromMillis(Date.now() - ageDays * 24 * 60 * 60 * 1000);
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `rooms/${roomId}`), {
      hostId, pin: '00000023', status: 'COMPLETED', participantCount: 2,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), hostHeartbeatAt: serverTimestamp(),
      startedAt: Timestamp.fromMillis(endedAt.toMillis() - 60_000), endedAt,
      reconciliationStatus: finalized ? 'FINALIZED' : 'PENDING',
    });
    for (const [uid, role] of [[hostId, 'HOST'], [memberId, 'MEMBER']]) {
      await setDoc(doc(db, `rooms/${roomId}/members/${uid}`), {
        displayName: uid, role, status: 'ACTIVE', penaltyScore: 0, liftCount: 0,
        violationDurationSeconds: 0, joinedAt: serverTimestamp(), earlyExitAt: null,
        syncedThroughAt: null, syncAcknowledgedAt: null,
      });
    }
  });
}

async function saveAsHost(db, { uid = hostId, bankId = 'VCB', accountNumber = '0123456789', accountName = 'NGUYEN VAN A', extra } = {}) {
  const roomRef = doc(db, `rooms/${roomId}`);
  const memberRef = doc(db, `rooms/${roomId}/members/${uid}`);
  const detailsRef = doc(db, `rooms/${roomId}/settlementDetails/current`);
  return runTransaction(db, async tx => {
    const [room, member] = await Promise.all([tx.get(roomRef), tx.get(memberRef)]);
    const end = room.data().endedAt;
    const payload = {
      bankId, accountNumber, accountName,
      updatedAt: serverTimestamp(),
      expiresAt: new Timestamp(end.seconds + 30 * 24 * 60 * 60, end.nanoseconds),
      ...extra,
    };
    tx.set(detailsRef, payload);
  });
}

test('active room members read settlement details; outsiders, anonymous, and list are denied', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  await assertSucceeds(saveAsHost(env.authenticatedContext(hostId).firestore()));
  const path = `rooms/${roomId}/settlementDetails/current`;
  assert.equal((await assertSucceeds(getDoc(doc(env.authenticatedContext(memberId).firestore(), path)))).data().accountName, 'NGUYEN VAN A');
  const hostDb = env.authenticatedContext(hostId).firestore();
  assert.equal((await assertSucceeds(getDoc(doc(hostDb, `rooms/${roomId}`)))).data().hostId, hostId);
  assert.equal((await assertSucceeds(getDoc(doc(hostDb, `rooms/${roomId}/members/${hostId}`)))).data().role, 'HOST');
  await assertFails(getDoc(doc(env.authenticatedContext(outsiderId).firestore(), `rooms/${roomId}`)));
  await assertFails(getDoc(doc(env.authenticatedContext(outsiderId).firestore(), `rooms/${roomId}/members/${hostId}`)));
  await assertFails(getDoc(doc(env.authenticatedContext(outsiderId).firestore(), path)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), path)));
  await assertFails(getDocs(collection(env.authenticatedContext(memberId).firestore(), `rooms/${roomId}/settlementDetails`)));
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `rooms/${otherRoomId}`), { hostId: outsiderId, status: 'COMPLETED' });
    await setDoc(doc(db, `rooms/${otherRoomId}/members/${otherMemberId}`), { role: 'MEMBER', status: 'ACTIVE' });
    await setDoc(doc(db, `rooms/${otherRoomId}/settlementDetails/current`), {
      bankId: 'ACB', accountNumber: '9988', accountName: 'OTHER ROOM',
      updatedAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    });
  });
  await assertFails(getDoc(doc(env.authenticatedContext(memberId).firestore(), `rooms/${otherRoomId}/settlementDetails/current`)));
});

test('room member can read an absent current document to show the empty state', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const snap = await assertSucceeds(getDoc(doc(env.authenticatedContext(memberId).firestore(), `rooms/${roomId}/settlementDetails/current`)));
  assert.equal(snap.exists(), false);
});

test('only active Host can create or update finalized-room details with bounded exact fields', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const hostDb = env.authenticatedContext(hostId).firestore();
  await assertSucceeds(saveAsHost(hostDb));
  const room = await assertSucceeds(getDoc(doc(hostDb, `rooms/${roomId}`)));
  const details = await assertSucceeds(getDoc(doc(hostDb, `rooms/${roomId}/settlementDetails/current`)));
  assert.equal(details.data().expiresAt.seconds, room.data().endedAt.seconds + 30 * 24 * 60 * 60);
  assert.equal(details.data().expiresAt.nanoseconds, room.data().endedAt.nanoseconds);
  await assertSucceeds(saveAsHost(hostDb, { accountName: 'NGUYEN VAN B' }));
  await assertFails(saveAsHost(env.authenticatedContext(memberId).firestore(), { uid: memberId }));
  await assertFails(saveAsHost(hostDb, { bankId: 'B'.repeat(33) }));
  await assertFails(saveAsHost(hostDb, { accountNumber: '1'.repeat(65) }));
  await assertFails(saveAsHost(hostDb, { accountName: 'A'.repeat(101) }));
  await assertFails(saveAsHost(hostDb, { bankId: '   ' }));
  await assertFails(saveAsHost(hostDb, { extra: { expiresAt: Timestamp.now() } }));
  await assertFails(saveAsHost(hostDb, { extra: { unrelated: true } }));
  await assertFails(deleteDoc(doc(hostDb, `rooms/${roomId}/settlementDetails/current`)));
});

test('writes require COMPLETED and FINALIZED; reads stop at the server-enforced expiry', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env, { finalized: false });
  const hostDb = env.authenticatedContext(hostId).firestore();
  await assertFails(saveAsHost(hostDb));

  const expiredEnv = await createRulesEnvironment();
  t.after(() => expiredEnv.cleanup());
  await seedRoom(expiredEnv, { ageDays: 40 });
  const expiredHostDb = expiredEnv.authenticatedContext(hostId).firestore();
  await expiredEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const room = await getDoc(doc(db, `rooms/${roomId}`));
    const end = room.data().endedAt;
    await setDoc(doc(db, `rooms/${roomId}/settlementDetails/current`), {
      bankId: 'VCB', accountNumber: '0123456789', accountName: 'NGUYEN VAN A',
      updatedAt: serverTimestamp(), expiresAt: new Timestamp(end.seconds + 30 * 24 * 60 * 60, end.nanoseconds),
    });
  });
  await assertFails(saveAsHost(expiredHostDb));
  await assertFails(getDoc(doc(expiredEnv.authenticatedContext(memberId).firestore(), `rooms/${roomId}/settlementDetails/current`)));
});
