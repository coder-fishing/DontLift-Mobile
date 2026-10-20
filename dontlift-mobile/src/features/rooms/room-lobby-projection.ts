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
     JOIN room_members mine ON mine.room_id = r.room_id AND mine.uid = ? AND mine.status = 'ACTIVE'
     JOIN room_members host ON host.room_id = r.room_id AND host.role = 'HOST'
     WHERE (r.status = 'ACTIVE'
        OR EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.id = r.room_id AND s.user_id = mine.uid AND s.mode = 'GROUP' AND s.status = 'ACTIVE'
        ))
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
      `INSERT OR REPLACE INTO rooms (room_id, host_uid, pin, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      snapshot.roomId, snapshot.hostUid, snapshot.pin, snapshot.status, snapshot.createdAt, snapshot.updatedAt,
    );
    // Thay toàn bộ roster để SQLite khớp snapshot chuẩn, gồm cả member đã bị xóa hoặc đổi trạng thái.
    await transaction.runAsync('DELETE FROM room_members WHERE room_id = ?', snapshot.roomId);
    for (const member of snapshot.members) {
      await transaction.runAsync(
        `INSERT INTO room_members (room_id, uid, display_name, role, status, joined_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        snapshot.roomId, member.uid, member.displayName, member.role, member.status, member.joinedAt,
      );
    }
  });
}
