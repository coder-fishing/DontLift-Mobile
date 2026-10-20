import type { Auth, User } from 'firebase/auth';
import {
  doc, getDocFromServer, runTransaction, serverTimestamp,
  Timestamp, type Firestore,
} from 'firebase/firestore';
import type * as SQLite from 'expo-sqlite';
import { getRandomBytes } from 'expo-crypto';
import { encodeRoomInvitation } from './room-invite-contract';
import { mapRoomCreateError, RoomCreateError, type RoomCreateStage } from './room-create-error';
export { RoomCreateError } from './room-create-error';

export type CreatedRoom = {
  roomId: string;
  pin: string;
  invitation: string;
  hostUid: string;
  hostDisplayName: string;
  createdAt: string | null;
  localCacheSaved: boolean;
};

export type RoomCreateCommand = { requestId: string; roomId: string; pin: string };

type RoomCreateDependencies = {
  firestore: Firestore;
  auth: Auth;
  database: Promise<SQLite.SQLiteDatabase>;
  randomUUID: () => string;
  randomPin?: () => string;
};

function getServerMonthStart(serverTimeMs: number): Timestamp {
  // Chuyển sang giờ Việt Nam trước khi lấy ngày đầu tháng; Rules vẫn tự xác minh theo request.time.
  const local = new Date(serverTimeMs + 7 * 60 * 60 * 1000);
  return Timestamp.fromMillis(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 7 * 60 * 60 * 1000);
}

function defaultRandomPin(): string {
  // Sinh từ nguồn ngẫu nhiên của hệ điều hành và loại phần dư để mỗi PIN có xác suất ngang nhau.
  const limit = Math.floor(0x1_0000_0000 / 100_000_000) * 100_000_000;
  while (true) {
    const bytes = getRandomBytes(4);
    const value = bytes[0] * 0x1000000 + bytes[1] * 0x10000 + bytes[2] * 0x100 + bytes[3];
    if (value < limit) return String(value % 100_000_000).padStart(8, '0');
  }
}

async function withProbeDeadline<T>(operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RoomCreateError('unavailable', 'clock-write')), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function saveRoomProjection(
  database: SQLite.SQLiteDatabase,
  room: CreatedRoom,
): Promise<void> {
  if (room.createdAt === null) throw new Error('room-server-timestamp-pending');
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT OR REPLACE INTO rooms (room_id, host_uid, pin, status, created_at, updated_at)
       VALUES (?, ?, ?, 'WAITING', ?, ?)`,
      room.roomId, room.hostUid, room.pin, room.createdAt, room.createdAt,
    );
    await transaction.runAsync(
      `INSERT OR REPLACE INTO room_members (room_id, uid, display_name, role, status, joined_at)
       VALUES (?, ?, ?, 'HOST', 'ACTIVE', ?)`,
      room.roomId, room.hostUid, room.hostDisplayName, room.createdAt,
    );
  });
}

export function createRoomRepository(dependencies: RoomCreateDependencies) {
  return {
    createCommand(): RoomCreateCommand {
      return {
        requestId: dependencies.randomUUID(),
        roomId: dependencies.randomUUID(),
        pin: (dependencies.randomPin ?? defaultRandomPin)(),
      };
    },
    async createRoom(hostDisplayName: string, command: RoomCreateCommand): Promise<CreatedRoom> {
      const actor: User | null = dependencies.auth.currentUser;
      if (!actor) throw new RoomCreateError('unauthenticated');
      const firestore = dependencies.firestore;
      const uid = actor.uid;
      const { requestId, roomId, pin } = command;
      if (!/^\d{8}$/.test(pin) || !/^[0-9a-f-]{36}$/i.test(requestId) || !/^[0-9a-f-]{36}$/i.test(roomId)) {
        throw new RoomCreateError('unknown');
      }

      let stage: RoomCreateStage = 'clock-write';
      try {
        // Probe để lấy bucket tháng theo giờ server, tránh phụ thuộc clock/timezone của điện thoại.
        const clockRef = doc(firestore, 'users', uid, 'roomQuotaClock', 'current');
        // Transaction không queue offline. Khi hết hạn, probe trả về muộn cũng không được tiếp tục tạo phòng.
        const clockSnapshot = await withProbeDeadline(async () => {
          await runTransaction(firestore, async transaction => {
            await transaction.get(clockRef);
            transaction.set(clockRef, { checkedAt: serverTimestamp() });
          });
          stage = 'clock-read';
          return getDocFromServer(clockRef);
        });
        const checkedAt = clockSnapshot.data()?.checkedAt;
        if (!(checkedAt instanceof Timestamp)) throw new RoomCreateError('unavailable');
        const bucketStart = getServerMonthStart(checkedAt.toMillis());

        const profileRef = doc(firestore, 'users', uid);
        const usageRef = doc(firestore, 'users', uid, 'usage', 'current');
        const receiptRef = doc(firestore, 'users', uid, 'commandReceipts', requestId);
        const roomRef = doc(firestore, 'rooms', roomId);
        const memberRef = doc(firestore, 'rooms', roomId, 'members', uid);
        const pinRef = doc(firestore, 'roomPins', pin);

        stage = 'transaction';
        const receipt: Record<string, unknown> = await runTransaction(firestore, async (transaction): Promise<Record<string, unknown>> => {
          const [profile, usage, priorReceipt] = await Promise.all([
            transaction.get(profileRef), transaction.get(usageRef), transaction.get(receiptRef),
          ]);
          if (!profile.exists()) throw new RoomCreateError('unauthenticated');
          if (priorReceipt.exists()) {
            const previous = priorReceipt.data();
            if (previous.roomId !== roomId || previous.pin !== pin) throw new RoomCreateError('already-exists');
            return { ...previous, hostDisplayName: profile.data().displayName };
          }

          const usageData = usage.data();
          const existingCount = usageData?.bucketStart instanceof Timestamp
            && usageData.bucketStart.isEqual(bucketStart) ? Number(usageData.count) : 0;
          const nextCount = existingCount + 1;
          if (profile.data().isPremium !== true && nextCount > 7) {
            throw new RoomCreateError('quota-exhausted');
          }

          const timestamp = serverTimestamp();
          transaction.set(roomRef, {
            hostId: uid, pin, status: 'WAITING', participantCount: 1,
            createdAt: timestamp, updatedAt: timestamp, hostHeartbeatAt: timestamp,
            startedAt: null, endedAt: null, lastJoinRequestId: null,
          });
          transaction.set(memberRef, {
            displayName: profile.data().displayName || hostDisplayName,
            role: 'HOST', status: 'ACTIVE', penaltyScore: 0, liftCount: 0,
            violationDurationSeconds: 0, joinedAt: timestamp, earlyExitAt: null,
            syncedThroughAt: null, syncAcknowledgedAt: null,
          });
          transaction.set(pinRef, { roomId, hostId: uid, createdAt: timestamp });
          transaction.set(usageRef, {
            bucketStart, count: nextCount, lastRequestId: requestId, updatedAt: timestamp,
          });
          const outcome = { version: 1, requestId, roomId, pin, hostId: uid, status: 'WAITING' };
          transaction.set(receiptRef, { ...outcome, createdAt: timestamp });
          return { ...outcome, hostDisplayName: profile.data().displayName };
        });

        const persistedRoomId = typeof receipt.roomId === 'string' ? receipt.roomId : roomId;
        const persistedPin = typeof receipt.pin === 'string' ? receipt.pin : pin;
        let createdAt: string | null = null;
        try {
          const committedRoom = await getDocFromServer(doc(firestore, 'rooms', persistedRoomId));
          const serverCreatedAt = committedRoom.data()?.createdAt;
          if (serverCreatedAt instanceof Timestamp) createdAt = serverCreatedAt.toDate().toISOString();
        } catch {
          // Commit đã thành công; để trống timestamp cho đến khi đọc lại được giá trị từ server.
        }
        const created: CreatedRoom = {
          roomId: persistedRoomId,
          pin: persistedPin,
          invitation: encodeRoomInvitation(persistedPin),
          hostUid: uid,
          hostDisplayName: typeof receipt.hostDisplayName === 'string' ? receipt.hostDisplayName : hostDisplayName,
          createdAt,
          localCacheSaved: false,
        };

        let localCacheSaved = false;
        if (createdAt !== null) {
          try {
            await saveRoomProjection(await dependencies.database, created);
            localCacheSaved = true;
          } catch {
            // Cloud transaction đã commit; không biến lỗi cache local thành báo lỗi tạo room.
          }
        }
        return { ...created, localCacheSaved };
      } catch (error) {
        throw mapRoomCreateError(error, stage);
      }
    },
  };
}
