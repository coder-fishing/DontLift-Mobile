import {
  collection, doc, documentId, getDocFromServer, getDocsFromServer, limit, orderBy,
  query, startAfter, Timestamp, where, type QueryConstraint,
} from 'firebase/firestore';
import type * as SQLite from 'expo-sqlite';
import type { FirebaseRuntime } from '../auth/firebase-adapters';
import { getLocalDatabase } from '../local/database';
import { getCompletedSoloSessionSummary } from '../solo/summary-service';
import type { HistoryRepository } from './history-controller';
import {
  FREE_HISTORY_WINDOW_MS, HISTORY_PAGE_SIZE, mergeHistoryEntries, readCloudHistoryEntry,
  type HistoryContext, type HistoryCursor, type HistoryPage, type SoloHistoryEntry,
} from './history-model';

type CachedSummaryRow = {
  session_id: string; user_id: string; duration_seconds: number; lift_count: number;
  violation_duration_seconds: number; penalty_score: number; started_at: string; completed_at: string;
};
const cursorOf = (item: SoloHistoryEntry): HistoryCursor => ({ completedAt: item.completedAt, sessionId: item.sessionId });

export async function readLocalHistoryPage(
  database: SQLite.SQLiteDatabase, cursor: HistoryCursor | null, context: HistoryContext,
): Promise<HistoryPage> {
  const cutoff = new Date(context.nowUtcMs - FREE_HISTORY_WINDOW_MS).toISOString();
  const before = cursor ? cursor.completedAt : '9999-12-31T23:59:59.999Z';
  const beforeId = cursor?.sessionId ?? '\uffff';
  const sessions = await database.getAllAsync<{ id: string; completed_at: string; sync_status: string | null }>(
    `SELECT s.id, s.completed_at, o.sync_status
     FROM sessions s LEFT JOIN sync_outbox o
       ON o.event_id = s.id AND o.actor_uid = s.user_id AND o.event_type = 'SOLO_SESSION_COMPLETED'
     WHERE s.user_id = ? AND s.status = 'COMPLETED' AND s.mode IN ('COUNTDOWN', 'STOPWATCH')
       AND (? = 1 OR s.completed_at >= ? OR o.sync_status IN ('PENDING', 'FAILED'))
       AND (s.completed_at < ? OR (s.completed_at = ? AND s.id < ?))
     ORDER BY s.completed_at DESC, s.id DESC LIMIT ?`,
    context.userId, context.localPremium ? 1 : 0, cutoff, before, before, beforeId, HISTORY_PAGE_SIZE + 1,
  );
  const cached = await database.getAllAsync<CachedSummaryRow>(
    `SELECT * FROM solo_history_cache WHERE user_id = ? AND (? = 1 OR completed_at >= ?)
       AND (completed_at < ? OR (completed_at = ? AND session_id < ?))
     ORDER BY completed_at DESC, session_id DESC LIMIT ?`,
    context.userId, context.serverPremium ? 1 : 0, cutoff, before, before, beforeId, HISTORY_PAGE_SIZE + 1,
  );
  const local: SoloHistoryEntry[] = [];
  for (const row of sessions) {
    const summary = await getCompletedSoloSessionSummary(database, { userId: context.userId, sessionId: row.id });
    if (summary) local.push({ ...summary, syncStatus: row.sync_status === 'SYNCED' ? 'synced' : row.sync_status === 'FAILED' ? 'failed' : 'pending' });
  }
  const cloud: SoloHistoryEntry[] = cached.map(row => ({
    sessionId: row.session_id, userId: row.user_id, mode: null, durationSeconds: row.duration_seconds,
    liftCount: row.lift_count, violationDurationSeconds: row.violation_duration_seconds, penaltyScore: row.penalty_score,
    startedAt: row.started_at, completedAt: row.completed_at, syncStatus: 'synced',
  }));
  const merged = mergeHistoryEntries(local, cloud);
  const items = merged.slice(0, HISTORY_PAGE_SIZE);
  return { items, cursor: items.length ? cursorOf(items[items.length - 1]) : cursor, hasMore: merged.length > HISTORY_PAGE_SIZE };
}

export async function cacheCloudHistory(database: SQLite.SQLiteDatabase, entries: SoloHistoryEntry[]): Promise<void> {
  await database.withExclusiveTransactionAsync(async transaction => {
    for (const item of entries) {
      await transaction.runAsync(
        `INSERT INTO solo_history_cache
          (user_id, session_id, duration_seconds, lift_count, violation_duration_seconds, penalty_score, started_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, session_id) DO UPDATE SET
           duration_seconds = excluded.duration_seconds, lift_count = excluded.lift_count,
           violation_duration_seconds = excluded.violation_duration_seconds, penalty_score = excluded.penalty_score,
           started_at = excluded.started_at, completed_at = excluded.completed_at`,
        item.userId, item.sessionId, item.durationSeconds, item.liftCount, item.violationDurationSeconds,
        item.penaltyScore, item.startedAt, item.completedAt,
      );
    }
  });
}

export function createSoloHistoryRepository(runtime: FirebaseRuntime): HistoryRepository {
  let verifiedServerPremium = false;
  const assertOwner = (userId: string) => {
    if (runtime.auth.currentUser?.uid !== userId) throw new Error('The history account changed.');
  };
  return {
    async readLocalPage(cursor, context) {
      assertOwner(context.userId);
      return readLocalHistoryPage(await getLocalDatabase(), cursor, context);
    },
    async readCloudPage(cursor, context) {
      assertOwner(context.userId);
      if (!cursor) {
        // Chỉ profile từ server cấp quyền giữ cloud history lâu dài; Local Premium không cấp quyền này.
        const profile = await getDocFromServer(doc(runtime.firestore, 'users', context.userId));
        assertOwner(context.userId);
        verifiedServerPremium = profile.exists() && profile.data().isPremium === true;
      }
      const constraints: QueryConstraint[] = [orderBy('completedAt', 'desc'), orderBy(documentId(), 'desc')];
      if (!verifiedServerPremium) constraints.push(where('completedAt', '>=', Timestamp.fromMillis(context.nowUtcMs - FREE_HISTORY_WINDOW_MS)));
      if (cursor) constraints.push(startAfter(Timestamp.fromMillis(Date.parse(cursor.completedAt)), cursor.sessionId));
      constraints.push(limit(HISTORY_PAGE_SIZE));
      const snapshot = await getDocsFromServer(query(collection(runtime.firestore, 'users', context.userId, 'sessions'), ...constraints));
      assertOwner(context.userId);
      const items = snapshot.docs.map(item => readCloudHistoryEntry(context.userId, item.id, item.data()))
        .filter((item): item is SoloHistoryEntry => item !== null);
      await cacheCloudHistory(await getLocalDatabase(), items);
      assertOwner(context.userId);
      const last = snapshot.docs.at(-1);
      const completedAt = last?.data().completedAt;
      const nextCursor = last && completedAt instanceof Timestamp
        ? { completedAt: completedAt.toDate().toISOString(), sessionId: last.id } : cursor;
      return { items, cursor: nextCursor, hasMore: snapshot.size === HISTORY_PAGE_SIZE && nextCursor !== null };
    },
  };
}
