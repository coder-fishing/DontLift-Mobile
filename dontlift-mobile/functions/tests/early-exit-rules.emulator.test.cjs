'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where } = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

const roomId = '10000000-0000-4000-8000-000000000018';
const hostId = 'sl018-host';
const memberId = 'sl018-member';
const outsiderId = 'sl018-outsider';
const requestId = '00000000-0000-4000-8000-000000000081';

async function seedRoom(env) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `rooms/${roomId}`), {
      hostId, pin: '00000018', status: 'ACTIVE', participantCount: 2,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), hostHeartbeatAt: serverTimestamp(),
      startedAt: Timestamp.fromMillis(Date.now() - 60_000), endedAt: null,
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

async function requestExit(db, uid, id = requestId) {
  const roomRef = doc(db, `rooms/${roomId}`);
  const memberRef = doc(db, `rooms/${roomId}/members/${uid}`);
  const requestRef = doc(db, `rooms/${roomId}/earlyExitRequests/${uid}`);
  return runTransaction(db, async transaction => {
    const [room, member, request] = await Promise.all([
      transaction.get(roomRef), transaction.get(memberRef), transaction.get(requestRef),
    ]);
    if (!room.exists() || !member.exists()) throw new Error('missing room or member');
    if (request.exists() && request.data().requestId === id) return request.data().status;
    if (request.exists() && request.data().status === 'OPEN') throw new Error('open request already exists');
    transaction.set(requestRef, {
      version: 1, requestId: id, memberUid: uid, status: 'OPEN', requestedAt: serverTimestamp(),
      decision: null, decidedBy: null, decidedAt: null, cutoffAt: null,
    });
    return 'OPEN';
  });
}

async function decideExit(db, uid, memberUid, id, decision) {
  const roomRef = doc(db, `rooms/${roomId}`);
  const hostRef = doc(db, `rooms/${roomId}/members/${uid}`);
  const memberRef = doc(db, `rooms/${roomId}/members/${memberUid}`);
  const requestRef = doc(db, `rooms/${roomId}/earlyExitRequests/${memberUid}`);
  return runTransaction(db, async transaction => {
    const [room, host, member, request] = await Promise.all([
      transaction.get(roomRef), transaction.get(hostRef), transaction.get(memberRef), transaction.get(requestRef),
    ]);
    if (!room.exists() || !host.exists() || !member.exists() || !request.exists()) throw new Error('missing decision record');
    const saved = request.data();
    if (saved.requestId === id && saved.status !== 'OPEN' && saved.decision === decision) return saved.status;
    if (saved.requestId !== id || saved.status !== 'OPEN') throw new Error('request is not current');
    transaction.update(requestRef, {
      status: decision === 'APPROVE' ? 'APPROVED' : 'DENIED', decision, decidedBy: uid,
      decidedAt: serverTimestamp(), cutoffAt: decision === 'APPROVE' ? serverTimestamp() : null,
    });
    if (decision === 'APPROVE') transaction.update(memberRef, { status: 'EARLY_EXIT', earlyExitAt: serverTimestamp() });
    return decision === 'APPROVE' ? 'APPROVED' : 'DENIED';
  });
}

function groupViolation(id, actorUid, endedAt, durationSeconds = 4) {
  return {
    eventId: id, actorUid,
    startedAt: Timestamp.fromMillis(endedAt.toMillis() - durationSeconds * 1_000),
    endedAt, durationSeconds, createdAt: serverTimestamp(),
  };
}

async function recordViolation(db, uid, event) {
  const roomRef = doc(db, `rooms/${roomId}`);
  const memberRef = doc(db, `rooms/${roomId}/members/${uid}`);
  const eventRef = doc(db, `rooms/${roomId}/violations/${event.eventId}`);
  return runTransaction(db, async transaction => {
    const [room, member, existing] = await Promise.all([
      transaction.get(roomRef), transaction.get(memberRef), transaction.get(eventRef),
    ]);
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

test('early-exit request is visible only to room members and is one open request per member', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const memberDb = env.authenticatedContext(memberId).firestore();
  const hostDb = env.authenticatedContext(hostId).firestore();
  const outsiderDb = env.authenticatedContext(outsiderId).firestore();

  assert.equal(await assertSucceeds(requestExit(memberDb, memberId)), 'OPEN');
  assert.equal(await assertSucceeds(requestExit(memberDb, memberId)), 'OPEN');
  await assertFails(requestExit(memberDb, memberId, '00000000-0000-4000-8000-000000000082'));
  assert.equal((await assertSucceeds(getDocs(query(
    collection(hostDb, `rooms/${roomId}/earlyExitRequests`), where('status', '==', 'OPEN'),
  )))).size, 1);
  await assertSucceeds(getDoc(doc(memberDb, `rooms/${roomId}/earlyExitRequests/${memberId}`)));
  await assertFails(getDocs(collection(outsiderDb, `rooms/${roomId}/earlyExitRequests`)));
  await assertFails(setDoc(doc(outsiderDb, `rooms/${roomId}/earlyExitRequests/${outsiderId}`), {
    version: 1, requestId: '00000000-0000-4000-8000-000000000083', memberUid: outsiderId,
    status: 'OPEN', requestedAt: serverTimestamp(), decision: null, decidedBy: null, decidedAt: null, cutoffAt: null,
  }));
});

test('Host approval changes request and membership atomically; denial keeps membership active and allows a fresh request', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const memberDb = env.authenticatedContext(memberId).firestore();
  const hostDb = env.authenticatedContext(hostId).firestore();
  await assertSucceeds(requestExit(memberDb, memberId));
  assert.equal(await assertSucceeds(decideExit(hostDb, hostId, memberId, requestId, 'DENY')), 'DENIED');
  let member = await assertSucceeds(getDoc(doc(memberDb, `rooms/${roomId}/members/${memberId}`)));
  assert.equal(member.data().status, 'ACTIVE');
  await assertSucceeds(requestExit(memberDb, memberId, '00000000-0000-4000-8000-000000000084'));
  assert.equal(await assertSucceeds(decideExit(hostDb, hostId, memberId, '00000000-0000-4000-8000-000000000084', 'APPROVE')), 'APPROVED');
  member = await assertSucceeds(getDoc(doc(memberDb, `rooms/${roomId}/members/${memberId}`)));
  assert.equal(member.data().status, 'EARLY_EXIT');
  assert.ok(member.data().earlyExitAt instanceof Timestamp);
  const request = await assertSucceeds(getDoc(doc(hostDb, `rooms/${roomId}/earlyExitRequests/${memberId}`)));
  assert.equal(request.data().cutoffAt.toMillis(), member.data().earlyExitAt.toMillis());
  assert.equal(await assertSucceeds(decideExit(hostDb, hostId, memberId, '00000000-0000-4000-8000-000000000084', 'APPROVE')), 'APPROVED');
});

test('Host can read and replay the committed decision after the room is terminal', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const memberDb = env.authenticatedContext(memberId).firestore();
  const hostDb = env.authenticatedContext(hostId).firestore();
  await assertSucceeds(requestExit(memberDb, memberId));
  assert.equal(await assertSucceeds(decideExit(hostDb, hostId, memberId, requestId, 'APPROVE')), 'APPROVED');

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await updateDoc(doc(db, `rooms/${roomId}`), { status: 'COMPLETED' });
    await updateDoc(doc(db, `rooms/${roomId}/members/${hostId}`), { status: 'INACTIVE' });
  });

  assert.equal(await assertSucceeds(decideExit(hostDb, hostId, memberId, requestId, 'APPROVE')), 'APPROVED');
  await assertFails(decideExit(hostDb, hostId, memberId, requestId, 'DENY'));
});

test('non-Host cannot decide and client cannot write an exit cutoff directly', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const memberDb = env.authenticatedContext(memberId).firestore();
  await assertSucceeds(requestExit(memberDb, memberId));
  await assertFails(decideExit(memberDb, memberId, memberId, requestId, 'APPROVE'));
  await assertFails(updateDoc(doc(memberDb, `rooms/${roomId}/members/${memberId}`), {
    status: 'EARLY_EXIT', earlyExitAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(memberDb, `rooms/${roomId}/earlyExitRequests/${memberId}`), {
    status: 'APPROVED', decision: 'APPROVE', decidedBy: memberId,
    decidedAt: serverTimestamp(), cutoffAt: serverTimestamp(),
  }));
});

test('eligible late violations through the exact cutoff count; events crossing or after it do not', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const memberDb = env.authenticatedContext(memberId).firestore();
  const hostDb = env.authenticatedContext(hostId).firestore();
  await assertSucceeds(requestExit(memberDb, memberId));
  await assertSucceeds(decideExit(hostDb, hostId, memberId, requestId, 'APPROVE'));
  const member = await assertSucceeds(getDoc(doc(memberDb, `rooms/${roomId}/members/${memberId}`)));
  const cutoff = member.data().earlyExitAt;
  await assertSucceeds(getDoc(doc(memberDb, `rooms/${roomId}/violations/00000000-0000-4000-8000-000000000088`)));

  assert.equal(await assertSucceeds(recordViolation(memberDb, memberId,
    groupViolation('00000000-0000-4000-8000-000000000085', memberId, Timestamp.fromMillis(cutoff.toMillis() - 5_000)))), 'created');
  assert.equal(await assertSucceeds(recordViolation(memberDb, memberId,
    groupViolation('00000000-0000-4000-8000-000000000086', memberId, cutoff))), 'created');
  await new Promise(resolve => setTimeout(resolve, 25));
  const afterCutoff = Timestamp.fromMillis(cutoff.toMillis() + 1);
  await assertFails(recordViolation(memberDb, memberId,
    groupViolation('00000000-0000-4000-8000-000000000087', memberId, afterCutoff)));

  const updated = await assertSucceeds(getDoc(doc(memberDb, `rooms/${roomId}/members/${memberId}`)));
  assert.equal(updated.data().liftCount, 2);
  assert.equal(updated.data().penaltyScore, 28);
});
