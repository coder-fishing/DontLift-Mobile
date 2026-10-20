'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { collection, doc, getDocs, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc } = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

const roomId = '10000000-0000-4000-8000-000000000017';
const hostId = 'sl017-host';
const memberId = 'sl017-member';
const outsiderId = 'sl017-outsider';
const eventId = '00000000-0000-4000-8000-000000000017';

async function seedActiveRoom(env) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `rooms/${roomId}`), {
      hostId, pin: '00000017', status: 'ACTIVE', participantCount: 2,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), hostHeartbeatAt: serverTimestamp(),
      startedAt: Timestamp.fromMillis(Date.now() - 60_000), endedAt: null, lastJoinRequestId: null,
    });
    for (const [uid, role] of [[hostId, 'HOST'], [memberId, 'MEMBER']]) {
      await setDoc(doc(db, `rooms/${roomId}/members/${uid}`), {
        displayName: uid, role, status: 'ACTIVE', penaltyScore: 0, liftCount: 0,
        violationDurationSeconds: 0, joinedAt: serverTimestamp(), earlyExitAt: null,
        syncedThroughAt: null, syncAcknowledgedAt: null,
      });
    }
    await setDoc(doc(db, `rooms/10000000-0000-4000-8000-000000000098`), { hostId: outsiderId, pin: '00000098', status: 'ACTIVE' });
    await setDoc(doc(db, `rooms/10000000-0000-4000-8000-000000000098/members/${outsiderId}`), { status: 'ACTIVE', role: 'HOST' });
  });
}

function confirmedEvent(id = eventId) {
  const endedAt = Timestamp.now();
  const startedAt = Timestamp.fromMillis(endedAt.toMillis() - 4_000);
  return { eventId: id, actorUid: memberId, startedAt, endedAt, durationSeconds: 4, createdAt: serverTimestamp() };
}

async function recordAtomically(db, uid, event = confirmedEvent(), targetUid = uid) {
  const eventRef = doc(db, `rooms/${roomId}/violations/${event.eventId}`);
  const memberRef = doc(db, `rooms/${roomId}/members/${targetUid}`);
  return runTransaction(db, async transaction => {
    const [member, existing] = await Promise.all([transaction.get(memberRef), transaction.get(eventRef)]);
    if (existing.exists()) return 'replayed';
    transaction.set(eventRef, event);
    transaction.update(memberRef, {
      liftCount: member.data().liftCount + 1,
      violationDurationSeconds: member.data().violationDurationSeconds + event.durationSeconds,
      penaltyScore: member.data().penaltyScore + 10 + event.durationSeconds,
      lastViolationEventId: event.eventId,
    });
    return 'created';
  });
}

test('active members read the leaderboard and violation history; outsiders cannot', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedActiveRoom(env);
  const memberDb = env.authenticatedContext(memberId).firestore();
  assert.equal((await assertSucceeds(getDocs(collection(memberDb, `rooms/${roomId}/members`)))).size, 2);
  await assertSucceeds(getDocs(collection(memberDb, `rooms/${roomId}/violations`)));
  const outsiderDb = env.authenticatedContext(outsiderId).firestore();
  await assertFails(getDocs(collection(outsiderDb, `rooms/${roomId}/members`)));
  await assertFails(getDocs(collection(outsiderDb, `rooms/${roomId}/violations`)));
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), `rooms/${roomId}/violations`)));
});

test('confirmed violation and exact own-member score increment must be atomic', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedActiveRoom(env);
  const db = env.authenticatedContext(memberId).firestore();
  assert.equal(await assertSucceeds(recordAtomically(db, memberId)), 'created');
  const score = await env.withSecurityRulesDisabled(context => getDocs(collection(context.firestore(), `rooms/${roomId}/members`)));
  assert.equal(score.docs.find(snapshot => snapshot.id === memberId).data().penaltyScore, 14);
});

test('Rules deny standalone events, arbitrary scores, and cross-member writes', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedActiveRoom(env);
  const db = env.authenticatedContext(memberId).firestore();
  await assertFails(setDoc(doc(db, `rooms/${roomId}/violations/${eventId}`), confirmedEvent()));
  await assertFails(updateDoc(doc(db, `rooms/${roomId}/members/${memberId}`), { penaltyScore: 999 }));
  await assertFails(recordAtomically(db, memberId, confirmedEvent(), hostId));
  await assertFails(getDocs(collection(env.authenticatedContext(outsiderId).firestore(), `rooms/${roomId}/members`)));
});

test('Rules enforce the three-second grace period for every confirmed event', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedActiveRoom(env);
  const db = env.authenticatedContext(memberId).firestore();
  const endedAt = Timestamp.now();
  const event = {
    eventId, actorUid: memberId, startedAt: Timestamp.fromMillis(endedAt.toMillis() - 2_000),
    endedAt, durationSeconds: 2, createdAt: serverTimestamp(),
  };
  await assertFails(recordAtomically(db, memberId, event));
});

test('Rules reject incrementing a score by reusing an existing violation event', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedActiveRoom(env);
  const db = env.authenticatedContext(memberId).firestore();
  const first = confirmedEvent(eventId);
  const second = confirmedEvent('00000000-0000-4000-8000-000000000018');
  await assertSucceeds(recordAtomically(db, memberId, first));
  await assertSucceeds(recordAtomically(db, memberId, second));

  const memberRef = doc(db, `rooms/${roomId}/members/${memberId}`);
  await assertFails(runTransaction(db, async transaction => {
    const member = await transaction.get(memberRef);
    transaction.update(memberRef, {
      liftCount: member.data().liftCount + 1,
      violationDurationSeconds: member.data().violationDurationSeconds + first.durationSeconds,
      penaltyScore: member.data().penaltyScore + 10 + first.durationSeconds,
      lastViolationEventId: first.eventId,
    });
  }));
});
