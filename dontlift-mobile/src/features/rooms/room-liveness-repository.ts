import type { Auth } from 'firebase/auth';
import {
  doc, runTransaction, serverTimestamp, Timestamp, type Firestore,
} from 'firebase/firestore';

export const HOST_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1_000;
export const HOST_STALE_AFTER_MS = 15 * 60 * 1_000;
export const STALE_ROOM_RETRY_MS = 60 * 1_000;

export type StaleRoomResult = 'aborted' | 'terminal';

type RoomLivenessErrorCode = 'unauthenticated' | 'not-found' | 'failed-precondition' | 'unavailable' | 'rejected' | 'unknown';

export class RoomLivenessError extends Error {
  constructor(public readonly code: RoomLivenessErrorCode, public readonly firebaseCode?: string) {
    super(code);
    this.name = 'RoomLivenessError';
  }
}

function mapRoomLivenessError(error: unknown): RoomLivenessError {
  if (error instanceof RoomLivenessError) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code.replace(/^firestore\//, '') : '';
  if (code === 'unauthenticated') return new RoomLivenessError('unauthenticated', code);
  if (code === 'not-found') return new RoomLivenessError('not-found', code);
  if (code === 'failed-precondition') return new RoomLivenessError('failed-precondition', code);
  if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) {
    return new RoomLivenessError('unavailable', code);
  }
  if (code === 'permission-denied') return new RoomLivenessError('rejected', code);
  return new RoomLivenessError('unknown', code || undefined);
}

export function createRoomLivenessRepository(dependencies: { firestore: Firestore; auth: Auth }) {
  return {
    async sendHostHeartbeat(roomId: string): Promise<void> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new RoomLivenessError('unauthenticated');
      const roomRef = doc(dependencies.firestore, 'rooms', roomId);
      try {
        await runTransaction(dependencies.firestore, async transaction => {
          const roomSnapshot = await transaction.get(roomRef);
          if (!roomSnapshot.exists()) throw new RoomLivenessError('not-found');
          const room = roomSnapshot.data();
          if (room.hostId !== actor.uid || room.status !== 'ACTIVE') {
            throw new RoomLivenessError('failed-precondition');
          }
          // Rules kiểm tra Host membership và chỉ chấp nhận timestamp do server sinh.
          transaction.update(roomRef, {
            hostHeartbeatAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      } catch (error) {
        throw mapRoomLivenessError(error);
      }
    },

    async abortStaleRoom(roomId: string): Promise<StaleRoomResult> {
      if (!dependencies.auth.currentUser) throw new RoomLivenessError('unauthenticated');
      const roomRef = doc(dependencies.firestore, 'rooms', roomId);
      try {
        return await runTransaction(dependencies.firestore, async transaction => {
          const roomSnapshot = await transaction.get(roomRef);
          if (!roomSnapshot.exists()) throw new RoomLivenessError('not-found');
          const room = roomSnapshot.data();
          if (room.status !== 'ACTIVE') return 'terminal';
          const heartbeatAt = room.hostHeartbeatAt;
          const startedAt = room.startedAt;
          if (!(heartbeatAt instanceof Timestamp) || !(startedAt instanceof Timestamp)) {
            throw new RoomLivenessError('failed-precondition');
          }
          // Bản app cũ chưa refresh heartbeat ở start; startedAt vẫn là mốc liveness hợp lệ.
          const livenessAtUtcMs = Math.max(heartbeatAt.toMillis(), startedAt.toMillis());
          const cutoffUtcMs = livenessAtUtcMs + HOST_STALE_AFTER_MS;
          // Không dùng giờ thiết bị để quyết định; Rules từ chối nếu server chưa qua cutoff.
          transaction.update(roomRef, {
            status: 'ABORTED',
            endedAt: Timestamp.fromMillis(cutoffUtcMs),
            updatedAt: serverTimestamp(),
          });
          return 'aborted';
        });
      } catch (error) {
        throw mapRoomLivenessError(error);
      }
    },
  };
}
