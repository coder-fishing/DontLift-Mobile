import type * as SQLite from 'expo-sqlite';
import type { RoomLobbySnapshot } from '../rooms/room-listener';
import type { GroupHistoryDetail } from './group-history-repository';
// Cache theo tài khoản; chỉ lưu roster/điểm, không sao chép bank details hoặc QR.
export async function cacheGroupRoomSnapshot(tx: SQLite.SQLiteDatabase, userId: string, snapshot: RoomLobbySnapshot): Promise<void> {
  if (!snapshot.members.some(m => m.uid === userId && ['ACTIVE', 'EARLY_EXIT'].includes(m.status))) return;
  const row = await tx.getFirstAsync<{ detail_json: string | null }>(
    'SELECT detail_json FROM group_history WHERE actor_uid = ? AND room_id = ?', userId, snapshot.roomId);
  if (!row) return;
  let previous: GroupHistoryDetail | null = null;
  try { previous = row.detail_json ? JSON.parse(row.detail_json) as GroupHistoryDetail : null; } catch { /* Cache lỗi được thay bằng snapshot hợp lệ. */ }
  if (previous?.reconciliation === 'FINALIZED' && snapshot.reconciliationStatus !== 'FINALIZED') return;
  const detail: GroupHistoryDetail = { roomStatus: snapshot.status, reconciliation: snapshot.reconciliationStatus ?? null,
    finalizationReason: snapshot.finalizationReason ?? null,
    members: snapshot.members.map(member => ({ uid: member.uid, name: member.displayName, status: member.status, score: member.penaltyScore })),
    excludedCount: previous?.excludedCount ?? 0, excludedHasMore: previous?.excludedHasMore ?? false,
    bill: previous?.bill ?? null, billError: previous?.billError ?? false };
  await tx.runAsync('UPDATE group_history SET detail_json = ? WHERE actor_uid = ? AND room_id = ?', JSON.stringify(detail), userId, snapshot.roomId);
}
