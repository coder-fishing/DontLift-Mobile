import type * as SQLite from 'expo-sqlite';
import type { RoomLobbySnapshot } from './room-listener';
import type { CreatedRoom } from './room-repository';
import { encodeRoomInvitation } from './room-invite-contract';

type RestorableRoomRow = {
  room_id: string;
  host_uid: string;
  pin: string;
  host_display_name: string;
  created_at: string;
  status: string;
  reconciliation_status: string | null;
};

// Khôi phục room ACTIVE đã cache để app có thể gắn lại Firestore listener sau khi process bị tạo lại.
export async function restoreCachedActiveRoom(
  databasePromise: Promise<SQLite.SQLiteDatabase>,
  userId: string,
): Promise<CreatedRoom | null> {
  const database = await databasePromise;
  const row = await database.getFirstAsync<RestorableRoomRow>(
    `SELECT r.room_id, r.host_uid, r.pin, host.display_name AS host_display_name, r.created_at
     FROM rooms r
     JOIN room_members mine ON mine.room_id = r.room_id AND mine.uid = ? AND mine.status IN ('ACTIVE', 'EARLY_EXIT')
     JOIN room_members host ON host.room_id = r.room_id AND host.role = 'HOST'
     WHERE (r.status = 'ACTIVE'
        OR EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.id = r.room_id AND s.user_id = mine.uid AND s.mode = 'GROUP' AND s.status = 'ACTIVE'
        )
        OR (r.status = 'COMPLETED' AND r.reconciliation_status = 'PENDING' AND mine.sync_acknowledged_at IS NULL)
        OR (r.status = 'COMPLETED' AND r.reconciliation_status = 'FINALIZED'
          AND r.finalization_reason = 'HOST_OVERRIDE'
          AND EXISTS (
            SELECT 1 FROM sync_outbox o
            WHERE o.aggregate_id = r.room_id AND o.aggregate_type = 'ROOM'
              AND o.actor_uid = mine.uid AND o.sync_status = 'PENDING'
          )))
     ORDER BY CASE WHEN r.status = 'ACTIVE' THEN 0 ELSE 1 END, r.updated_at DESC
     LIMIT 1`,
    userId,
  );
  if (!row) return null;
  return {
    roomId: row.room_id,
    pin: row.pin,
    invitation: encodeRoomInvitation(row.pin),
    hostUid: row.host_uid,
    hostDisplayName: row.host_display_name,
    createdAt: row.created_at,
    localCacheSaved: true,
  };
}

export async function persistRoomLobbyProjection(
  databasePromise: Promise<SQLite.SQLiteDatabase>,
  snapshot: RoomLobbySnapshot,
): Promise<void> {
  if (snapshot.createdAt === null || snapshot.updatedAt === null
    || snapshot.members.some(member => member.joinedAt === null)) {
    throw new Error('room-lobby-server-timestamp-pending');
  }

  const database = await databasePromise;
  await database.withExclusiveTransactionAsync(async transaction => {
    await transaction.runAsync(
      `INSERT OR REPLACE INTO rooms (
         room_id, host_uid, pin, status, created_at, updated_at,
         reconciliation_status, pending_member_count, finalization_reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      snapshot.roomId, snapshot.hostUid, snapshot.pin, snapshot.status, snapshot.createdAt, snapshot.updatedAt,
      snapshot.reconciliationStatus ?? null, snapshot.pendingMemberCount ?? null, snapshot.finalizationReason ?? null,
    );
    // Thay toàn bộ roster để SQLite khớp snapshot chuẩn, gồm cả member đã bị xóa hoặc đổi trạng thái.
    await transaction.runAsync('DELETE FROM room_members WHERE room_id = ?', snapshot.roomId);
    for (const member of snapshot.members) {
      await transaction.runAsync(
        `INSERT INTO room_members (room_id, uid, display_name, role, status, joined_at, sync_acknowledged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        snapshot.roomId, member.uid, member.displayName, member.role, member.status, member.joinedAt,
        member.syncAcknowledgedAtUtcMs == null ? null : new Date(member.syncAcknowledgedAtUtcMs).toISOString(),
      );
    }
  });
}

export async function persistTerminalRoomProjection(
  databasePromise: Promise<SQLite.SQLiteDatabase>,
  input: {
    roomId: string;
    userId: string;
    status: 'COMPLETED' | 'CANCELLED' | 'ABORTED';
    endedAtUtcMs: number;
    reconciliationStatus?: 'PENDING' | 'FINALIZED' | null;
    pendingMemberCount?: number | null;
    finalizationReason?: 'ALL_SYNCED' | 'HOST_OVERRIDE' | null;
  },
): Promise<void> {
  const database = await databasePromise;
  const endedAt = new Date(input.endedAtUtcMs).toISOString();
  await database.withExclusiveTransactionAsync(async transaction => {
    // Terminal room không được khôi phục như session đang chạy ở lần mở app kế tiếp.
    await transaction.runAsync(
      `UPDATE rooms SET status = ?, reconciliation_status = ?, pending_member_count = ?, finalization_reason = ?
       WHERE room_id = ?`,
      input.status, input.reconciliationStatus ?? null, input.pendingMemberCount ?? null,
      input.finalizationReason ?? null, input.roomId,
    );
    await transaction.runAsync(
      `UPDATE sessions SET status = ?, completed_at = ?
       WHERE id = ? AND user_id = ? AND mode = 'GROUP' AND status = 'ACTIVE'`,
      input.status === 'COMPLETED' ? 'COMPLETED' : 'CANCELLED', endedAt, input.roomId, input.userId,
    );
  });
}

export async function persistEarlyExitProjection(
  databasePromise: Promise<SQLite.SQLiteDatabase>,
  input: { roomId: string; userId: string; cutoffUtcMs: number; startedAtUtcMs: number },
): Promise<void> {
  const database = await databasePromise;
  const cutoff = new Date(input.cutoffUtcMs).toISOString();
  const durationSeconds = Math.max(0, Math.floor((input.cutoffUtcMs - input.startedAtUtcMs) / 1_000));
  await database.withExclusiveTransactionAsync(async transaction => {
    // Dừng lần khôi phục sau khi Host duyệt, nhưng vẫn giữ member trong roster/history.
    await transaction.runAsync(
      `UPDATE sessions SET status = 'COMPLETED', duration_seconds = ?, completed_at = ?
       WHERE id = ? AND user_id = ? AND mode = 'GROUP' AND status = 'ACTIVE'`,
      durationSeconds, cutoff, input.roomId, input.userId,
    );
    await transaction.runAsync(
      `UPDATE room_members SET status = 'EARLY_EXIT' WHERE room_id = ? AND uid = ?`,
      input.roomId, input.userId,
    );
  });
}
