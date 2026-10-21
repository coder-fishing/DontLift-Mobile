import type { Auth } from 'firebase/auth';
import { doc, runTransaction, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore';
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type { ActiveViolation } from '../solo/grace-period-engine';
import type { ViolationRecord, ViolationSummary } from '../solo/violation-repository';
import { getLocalDatabase } from '../local/database';

type Dependencies = { firestore: Firestore; auth: Auth; database?: () => Promise<SQLite.SQLiteDatabase>; createId?: () => string };
type PendingRow = { event_id: string; room_id: string; user_id: string; started_at: string; ended_at: string; duration_seconds: number };
type OpenViolationRow = {
  event_id: string;
  room_id: string;
  user_id: string;
  started_at: string;
  confirmed_at: string;
  created_at: string;
};

async function persistRoomViolationOutbox(
  transaction: SQLite.SQLiteDatabase,
  input: { eventId: string; roomId: string; userId: string; startedAtUtcMs: number; endedAtUtcMs: number; durationSeconds: number; createdAt: string },
) {
  const payload = JSON.stringify({
    startedAtUtcMs: input.startedAtUtcMs,
    endedAtUtcMs: input.endedAtUtcMs,
    durationSeconds: input.durationSeconds,
  });
  await transaction.runAsync(
    `INSERT INTO sync_outbox (event_id, event_type, schema_version, aggregate_type, aggregate_id, session_id, actor_uid, occurred_at_utc_ms, payload_json, sync_status, attempt_count, next_attempt_at, lease_expires_at, last_error_code, created_at, synced_at)
     VALUES (?, 'VIOLATION_RECORDED', 1, 'ROOM', ?, ?, ?, ?, ?, 'PENDING', 0, NULL, NULL, NULL, ?, NULL)
     ON CONFLICT(event_id) DO UPDATE SET
       occurred_at_utc_ms = excluded.occurred_at_utc_ms,
       payload_json = excluded.payload_json,
       sync_status = 'PENDING',
       attempt_count = 0,
       next_attempt_at = NULL,
       lease_expires_at = NULL,
       last_error_code = NULL,
       synced_at = NULL`,
    input.eventId, input.roomId, input.roomId, input.userId, input.endedAtUtcMs, payload, input.createdAt,
  );
}

export class GroupViolationError extends Error {
  constructor(public readonly code: 'unauthenticated' | 'invalid-argument' | 'failed-precondition' | 'unavailable' | 'permission-denied' | 'already-exists' | 'unknown') {
    super(code);
    this.name = 'GroupViolationError';
  }
}

function mapError(error: unknown): GroupViolationError {
  if (error instanceof GroupViolationError) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code).replace(/^firestore\//, '') : '';
  if (code === 'unauthenticated') return new GroupViolationError('unauthenticated');
  if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) return new GroupViolationError('unavailable');
  if (code === 'permission-denied') return new GroupViolationError('permission-denied');
  if (code === 'already-exists') return new GroupViolationError('already-exists');
  if (code === 'failed-precondition') return new GroupViolationError('failed-precondition');
  return new GroupViolationError('unknown');
}

export function createGroupViolationRepository(dependencies: Dependencies) {
  const database = dependencies.database ?? getLocalDatabase;
  const createId = dependencies.createId ?? Crypto.randomUUID;
  return {
    async start(input: { sessionId: string; userId: string; startedAtUtcMs: number; confirmedAtUtcMs: number }): Promise<ViolationRecord> {
      const actor = dependencies.auth.currentUser;
      if (!actor || actor.uid !== input.userId) throw new GroupViolationError('unauthenticated');
      const roomId = input.sessionId;
      const eventId = createId();
      const start = input.startedAtUtcMs;
      const end = Math.max(input.startedAtUtcMs + 3_000, input.confirmedAtUtcMs);
      const createdAt = new Date().toISOString();
      const durationSeconds = Math.floor((end - start) / 1_000);
      const db = await database();
      await db.withExclusiveTransactionAsync(async tx => {
        await tx.runAsync(
          `INSERT INTO violation_logs (event_id, session_id, room_id, user_id, started_at, confirmed_at, ended_at, duration_seconds, sync_status, created_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'PENDING', ?, NULL)`,
          eventId, roomId, roomId, actor.uid, new Date(start).toISOString(), new Date(end).toISOString(), durationSeconds, createdAt,
        );
        // Ghi outbox cùng violation ngay khi qua grace period để app bị đóng vẫn còn dấu chờ bền vững.
        await persistRoomViolationOutbox(tx, {
          eventId, roomId, userId: actor.uid, startedAtUtcMs: start,
          endedAtUtcMs: end, durationSeconds, createdAt,
        });
      });
      return { eventId, sessionId: roomId, startedAtUtcMs: start, endedAtUtcMs: null, durationSeconds };
    },
    async end(input: { eventId: string; endedAtUtcMs: number }): Promise<boolean> {
      const db = await database();
      let ended = false;
      await db.withExclusiveTransactionAsync(async tx => {
        const row = await tx.getFirstAsync<{ room_id: string; user_id: string; started_at: string; ended_at: string | null; created_at: string }>(
          'SELECT room_id, user_id, started_at, ended_at, created_at FROM violation_logs WHERE event_id = ?', input.eventId,
        );
        if (!row || row.ended_at !== null || !row.room_id) return;
        const startMs = Date.parse(row.started_at);
        const endMs = Math.max(startMs, input.endedAtUtcMs);
        const durationSeconds = Math.floor((endMs - startMs) / 1_000);
        const result = await tx.runAsync(
          'UPDATE violation_logs SET ended_at = ?, duration_seconds = ? WHERE event_id = ? AND ended_at IS NULL',
          new Date(endMs).toISOString(), durationSeconds, input.eventId,
        );
        if (result.changes !== 1) return;
        await persistRoomViolationOutbox(tx, {
          eventId: input.eventId, roomId: row.room_id, userId: row.user_id,
          startedAtUtcMs: startMs, endedAtUtcMs: endMs, durationSeconds,
          createdAt: row.created_at,
        });
        ended = true;
      });
      return ended;
    },
    async finalizeOpenAtRoomEnd(input: { roomId: string; userId: string; endedAtUtcMs: number }): Promise<number> {
      const actor = dependencies.auth.currentUser;
      if (!actor || actor.uid !== input.userId) throw new GroupViolationError('unauthenticated');
      if (!Number.isFinite(input.endedAtUtcMs)) throw new GroupViolationError('invalid-argument');
      const db = await database();
      let finalized = 0;
      await db.withExclusiveTransactionAsync(async tx => {
        const openRows = await tx.getAllAsync<OpenViolationRow>(
          `SELECT event_id, room_id, user_id, started_at, confirmed_at, created_at FROM violation_logs
           WHERE room_id = ? AND user_id = ? AND ended_at IS NULL AND confirmed_at IS NOT NULL`,
          input.roomId, actor.uid,
        );
        for (const row of openRows) {
          const startedAtUtcMs = Date.parse(row.started_at);
          const confirmedAtUtcMs = Date.parse(row.confirmed_at);
          if (!Number.isFinite(startedAtUtcMs) || !Number.isFinite(confirmedAtUtcMs)) continue;
          if (confirmedAtUtcMs > input.endedAtUtcMs
            || Math.floor((input.endedAtUtcMs - startedAtUtcMs) / 1_000) < 3) {
            // Grace chưa xong tại cutoff server: event chưa đủ điều kiện nên bỏ local log và outbox.
            await tx.runAsync(
              'DELETE FROM sync_outbox WHERE event_id = ? AND actor_uid = ? AND sync_status = \'PENDING\'',
              row.event_id, actor.uid,
            );
            await tx.runAsync(
              'DELETE FROM violation_logs WHERE event_id = ? AND user_id = ? AND ended_at IS NULL',
              row.event_id, actor.uid,
            );
            continue;
          }
          const endedAtUtcMs = Math.max(startedAtUtcMs, input.endedAtUtcMs);
          const durationSeconds = Math.floor((endedAtUtcMs - startedAtUtcMs) / 1_000);
          const result = await tx.runAsync(
            `UPDATE violation_logs SET ended_at = ?, duration_seconds = ?
             WHERE event_id = ? AND user_id = ? AND ended_at IS NULL`,
            new Date(endedAtUtcMs).toISOString(), durationSeconds, row.event_id, actor.uid,
          );
          if (result.changes !== 1) continue;
          await persistRoomViolationOutbox(tx, {
            eventId: row.event_id, roomId: row.room_id, userId: actor.uid,
            startedAtUtcMs, endedAtUtcMs, durationSeconds, createdAt: row.created_at,
          });
          finalized += 1;
        }
      });
      return finalized;
    },
    async getSummary(roomId: string): Promise<ViolationSummary> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new GroupViolationError('unauthenticated');
      const row = await (await database()).getFirstAsync<{ count: number; duration_seconds: number | null }>(
        'SELECT COUNT(*) AS count, COALESCE(SUM(duration_seconds), 0) AS duration_seconds FROM violation_logs WHERE session_id = ? AND room_id = ? AND user_id = ?', roomId, roomId, actor.uid,
      );
      return { count: row?.count ?? 0, durationSeconds: row?.duration_seconds ?? 0 };
    },
    async getActive(input: { sessionId: string; userId: string }): Promise<ActiveViolation | null> {
      const row = await (await database()).getFirstAsync<{ event_id: string; started_at: string; confirmed_at: string | null }>(
        'SELECT event_id, started_at, confirmed_at FROM violation_logs WHERE session_id = ? AND room_id = ? AND user_id = ? AND ended_at IS NULL ORDER BY started_at LIMIT 1',
        input.sessionId, input.sessionId, input.userId,
      );
      return row?.confirmed_at ? { eventId: row.event_id, startedAtUtcMs: Date.parse(row.started_at), confirmedAtUtcMs: Date.parse(row.confirmed_at) } : null;
    },
    async syncPending(roomId: string): Promise<void> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new GroupViolationError('unauthenticated');
      const db = await database();
      const rows = await db.getAllAsync<PendingRow>(
        `SELECT v.event_id, v.room_id, v.user_id, v.started_at, v.ended_at, v.duration_seconds, v.created_at
         FROM violation_logs v JOIN sync_outbox o ON o.event_id = v.event_id
         WHERE v.room_id = ? AND v.user_id = ? AND v.ended_at IS NOT NULL AND o.sync_status = 'PENDING'
         ORDER BY v.started_at ASC`, roomId, actor.uid,
      );
      const markFailed = async (row: PendingRow, errorCode: string) => {
        await db.withExclusiveTransactionAsync(async tx => {
          await tx.runAsync(
            `UPDATE sync_outbox SET sync_status = 'FAILED', last_error_code = ?,
               lease_expires_at = NULL, next_attempt_at = NULL
             WHERE event_id = ? AND actor_uid = ? AND sync_status = 'PENDING'`,
            errorCode, row.event_id, actor.uid,
          );
          await tx.runAsync(
            `UPDATE violation_logs SET sync_status = 'FAILED'
             WHERE event_id = ? AND user_id = ? AND sync_status = 'PENDING'`,
            row.event_id, actor.uid,
          );
        });
      };
      for (const row of rows) {
        const startedAt = Date.parse(row.started_at);
        const endedAt = Date.parse(row.ended_at);
        const durationSeconds = Math.floor((endedAt - startedAt) / 1_000);
        if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || durationSeconds !== row.duration_seconds) {
          await markFailed(row, 'invalid-argument');
          continue;
        }
        const eventRef = doc(dependencies.firestore, 'rooms', roomId, 'violations', row.event_id);
        const roomRef = doc(dependencies.firestore, 'rooms', roomId);
        const memberRef = doc(dependencies.firestore, 'rooms', roomId, 'members', actor.uid);
        try {
          await runTransaction(dependencies.firestore, async tx => {
            const [room, member] = await Promise.all([tx.get(roomRef), tx.get(memberRef)]);
            const roomData = room.data();
            const memberData = member.data();
            const canReconcileCompletedRoom = roomData?.status === 'COMPLETED'
              && roomData.reconciliationStatus === 'PENDING'
              && memberData?.syncAcknowledgedAt == null;
            if (!room.exists() || !roomData || (roomData.status !== 'ACTIVE' && !canReconcileCompletedRoom) || !member.exists()
              || !['ACTIVE', 'EARLY_EXIT'].includes(String(member.data().status))) {
              throw new GroupViolationError('failed-precondition');
            }
            // Sau completion chỉ flush event trước endedAt và trước ACK của chính member.
            const existing = await tx.get(eventRef);
            if (existing.exists()) {
              const saved = existing.data();
              if (saved.actorUid !== actor.uid || !(saved.startedAt instanceof Timestamp) || !(saved.endedAt instanceof Timestamp)
                || saved.startedAt.toMillis() !== startedAt || saved.endedAt.toMillis() !== endedAt || saved.durationSeconds !== durationSeconds) {
                throw new GroupViolationError('already-exists');
              }
              return;
            }
            const memberValues = member.data();
            if (memberValues.status === 'EARLY_EXIT'
              && (!(memberValues.earlyExitAt instanceof Timestamp) || endedAt > memberValues.earlyExitAt.toMillis())) {
              // Event kết thúc sau cutoff không được tính; giữ log cục bộ nhưng không retry vô hạn.
              throw new GroupViolationError('invalid-argument');
            }
            const serverStartedAt = room.data().startedAt;
            if (!(serverStartedAt instanceof Timestamp) || startedAt < serverStartedAt.toMillis()) {
              // Event xảy ra trước mốc room phía server sẽ không hợp lệ cả trong reconciliation.
              throw new GroupViolationError('invalid-argument');
            }
            if (roomData.status === 'COMPLETED'
              && (!(roomData.endedAt instanceof Timestamp) || endedAt > roomData.endedAt.toMillis())) {
              throw new GroupViolationError('invalid-argument');
            }
            tx.set(eventRef, {
              eventId: row.event_id, actorUid: actor.uid, startedAt: Timestamp.fromMillis(startedAt),
              endedAt: Timestamp.fromMillis(endedAt), durationSeconds, createdAt: serverTimestamp(),
            });
            tx.update(memberRef, {
              liftCount: Number(member.data().liftCount) + 1,
              violationDurationSeconds: Number(member.data().violationDurationSeconds) + durationSeconds,
              penaltyScore: Number(member.data().penaltyScore) + 10 + durationSeconds,
              lastViolationEventId: row.event_id,
            });
          });
          await db.withExclusiveTransactionAsync(async tx => {
            await tx.runAsync("UPDATE sync_outbox SET sync_status = 'SYNCED', synced_at = ?, lease_expires_at = NULL WHERE event_id = ? AND actor_uid = ?", new Date().toISOString(), row.event_id, actor.uid);
            await tx.runAsync("UPDATE violation_logs SET sync_status = 'SYNCED', synced_at = ? WHERE event_id = ? AND user_id = ?", new Date().toISOString(), row.event_id, actor.uid);
          });
        } catch (error) {
          const mapped = mapError(error);
          if (['invalid-argument', 'already-exists'].includes(mapped.code)) {
            // Event bị từ chối vĩnh viễn không được chặn các event hợp lệ phía sau; bản ghi local vẫn được giữ.
            await markFailed(row, mapped.code);
            continue;
          }
          if (mapped.code === 'permission-denied') {
            // Rules có thể chưa được deploy; giữ PENDING để không mất cơ hội retry sau khi cấu hình được sửa.
            continue;
          }
          // failed-precondition giữ nguyên PENDING cho reconciliation; lỗi tạm thời dừng retry để tránh lặp vô ích.
          throw mapped;
        }
      }
    },
    async getPendingCount(roomId: string): Promise<number> {
      const actor = dependencies.auth.currentUser;
      if (!actor) return 0;
      const result = await (await database()).getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM sync_outbox
         WHERE aggregate_id = ? AND aggregate_type = 'ROOM' AND actor_uid = ? AND sync_status = 'PENDING'`, roomId, actor.uid,
      );
      return result?.count ?? 0;
    },
    async getFailedCount(roomId: string): Promise<number> {
      const actor = dependencies.auth.currentUser;
      if (!actor) return 0;
      const result = await (await database()).getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM sync_outbox
         WHERE aggregate_id = ? AND aggregate_type = 'ROOM' AND actor_uid = ? AND sync_status = 'FAILED'`, roomId, actor.uid,
      );
      return result?.count ?? 0;
    },
  };
}
