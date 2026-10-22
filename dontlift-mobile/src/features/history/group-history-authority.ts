import { doc, runTransaction, Timestamp, type Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { GroupHistoryStatus } from './group-history-model';
export type GroupHistoryAuthority = {
  status: GroupHistoryStatus; cutoffUtcMs: number; startedAtUtcMs: number;
  terminal: boolean; roomStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ABORTED'; earlyExitAtUtcMs: number | null;
};
// Đọc trong cùng transaction: terminal room không được ghép với roster ACTIVE từ stream cũ.
export async function readGroupHistoryAuthority(dependencies: { firestore: Firestore; auth: Auth }, uid: string,
  roomId: string): Promise<GroupHistoryAuthority> {
  if (dependencies.auth.currentUser?.uid !== uid) throw new Error('unauthenticated');
  return runTransaction(dependencies.firestore, async tx => {
    const [roomDoc, memberDoc] = await Promise.all([
      tx.get(doc(dependencies.firestore, 'rooms', roomId)), tx.get(doc(dependencies.firestore, 'rooms', roomId, 'members', uid)),
    ]);
    if (dependencies.auth.currentUser?.uid !== uid) throw new Error('account-changed');
    if (!roomDoc.exists() || !memberDoc.exists()) throw new Error('permission-denied');
    const room = roomDoc.data(); const member = memberDoc.data();
    const terminal = ['COMPLETED', 'CANCELLED', 'ABORTED'].includes(room.status);
    const early = member.status === 'EARLY_EXIT';
    if (!['ACTIVE', 'EARLY_EXIT'].includes(member.status)) throw new Error('permission-denied');
    if (!(room.startedAt instanceof Timestamp) || (!early && !terminal)
      || (terminal && !(room.endedAt instanceof Timestamp)) || (early && !(member.earlyExitAt instanceof Timestamp))) {
      throw new Error('failed-precondition');
    }
    const end = terminal ? Math.floor(room.endedAt.toMillis()) : null;
    const earlyExitAtUtcMs = early ? Math.floor(member.earlyExitAt.toMillis()) : null;
    const cutoffUtcMs = earlyExitAtUtcMs == null ? end! : end == null ? earlyExitAtUtcMs : Math.min(end, earlyExitAtUtcMs);
    return { status: early ? 'EARLY_EXIT' : room.status, roomStatus: room.status,
      startedAtUtcMs: Math.floor(room.startedAt.toMillis()), cutoffUtcMs, earlyExitAtUtcMs, terminal };
  });
}
