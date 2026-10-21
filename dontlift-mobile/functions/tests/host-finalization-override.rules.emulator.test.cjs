'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc } = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

const roomId = '10000000-0000-4000-8000-000000000021';
const hostId = 'sl021-host';
const memberId = 'sl021-member';
const outsiderId = 'sl021-outsider';
const requestId = '00000000-0000-4000-8000-000000000021';
const eventId = '00000000-0000-4000-8000-000000000022';

async function seedCompletedPending(env, pendingMemberCount = 2) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `rooms/${roomId}`), {
      hostId, pin: '00000021', status: 'COMPLETED', participantCount: 2,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), hostHeartbeatAt: serverTimestamp(),
      startedAt: Timestamp.fromMillis(Date.now() - 60_000), endedAt: Timestamp.fromMillis(Date.now() - 5_000),
      reconciliationStatus: 'PENDING', pendingMemberCount, completionRequestId: requestId,
      lastSyncAckMemberUid: null, lastSyncAckRequestId: null,
      finalizedAt: null, finalizedBy: null, finalizationReason: null,
    });
    for (const [uid, role] of [[hostId, 'HOST'], [memberId, 'MEMBER']]) {
      await setDoc(doc(db, `rooms/${roomId}/members/${uid}`), {
        displayName: uid, role, status: 'ACTIVE', penaltyScore: uid === memberId ? 14 : 0,
        liftCount: uid === memberId ? 1 : 0, violationDurationSeconds: uid === memberId ? 4 : 0,
        joinedAt: serverTimestamp(), earlyExitAt: null,
        syncedThroughAt: null, syncAcknowledgedAt: null,
      });
    }
  });
}

function overrideAtomically(db, { warningConfirmed = true, auditId = requestId, uids = [hostId, memberId] } = {}) {
  const roomRef = doc(db, `rooms/${roomId}`);
  const auditRef = doc(db, `rooms/${roomId}/reconciliationAudits/${auditId}`);
  return runTransaction(db, async transaction => {
    const [room, audit] = await Promise.all([transaction.get(roomRef), transaction.get(auditRef)]);
    assert.equal(audit.exists(), false);
    const data = room.data();
    transaction.update(roomRef, {
      reconciliationStatus: 'FINALIZED', finalizationReason: 'HOST_OVERRIDE',
      finalizedAt: serverTimestamp(), finalizedBy: hostId, hostOverrideRequestId: auditId,
    });
    transaction.set(auditRef, {
      version: 1, requestId: auditId, hostUid: hostId, reason: 'HOST_OVERRIDE',
      confirmedWarning: warningConfirmed, roomEndedAt: data.endedAt, createdAt: serverTimestamp(),
      pendingMemberCount: data.pendingMemberCount, unsyncedMemberUids: uids,
      scoreSnapshotRef: `rooms/${roomId}/members`,
    });
  });
}

test('only the active Host can atomically finalize and append one audit', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedCompletedPending(env);
  const hostDb = env.authenticatedContext(hostId).firestore();
  await assertSucceeds(overrideAtomically(hostDb));

  const room = await assertSucceeds(getDoc(doc(hostDb, `rooms/${roomId}`)));
  const audit = await assertSucceeds(getDoc(doc(hostDb, `rooms/${roomId}/reconciliationAudits/${requestId}`)));
  assert.equal(room.data().finalizationReason, 'HOST_OVERRIDE');
  assert.equal(room.data().reconciliationStatus, 'FINALIZED');
  assert.equal(audit.data().confirmedWarning, true);
  assert.deepEqual(audit.data().unsyncedMemberUids, [hostId, memberId]);
  assert.equal((await assertSucceeds(getDocs(collection(hostDb, `rooms/${roomId}/reconciliationAudits`)))).size, 1);
  await assertFails(updateDoc(doc(hostDb, `rooms/${roomId}/reconciliationAudits/${requestId}`), { reason: 'EDITED' }));
  await assertFails(updateDoc(doc(hostDb, `rooms/${roomId}/reconciliationAudits/${requestId}`), { deleted: true }));
  await assertFails(getDocs(collection(env.authenticatedContext(outsiderId).firestore(), `rooms/${roomId}/reconciliationAudits`)));
});

test('Rules deny an unconfirmed warning, non-Host, standalone audit and empty pending set', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedCompletedPending(env);
  await assertFails(overrideAtomically(env.authenticatedContext(hostId).firestore(), { warningConfirmed: false }));
  await assertFails(overrideAtomically(env.authenticatedContext(memberId).firestore()));
  await assertFails(setDoc(doc(env.authenticatedContext(hostId).firestore(), `rooms/${roomId}/reconciliationAudits/${requestId}`), {
    version: 1, requestId, hostUid: hostId, reason: 'HOST_OVERRIDE', confirmedWarning: true,
    roomEndedAt: Timestamp.now(), createdAt: serverTimestamp(), pendingMemberCount: 2,
    unsyncedMemberUids: [hostId, memberId], scoreSnapshotRef: `rooms/${roomId}/members`,
  }));

  const emptyEnv = await createRulesEnvironment();
  t.after(() => emptyEnv.cleanup());
  await seedCompletedPending(emptyEnv, 0);
  await assertFails(overrideAtomically(emptyEnv.authenticatedContext(hostId).firestore(), { uids: [] }));
});

test('late eligible violation is history-only and finalized scores remain immutable', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedCompletedPending(env);
  const hostDb = env.authenticatedContext(hostId).firestore();
  await assertSucceeds(overrideAtomically(hostDb));
  const memberDb = env.authenticatedContext(memberId).firestore();
  const end = Timestamp.fromMillis(Date.now() - 10_000);
  const event = {
    eventId, actorUid: memberId, startedAt: Timestamp.fromMillis(end.toMillis() - 4_000),
    endedAt: end, durationSeconds: 4, createdAt: serverTimestamp(),
    excludedFromFinalScore: true, exclusionReason: 'HOST_OVERRIDE',
  };
  await assertSucceeds(setDoc(doc(memberDb, `rooms/${roomId}/violations/${eventId}`), event));
  await assertFails(updateDoc(doc(memberDb, `rooms/${roomId}/members/${memberId}`), { penaltyScore: 999 }));
  const score = await env.withSecurityRulesDisabled(context => getDoc(doc(context.firestore(), `rooms/${roomId}/members/${memberId}`)));
  assert.equal(score.data().penaltyScore, 14);
});
