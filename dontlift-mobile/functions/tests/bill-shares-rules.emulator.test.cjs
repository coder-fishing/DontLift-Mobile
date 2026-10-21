'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, Timestamp,
} = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

const roomId = '10000000-0000-4000-8000-000000000024';
const otherRoomId = '20000000-0000-4000-8000-000000000024';
const hostId = 'sl024-host';
const memberId = 'sl024-member';
const outsiderId = 'sl024-outsider';
const requestId = '30000000-0000-4000-8000-000000000024';

async function seedRoom(env, id = roomId, roomHost = hostId, roomMember = memberId) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const endedAt = Timestamp.fromMillis(Date.now() - 60_000);
    await setDoc(doc(db, `rooms/${id}`), {
      hostId: roomHost, pin: '00000024', status: 'COMPLETED', participantCount: 2,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), hostHeartbeatAt: serverTimestamp(),
      startedAt: Timestamp.fromMillis(endedAt.toMillis() - 60_000), endedAt,
      reconciliationStatus: 'FINALIZED',
    });
    for (const [uid, role, status] of [[roomHost, 'HOST', 'ACTIVE'], [roomMember, 'MEMBER', 'ACTIVE']]) {
      await setDoc(doc(db, `rooms/${id}/members/${uid}`), {
        displayName: uid, role, status, penaltyScore: uid === roomMember ? 3 : 0,
        liftCount: 0, violationDurationSeconds: 0, joinedAt: serverTimestamp(), earlyExitAt: null,
        syncedThroughAt: null, syncAcknowledgedAt: null,
      });
    }
    await setDoc(doc(db, `rooms/${id}/settlementDetails/current`), {
      bankId: 'VCB', accountNumber: '0123456789', accountName: 'HOST',
      updatedAt: serverTimestamp(), expiresAt: new Timestamp(endedAt.seconds + 30 * 24 * 60 * 60, endedAt.nanoseconds),
    });
  });
}

async function publish(db, { id = roomId, request = requestId, total = 10_000, shares = [
  { uid: hostId, shareVnd: 4_000 }, { uid: memberId, shareVnd: 6_000 },
] } = {}) {
  const roomRef = doc(db, `rooms/${id}`);
  const hostRef = doc(db, `rooms/${id}/members/${hostId}`);
  const detailRef = doc(db, `rooms/${id}/settlementDetails/current`);
  const receiptRef = doc(db, `rooms/${id}/billCommands/${request}`);
  return runTransaction(db, async tx => {
    const [room, host, details] = await Promise.all([tx.get(roomRef), tx.get(hostRef), tx.get(detailRef)]);
    assert.equal(room.exists(), true);
    assert.equal(host.exists(), true);
    assert.equal(details.exists(), true);
    for (const share of shares) {
      tx.set(doc(db, `rooms/${id}/billShares/${share.uid}`), {
        ...share, requestId: request, updatedAt: serverTimestamp(),
      });
    }
    tx.update(roomRef, {
      totalBillVnd: total, calculationVersion: 1, billRequestId: request,
      billPublishedAt: serverTimestamp(), billShareCount: shares.length,
    });
    tx.set(receiptRef, {
      version: 1, requestId: request, roomId: id, hostUid: hostId, totalBillVnd: total,
      calculationVersion: 1, shareCount: shares.length, shareUids: shares.map(share => share.uid),
      sumShareVnd: total, createdAt: serverTimestamp(),
    });
  });
}

test('Host can atomically publish once; same-room members can read shares and receipt', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const hostDb = env.authenticatedContext(hostId).firestore();
  const memberDb = env.authenticatedContext(memberId).firestore();
  await assertSucceeds(publish(hostDb));
  const shares = await assertSucceeds(getDocs(collection(memberDb, `rooms/${roomId}/billShares`)));
  assert.equal(shares.size, 2);
  assert.equal((await assertSucceeds(getDoc(doc(memberDb, `rooms/${roomId}/billShares/${memberId}`)))).data().shareVnd, 6_000);
  assert.equal((await assertSucceeds(getDoc(doc(memberDb, `rooms/${roomId}/billCommands/${requestId}`)))).data().totalBillVnd, 10_000);
});

test('outsiders and cross-room members cannot read; Members cannot write shares', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  await seedRoom(env, otherRoomId, 'other-room-host', 'other-room-member');
  await assertSucceeds(publish(env.authenticatedContext(hostId).firestore()));
  const memberDb = env.authenticatedContext(memberId).firestore();
  const outsiderDb = env.authenticatedContext(outsiderId).firestore();
  await assertFails(getDoc(doc(outsiderDb, `rooms/${roomId}/billShares/${memberId}`)));
  await assertFails(getDocs(collection(outsiderDb, `rooms/${roomId}/billShares`)));
  await assertFails(getDoc(doc(memberDb, `rooms/${otherRoomId}/billShares/${memberId}`)));
  await assertFails(setDoc(doc(memberDb, `rooms/${roomId}/billShares/${memberId}`), {
    uid: memberId, shareVnd: 0, requestId, updatedAt: serverTimestamp(),
  }));
});

test('room cannot be republished with a new request and no direct partial write is accepted', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const hostDb = env.authenticatedContext(hostId).firestore();
  await assertSucceeds(publish(hostDb));
  await assertFails(publish(hostDb, { request: '40000000-0000-4000-8000-000000000024' }));
  await assertFails(setDoc(doc(hostDb, `rooms/${roomId}/billShares/${outsiderId}`), {
    uid: outsiderId, shareVnd: 10_000, requestId: '50000000-0000-4000-8000-000000000024',
    updatedAt: serverTimestamp(),
  }));
});
