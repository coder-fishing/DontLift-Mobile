import type { Auth } from 'firebase/auth';
import { collection, doc, getDocFromServer, getDocsFromServer, runTransaction, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore';
import type * as SQLite from 'expo-sqlite';

export function createLobbyLeaveRepository({ firestore, auth, database }: {
  firestore: Firestore; auth: Auth; database: Promise<SQLite.SQLiteDatabase>;
}) {
  return {
    async removeMember(roomId: string, memberUid: string): Promise<void> {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sign in again before removing a member.');
      if (!memberUid || memberUid === uid) throw new Error('Use Leave Room to leave this lobby.');
      const roomRef = doc(firestore, 'rooms', roomId);
      const hostRef = doc(firestore, 'rooms', roomId, 'members', uid);
      const memberRef = doc(firestore, 'rooms', roomId, 'members', memberUid);
      await runTransaction(firestore, async transaction => {
        const [room, host, member] = await Promise.all([
          transaction.get(roomRef), transaction.get(hostRef), transaction.get(memberRef),
        ]);
        if (auth.currentUser?.uid !== uid || !room.exists() || !host.exists()
          || room.data().hostId !== uid || host.data().role !== 'HOST' || host.data().status !== 'ACTIVE') {
          throw new Error('Only the current host can remove members.');
        }
        if (room.data().status !== 'WAITING') throw new Error('Members can only be removed before the session starts.');
        if (!member.exists()) return;
        const count = room.data().participantCount;
        if (member.data().role !== 'MEMBER' || member.data().status !== 'ACTIVE'
          || !Number.isInteger(count) || count < 2) throw new Error('The member list changed. Please retry.');
        transaction.update(roomRef, { participantCount: count - 1, lastKickUid: memberUid, updatedAt: serverTimestamp() });
        transaction.delete(memberRef);
      });
    },
    async leave(roomId: string): Promise<void> {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sign in again before leaving the room.');
      const roomRef = doc(firestore, 'rooms', roomId);
      const ownRef = doc(firestore, 'rooms', roomId, 'members', uid);
      const own = await getDocFromServer(ownRef);
      // Missing membership confirms a previous leave whose response was lost.
      if (own.exists()) {
        const roster = own.data().role === 'HOST'
          ? await getDocsFromServer(collection(firestore, 'rooms', roomId, 'members')) : null;
        const successors = roster?.docs.filter(member => member.id !== uid && member.data().status === 'ACTIVE')
          .sort((a, b) => {
            const aTime = a.data().joinedAt;
            const bTime = b.data().joinedAt;
            return (aTime instanceof Timestamp ? aTime.toMillis() : Infinity)
              - (bTime instanceof Timestamp ? bTime.toMillis() : Infinity) || a.id.localeCompare(b.id);
          });
        await runTransaction(firestore, async transaction => {
          const [room, member] = await Promise.all([transaction.get(roomRef), transaction.get(ownRef)]);
          if (!member.exists()) return;
          if (auth.currentUser?.uid !== uid) throw new Error('Your account changed. Please try again.');
          if (!room.exists() || room.data().status !== 'WAITING') {
            throw new Error('This session has already started. Use the active session exit controls.');
          }
          const count = room.data().participantCount;
          if (!Number.isInteger(count) || count < 1) throw new Error('Could not confirm the member list. Refresh and retry.');
          const isHost = room.data().hostId === uid;
          let successorUid = room.data().hostId;
          if (isHost && count > 1) {
            const successor = successors?.[0];
            if (!roster || roster.size !== count || !successor) throw new Error('The member list changed. Please retry.');
            const next = await transaction.get(successor.ref);
            if (!next.exists() || next.data().role !== 'MEMBER' || next.data().status !== 'ACTIVE') {
              throw new Error('The next host changed. Please retry.');
            }
            successorUid = successor.id;
            transaction.update(successor.ref, { role: 'HOST' });
          }
          const closesRoom = isHost && count === 1;
          transaction.update(roomRef, {
            hostId: successorUid, participantCount: count - 1, lastLeaveUid: uid,
            updatedAt: serverTimestamp(),
            ...(closesRoom ? { status: 'CANCELLED', endedAt: serverTimestamp() } : {}),
          });
          transaction.delete(ownRef);
        });
      }
      try {
        const db = await database;
        await db.runAsync('DELETE FROM room_members WHERE room_id = ? AND uid = ?', roomId, uid);
      } catch (error) {
        if (__DEV__) console.warn('[lobby-leave] local cleanup pending', error);
      }
    },
  };
}
