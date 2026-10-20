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

type RoomJoinErrorCode = 'unauthenticated' | 'not-found' | 'failed-precondition' | 'unavailable' | 'already-exists' | 'rejected' | 'unknown';

export class RoomJoinError extends Error {
  constructor(public readonly code: RoomJoinErrorCode, public readonly firebaseCode?: string) {
    super(code);
    this.name = 'RoomJoinError';
  }
}

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
export type JoinedRoom = {
  roomId: string;
  pin: string;
  invitation: string;
  hostUid: string;
  status: 'WAITING';
  participantCount: number;
  roomCreatedAt: string | null;
  roomUpdatedAt: string | null;
  joinedAt: string | null;
  alreadyMember: boolean;
  localCacheSaved: boolean;
};

type RoomCreateDependencies = {
  firestore: Firestore;
  auth: Auth;
  database: Promise<SQLite.SQLiteDatabase>;
  randomUUID: () => string;
  randomPin?: () => string;
};

type RoomJoinCommand = { requestId: string; pin: string };

function mapJoinError(error: unknown): RoomJoinError {
  if (error instanceof RoomJoinError) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code.replace(/^firestore\//, '') : '';
  if (code === 'unauthenticated') return new RoomJoinError('unauthenticated', code);
  if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) return new RoomJoinError('unavailable', code);
  if (code === 'permission-denied') return new RoomJoinError('rejected', code);
  if (code === 'already-exists') return new RoomJoinError('already-exists', code);
  return new RoomJoinError('unknown');
}

export function roomJoinErrorMessage(error: unknown): string {
  if (!(error instanceof RoomJoinError)) return 'Không thể tham gia phòng lúc này. Hãy thử lại.';
  switch (error.code) {
    case 'unauthenticated': return 'Phiên đăng nhập không còn hiệu lực. Hãy đăng nhập lại rồi thử lại.';
    case 'not-found': return 'Không tìm thấy phòng đang chờ với mã này. Hãy kiểm tra mã và thử lại.';
    case 'failed-precondition': return 'Phòng này không còn nhận người tham gia.';
    case 'unavailable': return 'Không có kết nối tới Firebase. Mã vẫn được giữ để bạn thử lại.';
    case 'rejected': return 'Không thể tham gia phòng. Phòng có thể đã đủ người hoặc không còn ở trạng thái chờ.';
    case 'already-exists': return 'Yêu cầu này đã được dùng với mã khác. Hãy gửi lại mã phòng.';
    default: return 'Không thể tham gia phòng lúc này. Hãy thử lại.';
  }
}

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

async function saveJoinedRoomProjection(database: SQLite.SQLiteDatabase, room: JoinedRoom, uid: string, displayName: string): Promise<void> {
  if (room.roomCreatedAt === null || room.roomUpdatedAt === null || room.joinedAt === null) {
    throw new Error('room-server-timestamp-pending');
  }
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT OR REPLACE INTO rooms (room_id, host_uid, pin, status, created_at, updated_at)
       VALUES (?, ?, ?, 'WAITING', ?, ?)`,
      room.roomId, room.hostUid, room.pin, room.roomCreatedAt, room.roomUpdatedAt,
    );
    await transaction.runAsync(
      `INSERT OR REPLACE INTO room_members (room_id, uid, display_name, role, status, joined_at)
       VALUES (?, ?, ?, 'MEMBER', 'ACTIVE', ?)`,
      room.roomId, uid, displayName, room.joinedAt,
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
    async joinRoomByPin(command: RoomJoinCommand): Promise<JoinedRoom> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new RoomJoinError('unauthenticated');
      const uid = actor.uid;
      const { pin, requestId } = command;
      if (!/^(?:\d{4}|\d{8})$/.test(pin) || !/^[0-9a-f-]{36}$/i.test(requestId)) throw new RoomJoinError('not-found');

      try {
        const receiptRef = doc(dependencies.firestore, 'users', uid, 'commandReceipts', requestId);
        const reservationRef = doc(dependencies.firestore, 'roomPins', pin);
        const outcome = await runTransaction(dependencies.firestore, async (transaction): Promise<{
          roomId: string; hostUid: string; participantCount: number; alreadyMember: boolean;
        }> => {
          const receipt = await transaction.get(receiptRef);
          if (receipt.exists()) {
            const saved = receipt.data();
            if (saved.pin !== pin || typeof saved.roomId !== 'string' || typeof saved.hostId !== 'string') {
              throw new RoomJoinError('already-exists');
            }
            const roomSnapshot = await transaction.get(doc(dependencies.firestore, 'rooms', saved.roomId));
            if (!roomSnapshot.exists()) throw new RoomJoinError('not-found');
            return {
              roomId: saved.roomId,
              hostUid: saved.hostId,
              participantCount: Number(roomSnapshot.data().participantCount),
              alreadyMember: true,
            };
          }

          // Đọc đúng document PIN, tuyệt đối không query/list collection roomPins.
          const reservation = await transaction.get(reservationRef);
          if (!reservation.exists()) throw new RoomJoinError('not-found');
          const roomId = reservation.data().roomId;
          if (typeof roomId !== 'string') throw new RoomJoinError('not-found');
          const roomRef = doc(dependencies.firestore, 'rooms', roomId);
          const memberRef = doc(dependencies.firestore, 'rooms', roomId, 'members', uid);
          const profileRef = doc(dependencies.firestore, 'users', uid);
          const [roomSnapshot, memberSnapshot, profileSnapshot] = await Promise.all([
            transaction.get(roomRef), transaction.get(memberRef), transaction.get(profileRef),
          ]);
          if (!roomSnapshot.exists() || !profileSnapshot.exists()) throw new RoomJoinError('not-found');
          const room = roomSnapshot.data();
          if (room.pin !== pin) throw new RoomJoinError('not-found');
          if (memberSnapshot.exists()) {
            return { roomId, hostUid: String(room.hostId), participantCount: Number(room.participantCount), alreadyMember: true };
          }
          if (room.status !== 'WAITING') throw new RoomJoinError('failed-precondition');
          const hostUid = room.hostId;
          if (typeof hostUid !== 'string') throw new RoomJoinError('not-found');
          const timestamp = serverTimestamp();
          transaction.set(memberRef, {
            displayName: profileSnapshot.data().displayName,
            role: 'MEMBER', status: 'ACTIVE', penaltyScore: 0, liftCount: 0,
            violationDurationSeconds: 0, joinedAt: timestamp, earlyExitAt: null,
            syncedThroughAt: null, syncAcknowledgedAt: null,
          });
          transaction.update(roomRef, {
            participantCount: room.participantCount + 1, updatedAt: timestamp, lastJoinRequestId: requestId,
          });
          const receiptData = {
            version: 1, requestId, roomId, pin, hostId: hostUid, status: 'WAITING', createdAt: timestamp,
          };
          transaction.set(receiptRef, receiptData);
          return { roomId, hostUid, participantCount: room.participantCount + 1, alreadyMember: false };
        });

        const [roomSnapshot, memberSnapshot] = await Promise.all([
          getDocFromServer(doc(dependencies.firestore, 'rooms', outcome.roomId)),
          getDocFromServer(doc(dependencies.firestore, 'rooms', outcome.roomId, 'members', uid)),
        ]);
        const roomData = roomSnapshot.data();
        const memberData = memberSnapshot.data();
        const roomCreatedAt = roomData?.createdAt instanceof Timestamp ? roomData.createdAt.toDate().toISOString() : null;
        const roomUpdatedAt = roomData?.updatedAt instanceof Timestamp ? roomData.updatedAt.toDate().toISOString() : null;
        const joinedAt = memberData?.joinedAt instanceof Timestamp ? memberData.joinedAt.toDate().toISOString() : null;
        const result: JoinedRoom = {
          roomId: outcome.roomId, pin, invitation: encodeRoomInvitation(pin), hostUid: outcome.hostUid,
          status: 'WAITING', participantCount: outcome.participantCount, roomCreatedAt, roomUpdatedAt, joinedAt,
          alreadyMember: outcome.alreadyMember, localCacheSaved: false,
        };
        if (roomCreatedAt && roomUpdatedAt && joinedAt) {
          try {
            await saveJoinedRoomProjection(await dependencies.database, result, uid,
              typeof memberData?.displayName === 'string' ? memberData.displayName : '');
            result.localCacheSaved = true;
          } catch {
            // Join cloud đã commit; cache local có thể đồng bộ lại khi mở room sau.
          }
        }
        return result;
      } catch (error) {
        throw mapJoinError(error);
      }
    },
  };
}
