'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { doc, getDoc, getDocs, collection, query, runTransaction, serverTimestamp, setDoc, Timestamp } = require('firebase/firestore');
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { createRulesEnvironment } = require('./helpers/rules-emulator.cjs');

const roomId = '10000000-0000-4000-8000-000000000019';
const hostId = 'sl019-host';
const memberId = 'sl019-member';
const outsiderId = 'sl019-outsider';
const voteId = '00000000-0000-4000-8000-000000000091';

async function seedRoom(env) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `rooms/${roomId}`), {
      hostId, pin: '00000019', status: 'ACTIVE', participantCount: 2, activeMemberCount: 2,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), hostHeartbeatAt: serverTimestamp(),
      startedAt: Timestamp.fromMillis(Date.now() - 10_000), endedAt: null,
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

async function openVote(db, uid, requestId = voteId) {
  const roomRef = doc(db, `rooms/${roomId}`);
  const memberRef = doc(db, `rooms/${roomId}/members/${uid}`);
  const voteRef = doc(db, `rooms/${roomId}/terminationVotes/current`);
  return runTransaction(db, async tx => {
    const [room, member, vote] = await Promise.all([tx.get(roomRef), tx.get(memberRef), tx.get(voteRef)]);
    if (vote.exists()) return vote.data().voteId;
    tx.set(voteRef, {
      version: 1, voteId: requestId, requestId, openedByUid: uid, openedAt: serverTimestamp(),
      eligibleVoterCount: room.data().activeMemberCount, yesVoteCount: 0, status: 'OPEN',
    });
    return requestId;
  });
}

async function castVote(db, uid, choice, requestId) {
  const roomRef = doc(db, `rooms/${roomId}`);
  const memberRef = doc(db, `rooms/${roomId}/members/${uid}`);
  const voteRef = doc(db, `rooms/${roomId}/terminationVotes/current`);
  const ballotRef = doc(db, `rooms/${roomId}/terminationVotes/current/ballots/${uid}`);
  return runTransaction(db, async tx => {
    const [room, member, vote, ballot] = await Promise.all([
      tx.get(roomRef), tx.get(memberRef), tx.get(voteRef), tx.get(ballotRef),
    ]);
    if (ballot.exists() && ballot.data().voteId === voteId) {
      if (ballot.data().requestId === requestId && ballot.data().choice === choice) return 'replayed';
      throw new Error('ballot already committed');
    }
    const yesCount = vote.data().yesVoteCount + (choice === 'YES' ? 1 : 0);
    const unanimous = choice === 'YES' && yesCount === vote.data().eligibleVoterCount;
    tx.set(ballotRef, { version: 1, voteId, requestId, choice, castAt: serverTimestamp() });
    tx.update(voteRef, { yesVoteCount: yesCount, ...(unanimous ? { status: 'CANCELLED', closedAt: serverTimestamp() } : {}) });
    if (unanimous) tx.update(roomRef, { status: 'CANCELLED', endedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return unanimous ? 'CANCELLED' : 'OPEN';
  });
}

test('active room members read current vote and ballots; outsiders cannot', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  await assertSucceeds(openVote(env.authenticatedContext(hostId).firestore(), hostId));
  const memberDb = env.authenticatedContext(memberId).firestore();
  await assertSucceeds(getDoc(doc(memberDb, `rooms/${roomId}/terminationVotes/current`)));
  await assertSucceeds(getDocs(query(collection(memberDb, `rooms/${roomId}/terminationVotes/current/ballots`))));
  const outsiderDb = env.authenticatedContext(outsiderId).firestore();
  await assertFails(getDoc(doc(outsiderDb, `rooms/${roomId}/terminationVotes/current`)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `rooms/${roomId}/terminationVotes/current`)));
});

test('a NO keeps the room active; every eligible YES cancels the room atomically', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const hostDb = env.authenticatedContext(hostId).firestore();
  const memberDb = env.authenticatedContext(memberId).firestore();
  await assertSucceeds(openVote(hostDb, hostId));
  assert.equal(await assertSucceeds(castVote(memberDb, memberId, 'NO', '00000000-0000-4000-8000-000000000092')), 'OPEN');
  assert.equal(await assertSucceeds(castVote(hostDb, hostId, 'YES', '00000000-0000-4000-8000-000000000093')), 'OPEN');
  assert.equal(await assertSucceeds(castVote(hostDb, hostId, 'YES', '00000000-0000-4000-8000-000000000093')), 'replayed');
  let room = await assertSucceeds(getDoc(doc(hostDb, `rooms/${roomId}`)));
  assert.equal(room.data().status, 'ACTIVE');
  const alternateVote = doc(hostDb, `rooms/${roomId}/terminationVotes/current/ballots/${hostId}`);
  await assertFails(setDoc(alternateVote, {
    version: 1, voteId, requestId: '00000000-0000-4000-8000-000000000094', choice: 'NO', castAt: serverTimestamp(),
  }));
  const memberBallot = doc(memberDb, `rooms/${roomId}/terminationVotes/current/ballots/${memberId}`);
  await assertFails(setDoc(memberBallot, {
    version: 1, voteId, requestId: '00000000-0000-4000-8000-000000000095', choice: 'YES', castAt: serverTimestamp(),
  }));
});

test('Rules reject a ballot after the server-based deadline even while the room is active', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `rooms/${roomId}/terminationVotes/current`), {
      version: 1, voteId, requestId: voteId, openedByUid: hostId,
      openedAt: Timestamp.fromMillis(Date.now() - 31_000), eligibleVoterCount: 2,
      yesVoteCount: 0, status: 'OPEN',
    });
  });
  await assertFails(castVote(env.authenticatedContext(hostId).firestore(), hostId, 'YES',
    '00000000-0000-4000-8000-000000000098'));
  const room = await assertSucceeds(getDoc(doc(env.authenticatedContext(hostId).firestore(), `rooms/${roomId}`)));
  assert.equal(room.data().status, 'ACTIVE');
});

test('unanimous YES transitions vote and room together; independent client room writes are denied', async t => {
  const env = await createRulesEnvironment();
  t.after(() => env.cleanup());
  await seedRoom(env);
  const hostDb = env.authenticatedContext(hostId).firestore();
  const memberDb = env.authenticatedContext(memberId).firestore();
  await assertSucceeds(openVote(hostDb, hostId));
  assert.equal(await assertSucceeds(castVote(memberDb, memberId, 'YES', '00000000-0000-4000-8000-000000000096')), 'OPEN');
  assert.equal(await assertSucceeds(castVote(hostDb, hostId, 'YES', '00000000-0000-4000-8000-000000000097')), 'CANCELLED');
  const [room, vote] = await Promise.all([
    assertSucceeds(getDoc(doc(hostDb, `rooms/${roomId}`))),
    assertSucceeds(getDoc(doc(hostDb, `rooms/${roomId}/terminationVotes/current`))),
  ]);
  assert.equal(room.data().status, 'CANCELLED');
  assert.equal(vote.data().status, 'CANCELLED');
  await assertFails(setDoc(doc(hostDb, `rooms/${roomId}`), { status: 'CANCELLED' }, { merge: true }));
});
