'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { doc, setDoc, getDoc, writeBatch, serverTimestamp } = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');
const roomId = '10000000-0000-4000-8000-000000000026';
const roomPath = `rooms/${roomId}`;

async function seed(env, count = 2, status = 'WAITING') {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, roomPath), { hostId: 'host', pin: '00000026', participantCount: count,
      status, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), startedAt: null, endedAt: null });
    await setDoc(doc(db, 'roomPins/00000026'), { roomId, hostId: 'host', createdAt: serverTimestamp() });
    for (const uid of count === 1 ? ['host'] : count === 3 ? ['host', 'member', 'other'] : ['host', 'member']) {
      await setDoc(doc(db, `${roomPath}/members/${uid}`), { displayName: uid,
        role: uid === 'host' ? 'HOST' : 'MEMBER', status: 'ACTIVE', joinedAt: serverTimestamp(),
        penaltyScore: 0, liftCount: 0, violationDurationSeconds: 0 });
    }
  });
}

function leave(db, uid, { transfer = false, close = false, count = 1, remove = true, extra = {} } = {}) {
  const batch = writeBatch(db);
  batch.update(doc(db, roomPath), { participantCount: count, lastLeaveUid: uid,
    updatedAt: serverTimestamp(), ...(transfer ? { hostId: 'member' } : {}),
    ...(close ? { status: 'CANCELLED', endedAt: serverTimestamp() } : {}), ...extra });
  if (remove) batch.delete(doc(db, `${roomPath}/members/${uid}`));
  if (transfer) batch.update(doc(db, `${roomPath}/members/member`), { role: 'HOST' });
  return batch.commit();
}

test('WAITING departure permissions and atomic Host transfer', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const hostDb = env.authenticatedContext('host').firestore();
  const memberDb = env.authenticatedContext('member').firestore();
  await t.test('Member leaves and count decreases; Host remains', async () => {
    await seed(env);
    await assertSucceeds(leave(memberDb, 'member'));
    assert.equal((await getDoc(doc(hostDb, roomPath))).data().participantCount, 1);
    assert.equal((await getDoc(doc(memberDb, `${roomPath}/members/member`))).exists(), false);
  });
  await t.test('Host transfers atomically and new Host can read the room', async () => {
    await seed(env);
    await assertSucceeds(leave(hostDb, 'host', { transfer: true }));
    assert.equal((await getDoc(doc(memberDb, roomPath))).data().hostId, 'member');
    assert.equal((await getDoc(doc(memberDb, `${roomPath}/members/member`))).data().role, 'HOST');
    assert.equal((await getDoc(doc(hostDb, `${roomPath}/members/host`))).exists(), false);
    const start = writeBatch(memberDb);
    start.update(doc(memberDb, roomPath), { status: 'ACTIVE', startedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      lastStartRequestId: '00000000-0000-4000-8000-000000000026', activeMemberCount: 1, hostHeartbeatAt: serverTimestamp() });
    await assertSucceeds(start.commit());
  });
  await t.test('Last Host closes the lobby', async () => {
    await seed(env, 1);
    await assertSucceeds(leave(hostDb, 'host', { close: true, count: 0 }));
    assert.equal((await getDoc(doc(hostDb, roomPath))).data().status, 'CANCELLED');
  });
  await t.test('Reject orphaned Host, count-only mutation, bad count and extra fields', async () => {
    await seed(env);
    await assertFails(leave(hostDb, 'host'));
    await assertFails(leave(memberDb, 'member', { remove: false }));
    await assertFails(leave(memberDb, 'member', { count: 0 }));
    await assertFails(leave(memberDb, 'member', { extra: { pin: '12345678' } }));
  });
  await t.test('Reject non-Host promotion, outsiders and deleting another user', async () => {
    await seed(env);
    await assertFails(leave(memberDb, 'member', { extra: { hostId: 'member' } }));
    await assertFails(leave(env.authenticatedContext('outsider').firestore(), 'outsider'));
    await assertFails(leave(memberDb, 'host', { transfer: true }));
  });
  await t.test('Reject active-session departure and direct self-promotion', async () => {
    await seed(env, 2, 'ACTIVE');
    await assertFails(leave(memberDb, 'member'));
    const batch = writeBatch(memberDb);
    batch.update(doc(memberDb, `${roomPath}/members/member`), { role: 'HOST' });
    await assertFails(batch.commit());
  });
  const kick = (db, uid = 'member', extra = {}) => {
    const batch = writeBatch(db);
    batch.update(doc(db, roomPath), { participantCount: 2, lastKickUid: uid, updatedAt: serverTimestamp(), ...extra });
    batch.delete(doc(db, `${roomPath}/members/${uid}`));
    return batch.commit();
  };
  await t.test('Host removes a Member, preserving Host and the remaining roster', async () => {
    await seed(env, 3);
    await assertSucceeds(kick(hostDb));
    assert.equal((await getDoc(doc(hostDb, roomPath))).data().participantCount, 2);
    assert.equal((await getDoc(doc(memberDb, `${roomPath}/members/member`))).exists(), false);
    assert.equal((await getDoc(doc(hostDb, `${roomPath}/members/host`))).data().role, 'HOST');
    assert.equal((await getDoc(doc(hostDb, `${roomPath}/members/other`))).exists(), true);
  });
  await t.test('Reject kicks from Members, outsiders, active sessions or altered fields', async () => {
    await seed(env, 3);
    await assertFails(kick(memberDb, 'other'));
    await assertFails(kick(env.authenticatedContext('outsider').firestore()));
    await assertFails(kick(hostDb, 'host'));
    await assertFails(kick(hostDb, 'member', { participantCount: 0 }));
    await assertFails(kick(hostDb, 'member', { hostId: 'other' }));
    await seed(env, 3, 'ACTIVE');
    await assertFails(kick(hostDb));
  });
});
