'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc,
} = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

async function seedRoom(env, { pin = '12345678', roomId = '10000000-0000-4000-8000-000000000011', count = 1, status = 'WAITING', premium = false, hostUid = 'room-host', memberUid = 'room-member' } = {}) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const now = serverTimestamp();
    await setDoc(doc(db, `users/${hostUid}`), {
      displayName: 'Host User', email: `${hostUid}@example.test`, isPremium: premium,
      premiumExpiresAt: premium ? new Date(Date.now() + 86400000) : null,
      createdAt: now, updatedAt: now,
    });
    await setDoc(doc(db, `users/${memberUid}`), {
      displayName: 'Member User', email: `${memberUid}@example.test`, isPremium: false,
      createdAt: now, updatedAt: now,
    });
    await setDoc(doc(db, `rooms/${roomId}`), {
      hostId: hostUid, pin, status, participantCount: count,
      createdAt: now, updatedAt: now, hostHeartbeatAt: now,
      startedAt: null, endedAt: null, lastJoinRequestId: null, lastStartRequestId: null,
    });
    await setDoc(doc(db, `rooms/${roomId}/members/${hostUid}`), {
      displayName: 'Host User', role: 'HOST', status: 'ACTIVE', penaltyScore: 0,
      liftCount: 0, violationDurationSeconds: 0, joinedAt: now,
      earlyExitAt: null, syncedThroughAt: null, syncAcknowledgedAt: null,
    });
    await setDoc(doc(db, `roomPins/${pin}`), { roomId, hostId: hostUid, createdAt: now });
  });
  return roomId;
}

async function join(db, { pin = '12345678', roomId = '10000000-0000-4000-8000-000000000011', requestId = '00000000-0000-4000-8000-000000000021', uid = 'room-member' } = {}) {
  const reservationRef = doc(db, `roomPins/${pin}`);
  const roomRef = doc(db, `rooms/${roomId}`);
  const memberRef = doc(db, `rooms/${roomId}/members/${uid}`);
  const profileRef = doc(db, `users/${uid}`);
  const receiptRef = doc(db, `users/${uid}/commandReceipts/${requestId}`);
  return runTransaction(db, async transaction => {
    const priorReceipt = await transaction.get(receiptRef);
    if (priorReceipt.exists()) return priorReceipt.data();
    const reservation = await transaction.get(reservationRef);
    if (!reservation.exists()) throw new Error('not-found');
    const [roomSnapshot, memberSnapshot, profile] = await Promise.all([
      transaction.get(roomRef), transaction.get(memberRef), transaction.get(profileRef),
    ]);
    if (!roomSnapshot.exists()) throw new Error('not-found');
    const room = roomSnapshot.data();
    if (memberSnapshot.exists()) return { roomId, alreadyMember: true };
    const timestamp = serverTimestamp();
    transaction.set(memberRef, {
      displayName: profile.data().displayName, role: 'MEMBER', status: 'ACTIVE',
      penaltyScore: 0, liftCount: 0, violationDurationSeconds: 0,
      joinedAt: timestamp, earlyExitAt: null, syncedThroughAt: null, syncAcknowledgedAt: null,
    });
    transaction.update(roomRef, {
      participantCount: room.participantCount + 1,
      updatedAt: timestamp,
      lastJoinRequestId: requestId,
    });
    const receipt = { version: 1, requestId, roomId, pin, hostId: room.hostId, status: 'WAITING', createdAt: timestamp };
    transaction.set(receiptRef, receipt);
    return receipt;
  });
}

test('authenticated client can get one exact PIN and atomically join; collection listing is denied', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const roomId = await seedRoom(env, { pin: '12345671', roomId: '10000000-0000-4000-8000-000000000031', hostUid: 'success-host', memberUid: 'success-member' });
  const db = env.authenticatedContext('success-member').firestore();

  assert.equal((await assertSucceeds(getDoc(doc(db, 'roomPins/12345671')))).data().roomId, roomId);
  await assertFails(getDocs(collection(db, 'roomPins')));
  await assertSucceeds(join(db, { pin: '12345671', roomId, uid: 'success-member', requestId: '00000000-0000-4000-8000-000000000031' }));
  assert.equal((await getDoc(doc(db, `rooms/${roomId}`))).data().participantCount, 2);
  assert.equal((await getDoc(doc(db, `rooms/${roomId}/members/success-member`))).data().role, 'MEMBER');
  assert.equal((await getDoc(doc(db, 'users/success-member/commandReceipts/00000000-0000-4000-8000-000000000031'))).data().pin, '12345671');
  await assertFails(runTransaction(db, async transaction => {
    const roomRef = doc(db, `rooms/${roomId}`);
    const room = await transaction.get(roomRef);
    transaction.update(roomRef, {
      participantCount: room.data().participantCount + 1,
      updatedAt: serverTimestamp(),
      lastJoinRequestId: '00000000-0000-4000-8000-000000000031',
    });
  }));
});

test('four digit legacy PIN can still join and duplicate membership does not increment count', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const roomId = await seedRoom(env, { pin: '1234', roomId: '10000000-0000-4000-8000-000000000032', hostUid: 'legacy-host', memberUid: 'legacy-member' });
  const db = env.authenticatedContext('legacy-member').firestore();
  await assertSucceeds(join(db, { pin: '1234', roomId, uid: 'legacy-member', requestId: '00000000-0000-4000-8000-000000000032' }));
  await assertSucceeds(join(db, { pin: '1234', roomId, uid: 'legacy-member', requestId: '00000000-0000-4000-8000-000000000033' }));
  assert.equal((await getDoc(doc(db, `rooms/${roomId}`))).data().participantCount, 2);
});

test('free host room rejects a sixth participant and active room joins', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const fullRoomId = await seedRoom(env, { count: 5, roomId: '10000000-0000-4000-8000-000000000034', hostUid: 'full-host', memberUid: 'full-member' });
  const db = env.authenticatedContext('full-member').firestore();
  await assertFails(join(db, { roomId: fullRoomId, uid: 'full-member', requestId: '00000000-0000-4000-8000-000000000034' }));
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), `rooms/${fullRoomId}`), {
      hostId: 'room-host', pin: '12345678', status: 'ACTIVE', participantCount: 2,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), hostHeartbeatAt: serverTimestamp(),
      startedAt: serverTimestamp(), endedAt: null, lastJoinRequestId: null, lastStartRequestId: null,
    });
  });
  await assertFails(join(db, { roomId: fullRoomId, uid: 'full-member', requestId: '00000000-0000-4000-8000-000000000035' }));
});

test('verified Server Premium host may accept a member above the Free capacity', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const roomId = await seedRoom(env, {
    count: 5, premium: true, roomId: '10000000-0000-4000-8000-000000000038',
    hostUid: 'premium-host', memberUid: 'premium-member',
  });
  const db = env.authenticatedContext('premium-member').firestore();
  await assertSucceeds(join(db, {
    roomId, uid: 'premium-member', requestId: '00000000-0000-4000-8000-000000000038',
  }));
  assert.equal((await getDoc(doc(db, `rooms/${roomId}`))).data().participantCount, 6);
});

test('only one concurrent join can take the final Free room slot', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const roomId = await seedRoom(env, { count: 4, roomId: '10000000-0000-4000-8000-000000000036', hostUid: 'race-host', memberUid: 'race-member' });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/race-second-member'), {
      displayName: 'Second Member', email: 'second@example.test', isPremium: false,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  });
  const firstDb = env.authenticatedContext('race-member').firestore();
  const secondDb = env.authenticatedContext('race-second-member').firestore();
  const outcomes = await Promise.allSettled([
    join(firstDb, { roomId, uid: 'race-member', pin: '12345678', requestId: '00000000-0000-4000-8000-000000000036' }),
    runTransaction(secondDb, async transaction => {
      const roomRef = doc(secondDb, `rooms/${roomId}`);
      const room = await transaction.get(roomRef);
      const memberRef = doc(secondDb, `rooms/${roomId}/members/race-second-member`);
      const profile = await transaction.get(doc(secondDb, 'users/race-second-member'));
      const receiptId = '00000000-0000-4000-8000-000000000037';
      const timestamp = serverTimestamp();
      transaction.set(memberRef, {
        displayName: profile.data().displayName, role: 'MEMBER', status: 'ACTIVE', penaltyScore: 0,
        liftCount: 0, violationDurationSeconds: 0, joinedAt: timestamp,
        earlyExitAt: null, syncedThroughAt: null, syncAcknowledgedAt: null,
      });
      transaction.update(roomRef, { participantCount: room.data().participantCount + 1, updatedAt: timestamp, lastJoinRequestId: receiptId });
      transaction.set(doc(secondDb, `users/race-second-member/commandReceipts/${receiptId}`), {
        version: 1, requestId: receiptId, roomId, pin: '12345678', hostId: 'race-host', status: 'WAITING', createdAt: timestamp,
      });
    }),
  ]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await getDoc(doc(firstDb, `rooms/${roomId}`))).data().participantCount, 5);
});
