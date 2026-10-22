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

async function seedRoom(env, id = roomId, roomHost = hostId, roomMember = memberId, extraMembers = []) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const endedAt = Timestamp.fromMillis(Date.now() - 60_000);
    const members = [roomHost, roomMember, ...extraMembers];
    await setDoc(doc(db, `rooms/${id}`), {
      hostId: roomHost, pin: '00000024', status: 'COMPLETED', participantCount: members.length,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), hostHeartbeatAt: serverTimestamp(),
      startedAt: Timestamp.fromMillis(endedAt.toMillis() - 60_000), endedAt,
      reconciliationStatus: 'FINALIZED',
    });
    for (const uid of members) {
      await setDoc(doc(db, `rooms/${id}/members/${uid}`), {
        displayName: uid, role: uid === roomHost ? 'HOST' : 'MEMBER', status: 'ACTIVE', penaltyScore: uid === roomMember ? 3 : 0,
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

async function prepare(db, { id = roomId, request = requestId, total = 10_000, shares = [
  { uid: hostId, shareVnd: 4_000 }, { uid: memberId, shareVnd: 6_000 },
] } = {}) {
  const roomRef = doc(db, `rooms/${id}`);
  const hostRef = doc(db, `rooms/${id}/members/${hostId}`);
  const detailRef = doc(db, `rooms/${id}/settlementDetails/current`);
  const preparationRef = doc(db, `rooms/${id}/billPreparations/current`);
  return runTransaction(db, async tx => {
    const [room, host, details, currentPreparation] = await Promise.all([
      tx.get(roomRef), tx.get(hostRef), tx.get(detailRef), tx.get(preparationRef),
    ]);
    assert.equal(room.exists(), true);
    assert.equal(host.exists(), true);
    assert.equal(details.exists(), true);
    void currentPreparation;
    tx.update(roomRef, {
      totalBillVnd: total, billRequestId: request, billShareCount: shares.length,
      billPreparationStartedAt: serverTimestamp(),
    });
    tx.set(preparationRef, {
      version: 1, requestId: request, roomId: id, hostUid: hostId, totalBillVnd: total,
      calculationVersion: 1, shareCount: shares.length, shareUids: shares.map(share => share.uid),
      sumShareVnd: total, status: 'PREPARING', createdAt: serverTimestamp(),
    });
  });
}

async function stage(db, { id = roomId, request = requestId, shares }) {
  const roomRef = doc(db, `rooms/${id}`);
  const preparationRef = doc(db, `rooms/${id}/billPreparations/current`);
  for (let offset = 0; offset < shares.length; offset += 8) {
    const chunk = shares.slice(offset, offset + 8);
    await runTransaction(db, async tx => {
      const [room, preparation, existing] = await Promise.all([
        tx.get(roomRef), tx.get(preparationRef),
        Promise.all(chunk.map(share => tx.get(doc(db, `rooms/${id}/billShares/${share.uid}`)))),
      ]);
      assert.equal(room.exists(), true);
      assert.equal(preparation.data().status, 'PREPARING');
      for (let index = 0; index < chunk.length; index += 1) {
        if (!existing[index].exists()) {
          tx.set(doc(db, `rooms/${id}/billShares/${chunk[index].uid}`), {
            ...chunk[index], requestId: request, updatedAt: serverTimestamp(),
          });
        }
      }
    });
  }
}

async function finalize(db, { id = roomId, request = requestId, total = 10_000, shares = [
  { uid: hostId, shareVnd: 4_000 }, { uid: memberId, shareVnd: 6_000 },
] } = {}) {
  const roomRef = doc(db, `rooms/${id}`);
  const preparationRef = doc(db, `rooms/${id}/billPreparations/current`);
  const receiptRef = doc(db, `rooms/${id}/billCommands/${request}`);
  return runTransaction(db, async tx => {
    const [room, preparation, receipt] = await Promise.all([
      tx.get(roomRef), tx.get(preparationRef), tx.get(receiptRef),
    ]);
    assert.equal(room.exists(), true);
    assert.equal(preparation.data().status, 'PREPARING');
    assert.equal(receipt.exists(), false);
    tx.update(roomRef, { calculationVersion: 1, billPublishedAt: serverTimestamp() });
    tx.update(preparationRef, { status: 'PUBLISHED', publishedAt: serverTimestamp() });
    tx.set(receiptRef, {
      version: 1, requestId: request, roomId: id, hostUid: hostId, totalBillVnd: total,
      calculationVersion: 1, shareCount: shares.length, shareUids: shares.map(share => share.uid),
      sumShareVnd: total, createdAt: serverTimestamp(),
    });
  });
}

async function publish(db, options = {}) {
  const shares = options.shares ?? [
    { uid: hostId, shareVnd: 4_000 }, { uid: memberId, shareVnd: 6_000 },
  ];
  await prepare(db, { ...options, shares });
  await stage(db, { ...options, shares });
  await finalize(db, { ...options, shares });
}

test('Host publishes once at an atomic visibility boundary; same-room members can read shares and receipt', async t => {
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

test('25-member bill is staged within Rules limits and stays hidden until publication', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  const extraMembers = Array.from({ length: 23 }, (_, index) => `sl024-large-${index}`);
  const shares = [hostId, memberId, ...extraMembers].map(uid => ({ uid, shareVnd: uid === hostId ? 10_000 - 24 * 400 : 400 }));
  await seedRoom(env, roomId, hostId, memberId, extraMembers);
  const hostDb = env.authenticatedContext(hostId).firestore();
  const memberDb = env.authenticatedContext(memberId).firestore();

  await assertSucceeds(prepare(hostDb, { shares }));
  await assertSucceeds(stage(hostDb, { shares: shares.slice(0, 8) }));
  await assertSucceeds(getDoc(doc(hostDb, `rooms/${roomId}/billShares/${shares[0].uid}`)));
  await assertFails(getDoc(doc(memberDb, `rooms/${roomId}/billShares/${shares[0].uid}`)));
  await assertFails(getDocs(collection(memberDb, `rooms/${roomId}/billShares`)));
  await assertFails(getDoc(doc(memberDb, `rooms/${roomId}/billPreparations/current`)));

  await assertSucceeds(stage(hostDb, { shares: shares.slice(8) }));
  await assertSucceeds(finalize(hostDb, { shares }));
  const published = await assertSucceeds(getDocs(collection(memberDb, `rooms/${roomId}/billShares`)));
  assert.equal(published.size, 25);
});

test('Rules still reject staging a share for a UID without room membership', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const hostDb = env.authenticatedContext(hostId).firestore();
  const shares = [
    { uid: hostId, shareVnd: 3_000 },
    { uid: memberId, shareVnd: 3_000 },
    { uid: outsiderId, shareVnd: 4_000 },
  ];
  await assertSucceeds(prepare(hostDb, { shares }));
  await assertFails(stage(hostDb, { shares: [shares[2]] }));
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
