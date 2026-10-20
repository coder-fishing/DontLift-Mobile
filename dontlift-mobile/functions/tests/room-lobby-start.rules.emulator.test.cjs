'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, updateDoc } = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

const roomId = '10000000-0000-4000-8000-000000000016';
const hostId = 'sl016-host';
const memberId = 'sl016-member';

async function seedRoom(env) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `rooms/${roomId}`), {
      hostId, pin: '00000016', status: 'WAITING', participantCount: 2,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), hostHeartbeatAt: serverTimestamp(),
      startedAt: null, endedAt: null, lastJoinRequestId: '00000000-0000-4000-8000-000000000017',
      lastStartRequestId: null,
    });
    for (const [uid, role] of [[hostId, 'HOST'], [memberId, 'MEMBER']]) {
      await setDoc(doc(db, `rooms/${roomId}/members/${uid}`), {
        displayName: uid, role, status: 'ACTIVE', penaltyScore: 0, liftCount: 0,
        violationDurationSeconds: 0, joinedAt: serverTimestamp(), earlyExitAt: null,
        syncedThroughAt: null, syncAcknowledgedAt: null,
      });
    }
    await setDoc(doc(db, 'rooms/10000000-0000-4000-8000-000000000099'), { hostId: 'sl016-outsider', pin: '00000099' });
    await setDoc(doc(db, 'rooms/10000000-0000-4000-8000-000000000099/members/sl016-outsider'), {
      displayName: 'Outsider', role: 'HOST', status: 'ACTIVE', joinedAt: serverTimestamp(),
    });
  });
}

async function startTransaction(db, uid, requestId) {
  const roomRef = doc(db, `rooms/${roomId}`);
  const memberRef = doc(db, `rooms/${roomId}/members/${uid}`);
  return runTransaction(db, async transaction => {
    const [room, member] = await Promise.all([transaction.get(roomRef), transaction.get(memberRef)]);
    assert.ok(room.exists());
    assert.ok(member.exists());
    if (room.data().status === 'ACTIVE' && room.data().lastStartRequestId === requestId) return 'replayed';
    transaction.update(roomRef, {
      status: 'ACTIVE', startedAt: serverTimestamp(), updatedAt: serverTimestamp(), lastStartRequestId: requestId,
    });
    return 'started';
  });
}

test('room members can read the room and realtime roster; outsiders cannot', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const memberDb = env.authenticatedContext(memberId).firestore();
  await assertSucceeds(getDoc(doc(memberDb, `rooms/${roomId}`)));
  assert.equal((await assertSucceeds(getDocs(collection(memberDb, `rooms/${roomId}/members`)))).size, 2);
  await assertSucceeds(getDocs(collection(env.authenticatedContext(hostId).firestore(), `rooms/${roomId}/members`)));
  const crossRoomDb = env.authenticatedContext('sl016-outsider').firestore();
  await assertFails(getDoc(doc(crossRoomDb, `rooms/${roomId}`)));
  await assertFails(getDocs(collection(crossRoomDb, `rooms/${roomId}/members`)));
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), `rooms/${roomId}/members`)));
});

test('only the Host can start WAITING once, with a safe same-request replay', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const requestId = '00000000-0000-4000-8000-000000000018';
  const hostDb = env.authenticatedContext(hostId).firestore();
  assert.equal(await assertSucceeds(startTransaction(hostDb, hostId, requestId)), 'started');
  assert.equal(await assertSucceeds(startTransaction(hostDb, hostId, requestId)), 'replayed');
  await assertFails(startTransaction(env.authenticatedContext(memberId).firestore(), memberId,
    '00000000-0000-4000-8000-000000000019'));
  await assertFails(updateDoc(doc(hostDb, `rooms/${roomId}`), { participantCount: 99 }));
  const room = await env.withSecurityRulesDisabled(context => getDoc(doc(context.firestore(), `rooms/${roomId}`)));
  assert.equal(room.data().status, 'ACTIVE');
  assert.equal(room.data().lastStartRequestId, requestId);
});
