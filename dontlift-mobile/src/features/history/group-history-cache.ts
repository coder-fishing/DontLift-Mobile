import type * as SQLite from 'expo-sqlite';
import type { RoomLobbySnapshot } from '../rooms/room-listener';
import type { GroupHistoryDetail } from './group-history-repository';
import { readGroupSummary, type GroupHistoryStatus, type GroupLocalSummary } from './group-history-model';
// Cache theo tài khoản; chỉ lưu roster/điểm, không sao chép bank details hoặc QR.
export async function cacheGroupRoomSnapshot(tx: SQLite.SQLiteDatabase, userId: string, snapshot: RoomLobbySnapshot): Promise<void> {
  const ownMember = snapshot.members.find(m => m.uid === userId && ['ACTIVE', 'EARLY_EXIT'].includes(m.status));
  if (!ownMember) return;
  const terminal = ['COMPLETED', 'CANCELLED', 'ABORTED'].includes(snapshot.status);
  if (terminal && snapshot.startedAtUtcMs != null && snapshot.endedAtUtcMs != null) {
    const earlyExit = ownMember.status === 'EARLY_EXIT' ? ownMember.earlyExitAtUtcMs ?? null : null;
    const completedAtUtcMs = earlyExit == null ? snapshot.endedAtUtcMs : Math.min(snapshot.endedAtUtcMs, earlyExit);
    const summary: GroupLocalSummary = {
      version: 1, eventId: snapshot.roomId, actorUid: userId, roomId: snapshot.roomId,
      status: earlyExit == null ? snapshot.status as GroupHistoryStatus : 'EARLY_EXIT',
      startedAtUtcMs: snapshot.startedAtUtcMs, completedAtUtcMs,
      liftCount: ownMember.liftCount, violationDurationSeconds: ownMember.violationDurationSeconds,
      penaltyScore: ownMember.penaltyScore,
    };
    if (readGroupSummary(summary, userId, snapshot.roomId)) {
      const cached = await tx.getFirstAsync<{ summary_json: string; detail_json: string | null }>(
        'SELECT summary_json, detail_json FROM group_room_history_cache WHERE actor_uid = ? AND room_id = ?', userId, snapshot.roomId);
      let previousShared: GroupHistoryDetail | null = null;
      try { previousShared = cached?.detail_json ? JSON.parse(cached.detail_json) as GroupHistoryDetail : null; } catch { /* Replace malformed cache. */ }
      let previousSummary: GroupLocalSummary | null = null;
      try { previousSummary = cached ? readGroupSummary(JSON.parse(cached.summary_json), userId, snapshot.roomId) : null; } catch { /* Replace malformed cache. */ }
      const keepFinalized = previousShared?.reconciliation === 'FINALIZED' && snapshot.reconciliationStatus !== 'FINALIZED';
      const resolvedSummary = keepFinalized && previousSummary ? previousSummary : summary;
      const sharedDetail: GroupHistoryDetail = {
        roomStatus: snapshot.status, reconciliation: snapshot.reconciliationStatus ?? null,
        finalizationReason: snapshot.finalizationReason ?? null,
        members: snapshot.members.map(member => ({ uid: member.uid, name: member.displayName, status: member.status, score: member.penaltyScore,
          ...(member.avatarUri ? { avatarUri: member.avatarUri } : {}) })),
        excludedCount: previousShared?.excludedCount ?? 0,
        excludedHasMore: previousShared?.excludedHasMore ?? false,
        bill: previousShared?.bill ?? null, billError: previousShared?.billError ?? false,
      };
      if (keepFinalized) {
        sharedDetail.reconciliation = 'FINALIZED';
        sharedDetail.finalizationReason = previousShared?.finalizationReason ?? null;
        sharedDetail.members = previousShared?.members ?? sharedDetail.members;
      }
      await tx.runAsync(`INSERT INTO group_room_history_cache
        (actor_uid, room_id, completed_at_utc_ms, summary_json, detail_json) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(actor_uid, room_id) DO UPDATE SET completed_at_utc_ms=excluded.completed_at_utc_ms,
          summary_json=excluded.summary_json, detail_json=excluded.detail_json`,
      userId, snapshot.roomId, resolvedSummary.completedAtUtcMs, JSON.stringify(resolvedSummary), JSON.stringify(sharedDetail));
    }
  }
  const row = await tx.getFirstAsync<{ detail_json: string | null }>(
    'SELECT detail_json FROM group_history WHERE actor_uid = ? AND room_id = ?', userId, snapshot.roomId);
  if (!row) return;
  let previous: GroupHistoryDetail | null = null;
  try { previous = row.detail_json ? JSON.parse(row.detail_json) as GroupHistoryDetail : null; } catch { /* Cache lỗi được thay bằng snapshot hợp lệ. */ }
  if (previous?.reconciliation === 'FINALIZED' && snapshot.reconciliationStatus !== 'FINALIZED') return;
  const detail: GroupHistoryDetail = { roomStatus: snapshot.status, reconciliation: snapshot.reconciliationStatus ?? null,
    finalizationReason: snapshot.finalizationReason ?? null,
    members: snapshot.members.map(member => ({ uid: member.uid, name: member.displayName, status: member.status, score: member.penaltyScore,
      ...(member.avatarUri ? { avatarUri: member.avatarUri } : {}) })),
    excludedCount: previous?.excludedCount ?? 0, excludedHasMore: previous?.excludedHasMore ?? false,
    bill: previous?.bill ?? null, billError: previous?.billError ?? false };
  await tx.runAsync('UPDATE group_history SET detail_json = ? WHERE actor_uid = ? AND room_id = ?', JSON.stringify(detail), userId, snapshot.roomId);
}
