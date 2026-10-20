import type * as SQLite from 'expo-sqlite';
import type { RoomLobbySnapshot } from './room-listener';

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
