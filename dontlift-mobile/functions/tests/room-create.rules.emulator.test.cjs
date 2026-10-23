'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  doc, getDoc, runTransaction, serverTimestamp, setDoc, Timestamp,
} = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

const monthStart = (instantUtcMs) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric',
  }).formatToParts(new Date(instantUtcMs));
  const year = Number(parts.find(part => part.type === 'year').value);
  const month = Number(parts.find(part => part.type === 'month').value);
  return Timestamp.fromMillis(Date.UTC(year, month - 1, 1) - 7 * 60 * 60 * 1000);
};

async function seedProfile(env, uid) {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), `users/${uid}`), {
      displayName: 'Host User', email: `${uid}@example.test`, isPremium: false,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  });
}

async function seedUsage(env, uid, count, bucketStart = monthStart(Date.now())) {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), `users/${uid}/usage/current`), {
      bucketStart, count, updatedAt: Timestamp.now(),
    });
  });
}

async function getServerTime(db, uid) {
  const clockRef = doc(db, `users/${uid}/roomQuotaClock/current`);
  await setDoc(clockRef, { checkedAt: serverTimestamp() });
  const clock = await getDoc(clockRef);
  assert.ok(clock.exists());
  return clock.data().checkedAt.toMillis();
}

for (const active of [true, false]) {
  test(`room quota uses expiring Premium instead of boolean (${active ? 'active' : 'expired'})`, async t => {
    const env = await createRulesEnvironment();
    t.after(() => env.cleanup());
    const uid = 'quota-premium-owner';
    await seedProfile(env, uid);
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), `users/${uid}`), { isPremium: true,
        premiumExpiresAt: new Date(active ? Date.now() + 86400000 : 0) }, { merge: true });
    });
    const db = env.authenticatedContext(uid).firestore();
    const bucketStart = monthStart(await getServerTime(db, uid));
    await seedUsage(env, uid, 7, bucketStart);
    const attempt = createRoom(db, { uid, bucketStart, count: 8, pin: '87654321',
      roomId: '10000000-0000-4000-8000-000000000098', requestId: '00000000-0000-4000-8000-000000000098' });
    await (active ? assertSucceeds(attempt) : assertFails(attempt));
  });
}

async function createRoom(db, { uid, requestId, roomId, pin, bucketStart, count, omitStartMarker = false }) {
  const userRef = doc(db, `users/${uid}`);
  const usageRef = doc(db, `users/${uid}/usage/current`);
  const receiptRef = doc(db, `users/${uid}/commandReceipts/${requestId}`);
  const roomRef = doc(db, `rooms/${roomId}`);
  const memberRef = doc(db, `rooms/${roomId}/members/${uid}`);
  const pinRef = doc(db, `roomPins/${pin}`);

  return runTransaction(db, async transaction => {
    const [profile, usage, receipt] = await Promise.all([
      transaction.get(userRef), transaction.get(usageRef), transaction.get(receiptRef),
    ]);
    if (receipt.exists()) return receipt.data();
    const currentCount = usage.exists() && usage.data().bucketStart.isEqual(bucketStart)
      ? usage.data().count
      : 0;
    const nextCount = count ?? currentCount + 1;
    const timestamp = serverTimestamp();
    const displayName = profile.data()?.displayName ?? 'Host User';

    const room = {
      hostId: uid, pin, status: 'WAITING', participantCount: 1,
      createdAt: timestamp, updatedAt: timestamp, hostHeartbeatAt: timestamp,
      startedAt: null, endedAt: null, lastJoinRequestId: null, lastStartRequestId: null,
    };
    if (omitStartMarker) delete room.lastStartRequestId;
    transaction.set(roomRef, room);
    transaction.set(memberRef, {
      displayName, role: 'HOST', status: 'ACTIVE', penaltyScore: 0,
      liftCount: 0, violationDurationSeconds: 0, joinedAt: timestamp,
      earlyExitAt: null, syncedThroughAt: null, syncAcknowledgedAt: null,
    });
    transaction.set(pinRef, { roomId, hostId: uid, createdAt: timestamp });
    transaction.set(usageRef, { bucketStart, count: nextCount, lastRequestId: requestId, updatedAt: timestamp });
    const result = { version: 1, requestId, roomId, pin, hostId: uid, status: 'WAITING' };
    transaction.set(receiptRef, { ...result, createdAt: timestamp });
    return result;
  });
}

test('Rules authorize one atomic Host room transaction with an eight digit PIN', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const uid = 'room-host';
  await seedProfile(env, uid);
  const db = env.authenticatedContext(uid).firestore();
  const serverTime = await getServerTime(db, uid);
  const bucketStart = monthStart(serverTime);

  const result = await assertSucceeds(createRoom(db, {
    uid, requestId: '00000000-0000-4000-8000-000000000001', roomId: '10000000-0000-4000-8000-000000000001', pin: '00000007', bucketStart,
  }));

  assert.equal(result.status, 'WAITING');
  assert.equal(result.pin, '00000007');
  assert.equal((await getDoc(doc(db, 'rooms/10000000-0000-4000-8000-000000000001'))).data().hostId, uid);
  assert.equal((await getDoc(doc(db, `rooms/10000000-0000-4000-8000-000000000001/members/${uid}`))).data().role, 'HOST');
  assert.equal((await getDoc(doc(db, `users/${uid}/usage/current`))).data().count, 1);
  assert.equal((await getDoc(doc(db, `users/${uid}/commandReceipts/00000000-0000-4000-8000-000000000001`))).data().roomId, '10000000-0000-4000-8000-000000000001');

  await assertSucceeds(createRoom(db, {
    uid, requestId: '00000000-0000-4000-8000-000000000001', roomId: '10000000-0000-4000-8000-000000000001', pin: '00000007', bucketStart,
  }));
  assert.equal((await getDoc(doc(db, `users/${uid}/usage/current`))).data().count, 1);
});

test('Rules keep accepting room creation from the previous app build without the start marker', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const uid = 'legacy-room-host';
  await seedProfile(env, uid);
  const db = env.authenticatedContext(uid).firestore();
  const serverTime = await getServerTime(db, uid);
  const bucketStart = monthStart(serverTime);

  const result = await assertSucceeds(createRoom(db, {
    uid, requestId: '00000000-0000-4000-8000-000000000006', roomId: '10000000-0000-4000-8000-000000000006',
    pin: '00000008', bucketStart, omitStartMarker: true,
  }));

  assert.equal(result.status, 'WAITING');
  await env.withSecurityRulesDisabled(async context => {
    const room = await getDoc(doc(context.firestore(), 'rooms/10000000-0000-4000-8000-000000000006'));
    assert.equal(Object.hasOwn(room.data(), 'lastStartRequestId'), false);
  });
});

test('Rules reject a quota bypass and leave all related documents absent', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const uid = 'room-quota-host';
  await seedProfile(env, uid);
  await seedUsage(env, uid, 7);
  const db = env.authenticatedContext(uid).firestore();
  const bucketStart = monthStart(await getServerTime(db, uid));

  await assertFails(createRoom(db, {
    uid, requestId: '00000000-0000-4000-8000-000000000002', roomId: '10000000-0000-4000-8000-000000000002', pin: '00001007', bucketStart, count: 8,
  }));

  await env.withSecurityRulesDisabled(async context => {
    assert.equal((await getDoc(doc(context.firestore(), 'rooms/10000000-0000-4000-8000-000000000002'))).exists(), false);
    assert.equal((await getDoc(doc(context.firestore(), 'roomPins/00001007'))).exists(), false);
  });
  assert.equal((await getDoc(doc(db, `users/${uid}/usage/current`))).data().count, 7);
});

test('Rules reject unauthenticated room creation', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const db = env.unauthenticatedContext().firestore();

  await assertFails(createRoom(db, {
    uid: 'anonymous', requestId: '00000000-0000-4000-8000-000000000003', roomId: '10000000-0000-4000-8000-000000000003', pin: '00001111',
    bucketStart: monthStart(Date.now()),
  }));
});

test('Rules reject a reserved PIN without partially creating the second room', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const uid = 'room-pin-host';
  await seedProfile(env, uid);
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'roomPins/00002222'), { roomId: 'existing-room', hostId: 'other' });
  });
  const db = env.authenticatedContext(uid).firestore();
  const bucketStart = monthStart(await getServerTime(db, uid));

  await assertFails(createRoom(db, {
    uid, requestId: '00000000-0000-4000-8000-000000000004', roomId: '10000000-0000-4000-8000-000000000004', pin: '00002222', bucketStart,
  }));

  await env.withSecurityRulesDisabled(async context => {
    assert.equal((await getDoc(doc(context.firestore(), 'rooms/10000000-0000-4000-8000-000000000004'))).exists(), false);
  });
  assert.equal((await getDoc(doc(db, `users/${uid}/usage/current`))).exists(), false);
});

test('Rules reject a quota bucket based on a different client clock', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const uid = 'room-clock-host';
  await seedProfile(env, uid);
  const db = env.authenticatedContext(uid).firestore();
  await getServerTime(db, uid);
  const incorrectBucket = Timestamp.fromMillis(Date.UTC(2000, 0, 1));

  await assertFails(createRoom(db, {
    uid, requestId: '00000000-0000-4000-8000-000000000005', roomId: '10000000-0000-4000-8000-000000000005', pin: '00003333', bucketStart: incorrectBucket,
  }));

  await env.withSecurityRulesDisabled(async context => {
    assert.equal((await getDoc(doc(context.firestore(), 'rooms/10000000-0000-4000-8000-000000000005'))).exists(), false);
  });
});
