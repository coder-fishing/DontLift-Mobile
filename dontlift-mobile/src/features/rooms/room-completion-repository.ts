import {
  doc, runTransaction, serverTimestamp, Timestamp, type Firestore,
} from 'firebase/firestore';
import type { Auth } from 'firebase/auth';

type Dependencies = { firestore: Firestore; auth: Auth; createId?: () => string };
type ReconciliationStatus = 'PENDING' | 'FINALIZED';

export type RoomCompletionResult = {
  version: 1;
  roomId: string;
  requestId: string;
  status: 'COMPLETED';
  endedAtUtcMs: number | null;
  reconciliationStatus: ReconciliationStatus;
  pendingMemberCount: number;
  finalizationReason: 'ALL_SYNCED' | 'HOST_OVERRIDE' | null;
};

export type MemberSyncAcknowledgment = RoomCompletionResult & { memberUid: string };
export type HostScoreFinalization = RoomCompletionResult & {
  finalizationReason: 'HOST_OVERRIDE';
  unsyncedMemberUids: string[];
  auditId: string;
  scoreSnapshotRef: string;
};

export class RoomCompletionError extends Error {
  constructor(public readonly code: 'unauthenticated' | 'invalid-argument' | 'not-found' | 'permission-denied' | 'failed-precondition' | 'unavailable' | 'already-exists' | 'unknown') {
    super(code);
    this.name = 'RoomCompletionError';
  }
}

function mapError(error: unknown): RoomCompletionError {
  if (error instanceof RoomCompletionError) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code).replace(/^firestore\//, '') : '';
  if (['unauthenticated', 'permission-denied', 'not-found', 'failed-precondition', 'already-exists'].includes(code)) {
    return new RoomCompletionError(code as RoomCompletionError['code']);
  }
  if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) return new RoomCompletionError('unavailable');
  return new RoomCompletionError('unknown');
}

function validRequestId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validRoomId(value: string): boolean {
  return validRequestId(value);
}

function resultFromRoom(roomId: string, requestId: string, data: Record<string, unknown>): RoomCompletionResult {
  const endedAt = data.endedAt;
  return {
    version: 1,
    roomId,
    requestId,
    status: 'COMPLETED',
    endedAtUtcMs: endedAt instanceof Timestamp ? endedAt.toMillis() : null,
    reconciliationStatus: data.reconciliationStatus === 'FINALIZED' ? 'FINALIZED' : 'PENDING',
    pendingMemberCount: Number(data.pendingMemberCount ?? 0),
    finalizationReason: data.finalizationReason === 'ALL_SYNCED' || data.finalizationReason === 'HOST_OVERRIDE'
      ? data.finalizationReason : null,
  };
}

export function createRoomCompletionRepository(dependencies: Dependencies) {
  return {
    async finalizeRoomScores(input: {
      roomId: string;
      requestId: string;
      reason: 'HOST_OVERRIDE';
      confirmedWarning: boolean;
      unsyncedMemberUids: string[];
    }): Promise<HostScoreFinalization> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new RoomCompletionError('unauthenticated');
      if (!validRequestId(input.requestId) || !validRoomId(input.roomId)
        || input.reason !== 'HOST_OVERRIDE' || input.confirmedWarning !== true
        || !Array.isArray(input.unsyncedMemberUids)
        || input.unsyncedMemberUids.some(uid => typeof uid !== 'string' || uid.length === 0)
        || new Set(input.unsyncedMemberUids).size !== input.unsyncedMemberUids.length) {
        throw new RoomCompletionError('invalid-argument');
      }

      const roomRef = doc(dependencies.firestore, 'rooms', input.roomId);
      const hostRef = doc(dependencies.firestore, 'rooms', input.roomId, 'members', actor.uid);
      const auditRef = doc(dependencies.firestore, 'rooms', input.roomId, 'reconciliationAudits', input.requestId);
      const scoreSnapshotRef = `rooms/${input.roomId}/members`;
      try {
        return await runTransaction(dependencies.firestore, async transaction => {
          const [roomSnapshot, hostSnapshot, auditSnapshot] = await Promise.all([
            transaction.get(roomRef), transaction.get(hostRef), transaction.get(auditRef),
          ]);
          if (!roomSnapshot.exists() || !hostSnapshot.exists()) throw new RoomCompletionError('not-found');
          const room = roomSnapshot.data();
          const host = hostSnapshot.data();
          if (room.hostId !== actor.uid || host.role !== 'HOST' || host.status !== 'ACTIVE') {
            throw new RoomCompletionError('permission-denied');
          }

          if (room.status === 'COMPLETED' && room.reconciliationStatus === 'FINALIZED'
            && room.finalizationReason === 'HOST_OVERRIDE' && room.hostOverrideRequestId === input.requestId) {
            if (!auditSnapshot.exists()) throw new RoomCompletionError('failed-precondition');
            const audit = auditSnapshot.data();
            return {
              ...resultFromRoom(input.roomId, input.requestId, room),
              finalizationReason: 'HOST_OVERRIDE',
              unsyncedMemberUids: Array.isArray(audit.unsyncedMemberUids)
                ? audit.unsyncedMemberUids.filter((uid: unknown): uid is string => typeof uid === 'string') : [],
              auditId: input.requestId,
              scoreSnapshotRef: String(audit.scoreSnapshotRef ?? scoreSnapshotRef),
            };
          }

          if (room.status !== 'COMPLETED' || room.reconciliationStatus !== 'PENDING'
            || !Number.isInteger(room.pendingMemberCount) || room.pendingMemberCount <= 0
            || !(room.endedAt instanceof Timestamp)
            || input.unsyncedMemberUids.length !== room.pendingMemberCount
            || auditSnapshot.exists()) {
            throw new RoomCompletionError('failed-precondition');
          }

          // Chốt điểm và tạo audit cùng lúc; danh sách UID phản ánh roster Host quan sát, Rules không thể xác minh đủ thiếu.
          transaction.update(roomRef, {
            reconciliationStatus: 'FINALIZED',
            finalizationReason: 'HOST_OVERRIDE',
            finalizedAt: serverTimestamp(),
            finalizedBy: actor.uid,
            hostOverrideRequestId: input.requestId,
          });
          transaction.set(auditRef, {
            version: 1,
            requestId: input.requestId,
            hostUid: actor.uid,
            reason: 'HOST_OVERRIDE',
            confirmedWarning: true,
            roomEndedAt: room.endedAt,
            createdAt: serverTimestamp(),
            pendingMemberCount: room.pendingMemberCount,
            unsyncedMemberUids: input.unsyncedMemberUids,
            scoreSnapshotRef,
          });
          return {
            ...resultFromRoom(input.roomId, input.requestId, {
              ...room,
              reconciliationStatus: 'FINALIZED',
              finalizationReason: 'HOST_OVERRIDE',
              pendingMemberCount: room.pendingMemberCount,
            }),
            finalizationReason: 'HOST_OVERRIDE',
            unsyncedMemberUids: input.unsyncedMemberUids,
            auditId: input.requestId,
            scoreSnapshotRef,
          };
        });
      } catch (error) {
        throw mapError(error);
      }
    },

    async completeRoom(input: { roomId: string; requestId: string }): Promise<RoomCompletionResult> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new RoomCompletionError('unauthenticated');
      if (!validRequestId(input.requestId) || !validRoomId(input.roomId)) throw new RoomCompletionError('invalid-argument');
      const roomRef = doc(dependencies.firestore, 'rooms', input.roomId);
      const memberRef = doc(dependencies.firestore, 'rooms', input.roomId, 'members', actor.uid);
      try {
        const outcome = await runTransaction(dependencies.firestore, async transaction => {
          const [roomSnapshot, memberSnapshot] = await Promise.all([
            transaction.get(roomRef), transaction.get(memberRef),
          ]);
          if (!roomSnapshot.exists() || !memberSnapshot.exists()) throw new RoomCompletionError('not-found');
          const room = roomSnapshot.data();
          const host = memberSnapshot.data();
          if (room.hostId !== actor.uid || host.role !== 'HOST' || host.status !== 'ACTIVE') {
            throw new RoomCompletionError('permission-denied');
          }
          if (room.status === 'COMPLETED' && room.completionRequestId === input.requestId) {
            return resultFromRoom(input.roomId, input.requestId, room);
          }
          if (room.status !== 'ACTIVE') throw new RoomCompletionError('failed-precondition');
          if (!Number.isInteger(room.participantCount) || room.participantCount < 1) {
            throw new RoomCompletionError('failed-precondition');
          }

          // Chốt giờ và roster bằng transaction; member EARLY_EXIT vẫn cần cơ hội gửi event đủ điều kiện.
          transaction.update(roomRef, {
            status: 'COMPLETED',
            endedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            reconciliationStatus: 'PENDING',
            pendingMemberCount: room.participantCount,
            completionRequestId: input.requestId,
            lastSyncAckMemberUid: null,
            lastSyncAckRequestId: null,
            finalizedAt: null,
            finalizedBy: null,
            finalizationReason: null,
          });
          return {
            version: 1 as const,
            roomId: input.roomId,
            requestId: input.requestId,
            status: 'COMPLETED' as const,
            endedAtUtcMs: null,
            reconciliationStatus: 'PENDING' as const,
            pendingMemberCount: room.participantCount,
            finalizationReason: null,
          };
        });
        return outcome;
      } catch (error) {
        throw mapError(error);
      }
    },

    async acknowledgeMemberSync(input: { roomId: string; requestId: string }): Promise<MemberSyncAcknowledgment> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new RoomCompletionError('unauthenticated');
      if (!validRequestId(input.requestId) || !validRoomId(input.roomId)) throw new RoomCompletionError('invalid-argument');
      const roomRef = doc(dependencies.firestore, 'rooms', input.roomId);
      const memberRef = doc(dependencies.firestore, 'rooms', input.roomId, 'members', actor.uid);
      try {
        return await runTransaction(dependencies.firestore, async transaction => {
          const [roomSnapshot, memberSnapshot] = await Promise.all([
            transaction.get(roomRef), transaction.get(memberRef),
          ]);
          if (!roomSnapshot.exists() || !memberSnapshot.exists()) throw new RoomCompletionError('not-found');
          const room = roomSnapshot.data();
          const member = memberSnapshot.data();
          if (room.status !== 'COMPLETED' || !['ACTIVE', 'EARLY_EXIT'].includes(String(member.status))
            || !(room.endedAt instanceof Timestamp) || !['PENDING', 'FINALIZED'].includes(String(room.reconciliationStatus))) {
            throw new RoomCompletionError('failed-precondition');
          }
          if (member.syncAcknowledgedAt instanceof Timestamp) {
            if (member.syncAckRequestId !== input.requestId) throw new RoomCompletionError('failed-precondition');
            return { ...resultFromRoom(input.roomId, input.requestId, room), memberUid: actor.uid };
          }
          if (room.reconciliationStatus !== 'PENDING' || !Number.isInteger(room.pendingMemberCount)
            || Number(room.pendingMemberCount) < 1) throw new RoomCompletionError('failed-precondition');

          const nextPendingCount = Number(room.pendingMemberCount) - 1;
          const final = nextPendingCount === 0;
          // ACK là attestation sau local outbox check; Rules ràng buộc ACK và giảm count trong cùng transaction.
          transaction.update(memberRef, {
            syncedThroughAt: room.endedAt,
            syncAcknowledgedAt: serverTimestamp(),
            syncAckRequestId: input.requestId,
          });
          transaction.update(roomRef, {
            pendingMemberCount: nextPendingCount,
            lastSyncAckMemberUid: actor.uid,
            lastSyncAckRequestId: input.requestId,
            ...(final ? {
              reconciliationStatus: 'FINALIZED',
              finalizationReason: 'ALL_SYNCED',
              finalizedAt: serverTimestamp(),
              finalizedBy: actor.uid,
            } : {}),
          });
          return {
            ...resultFromRoom(input.roomId, input.requestId, {
              ...room,
              pendingMemberCount: nextPendingCount,
              reconciliationStatus: final ? 'FINALIZED' : 'PENDING',
              finalizationReason: final ? 'ALL_SYNCED' : null,
            }),
            memberUid: actor.uid,
          };
        });
      } catch (error) {
        throw mapError(error);
      }
    },
  };
}
