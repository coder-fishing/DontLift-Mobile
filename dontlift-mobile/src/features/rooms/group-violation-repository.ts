import type { Auth } from 'firebase/auth';
import { doc, runTransaction, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore';
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type { ActiveViolation } from '../solo/grace-period-engine';
import type { ViolationRecord, ViolationSummary } from '../solo/violation-repository';
import { getLocalDatabase } from '../local/database';

type Dependencies = { firestore: Firestore; auth: Auth; database?: () => Promise<SQLite.SQLiteDatabase>; createId?: () => string };
type PendingRow = { event_id: string; room_id: string; user_id: string; started_at: string; ended_at: string; duration_seconds: number };

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
      });
      return { eventId, sessionId: roomId, startedAtUtcMs: start, endedAtUtcMs: null, durationSeconds };
    },
    async end(input: { eventId: string; endedAtUtcMs: number }): Promise<boolean> {
      const db = await database();
      let ended = false;
      await db.withExclusiveTransactionAsync(async tx => {
        const row = await tx.getFirstAsync<{ room_id: string; user_id: string; started_at: string; ended_at: string | null }>(
          'SELECT room_id, user_id, started_at, ended_at FROM violation_logs WHERE event_id = ?', input.eventId,
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
        const event = { startedAtUtcMs: startMs, endedAtUtcMs: endMs, durationSeconds };
        await tx.runAsync(
          `INSERT OR REPLACE INTO sync_outbox (event_id, event_type, schema_version, aggregate_type, aggregate_id, session_id, actor_uid, occurred_at_utc_ms, payload_json, sync_status, attempt_count, next_attempt_at, lease_expires_at, last_error_code, created_at, synced_at)
           VALUES (?, 'VIOLATION_RECORDED', 1, 'ROOM', ?, ?, ?, ?, ?, 'PENDING', 0, NULL, NULL, NULL, ?, NULL)`,
          input.eventId, row.room_id, row.room_id, row.user_id, endMs, JSON.stringify(event), new Date().toISOString(),
        );
        ended = true;
      });
      return ended;
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
      for (const row of rows) {
        const startedAt = Date.parse(row.started_at);
        const endedAt = Date.parse(row.ended_at);
        const durationSeconds = Math.floor((endedAt - startedAt) / 1_000);
        if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || durationSeconds !== row.duration_seconds) {
          throw new GroupViolationError('invalid-argument');
        }
        const eventRef = doc(dependencies.firestore, 'rooms', roomId, 'violations', row.event_id);
        const roomRef = doc(dependencies.firestore, 'rooms', roomId);
        const memberRef = doc(dependencies.firestore, 'rooms', roomId, 'members', actor.uid);
        try {
          await runTransaction(dependencies.firestore, async tx => {
            const [room, member, existing] = await Promise.all([tx.get(roomRef), tx.get(memberRef), tx.get(eventRef)]);
            if (existing.exists()) {
              const saved = existing.data();
              if (saved.actorUid !== actor.uid || !(saved.startedAt instanceof Timestamp) || !(saved.endedAt instanceof Timestamp)
                || saved.startedAt.toMillis() !== startedAt || saved.endedAt.toMillis() !== endedAt || saved.durationSeconds !== durationSeconds) {
                throw new GroupViolationError('already-exists');
              }
              return;
            }
            if (!room.exists() || room.data().status !== 'ACTIVE' || !member.exists() || member.data().status !== 'ACTIVE') {
              throw new GroupViolationError('failed-precondition');
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
          throw mapError(error);
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
  };
}
