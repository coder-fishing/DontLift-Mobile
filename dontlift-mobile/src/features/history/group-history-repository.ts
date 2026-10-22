import { collection, doc, documentId, getDocFromServer, getDocsFromServer, limit, orderBy, query,
  runTransaction, serverTimestamp, startAfter, where, type Firestore } from 'firebase/firestore';
import type * as SQLite from 'expo-sqlite';
import type { Auth } from 'firebase/auth';
import { getLocalDatabase } from '../local/database';
import { recoverGroupSummaries } from './group-summary-repository';
import { GROUP_HISTORY_PAGE_SIZE, GROUP_HISTORY_WINDOW_MS, mergeGroupHistory, readGroupSummary, summaryCursor,
  type GroupHistoryCursor, type GroupHistoryEntry, type GroupLocalSummary } from './group-history-model';
import { createBillRepository, type PublishedBill } from '../settlement/bill-repository';
import { listenToHistoryPayment, type HistoryPaymentState } from './group-history-payment';

export type GroupHistoryDetail = {
  roomStatus: string; reconciliation: string | null; finalizationReason: string | null;
  members: { uid: string; name: string; status: string; score: number }[];
  excludedCount: number; excludedHasMore: boolean; bill: PublishedBill | null; billError: boolean;
};
type HistoryRow = { summary_json: string; sync_status: 'PENDING' | 'SYNCED' | 'FAILED' };
function decodeSummary(json: string, uid: string, roomId?: string): GroupLocalSummary | null {
  try { return readGroupSummary(JSON.parse(json), uid, roomId); } catch { return null; }
}
export type GroupHistoryPage = { items: GroupHistoryEntry[]; cursor: GroupHistoryCursor | null; hasMore: boolean; cloudError: boolean };
export function sameGroupSummary(a: GroupLocalSummary, b: GroupLocalSummary): boolean {
  return Object.keys(a).filter(key => key !== 'uploadedAt').every(key => a[key as keyof GroupLocalSummary] === b[key as keyof GroupLocalSummary]);
}
export function createGroupHistoryRepository(dependencies: {
  firestore: Firestore; auth: Auth; database?: Promise<SQLite.SQLiteDatabase>;
}) {
  const database = () => dependencies.database ?? getLocalDatabase();
  const isActor = (uid: string) => dependencies.auth.currentUser?.uid === uid;
  let running: { uid: string; task: Promise<void> } | null = null;
  const repository = {
    listenPayment(uid: string, roomId: string, onState: (state: HistoryPaymentState) => void): () => void {
      return listenToHistoryPayment(dependencies, uid, roomId, onState);
    },
    async recoverLocal(uid: string): Promise<void> {
      if (isActor(uid)) await recoverGroupSummaries(await database(), uid);
    },
    async syncPending(uid: string, retryFailed = false): Promise<void> {
      if (!isActor(uid)) return;
      if (running?.uid === uid) return running.task;
      const task = (async () => {
        const db = await database();
        if (!isActor(uid)) return;
        await recoverGroupSummaries(db, uid);
        let afterId = '';
        for (;;) {
          if (!isActor(uid)) return;
          const rows = await db.getAllAsync<{ event_id: string; aggregate_id: string; payload_json: string }>(
            `SELECT event_id, aggregate_id, payload_json FROM sync_outbox
             WHERE actor_uid = ? AND event_type = 'GROUP_SESSION_LOCAL_SUMMARY'
               AND (sync_status = 'PENDING' OR (? = 1 AND sync_status = 'FAILED')) AND event_id > ?
             ORDER BY event_id LIMIT 20`, uid, retryFailed ? 1 : 0, afterId);
          if (!rows.length) break;
          for (const row of rows) {
            afterId = row.event_id;
            if (!isActor(uid)) return;
            try {
              const summary = decodeSummary(row.payload_json, uid, row.aggregate_id);
              if (!summary || summary.eventId !== row.event_id) throw new Error('invalid-argument');
              const ref = doc(dependencies.firestore, 'users', uid, 'groupHistory', summary.roomId);
              await runTransaction(dependencies.firestore, async tx => {
                if (!isActor(uid)) throw new Error('account-changed');
                const saved = await tx.get(ref);
                if (saved.exists()) {
                  const previous = readGroupSummary(saved.data(), uid, summary.roomId);
                  if (!previous || !sameGroupSummary(summary, previous)) throw new Error('already-exists');
                  return;
                }
                tx.set(ref, { ...summary, uploadedAt: serverTimestamp() });
              });
              await db.withExclusiveTransactionAsync(async tx => {
                await tx.runAsync("UPDATE sync_outbox SET sync_status = 'SYNCED', synced_at = ?, last_error_code = NULL WHERE event_id = ? AND actor_uid = ? AND event_type = 'GROUP_SESSION_LOCAL_SUMMARY'",
                  new Date().toISOString(), row.event_id, uid);
                await tx.runAsync("UPDATE group_history SET sync_status = 'SYNCED' WHERE actor_uid = ? AND room_id = ?", uid, row.aggregate_id);
              });
            } catch (error) {
              const code = error instanceof Error ? ('code' in error ? String(error.code).replace(/^firestore\//, '') : error.message) : 'unavailable';
              if (code === 'account-changed' || !isActor(uid)) return;
              const permanent = ['permission-denied', 'invalid-argument', 'already-exists'].includes(code);
              await db.withExclusiveTransactionAsync(async tx => {
                await tx.runAsync(`UPDATE sync_outbox SET sync_status = ?, attempt_count = attempt_count + 1, last_error_code = ?
                  WHERE event_id = ? AND actor_uid = ? AND event_type = 'GROUP_SESSION_LOCAL_SUMMARY'`,
                  permanent ? 'FAILED' : 'PENDING', code, row.event_id, uid);
                await tx.runAsync('UPDATE group_history SET sync_status = ? WHERE actor_uid = ? AND room_id = ?',
                  permanent ? 'FAILED' : 'PENDING', uid, row.aggregate_id);
              });
            }
          }
        }
      })();
      running = { uid, task };
      try { await task; } finally { if (running?.task === task) running = null; }
    },
    async readPage(uid: string, options: { cursor: GroupHistoryCursor | null; online: boolean;
      localPremium: boolean; serverPremium: boolean; nowUtcMs: number }): Promise<GroupHistoryPage> {
      if (!isActor(uid)) throw new Error('unauthenticated');
      const db = await database();
      const before = options.cursor?.completedAtUtcMs ?? Number.MAX_SAFE_INTEGER;
      const beforeId = options.cursor?.roomId ?? '\uffff';
      const cutoff = options.nowUtcMs - GROUP_HISTORY_WINDOW_MS;
      const localRows = await db.getAllAsync<HistoryRow>(
        `SELECT summary_json, sync_status FROM group_history WHERE actor_uid = ?
         AND ((? = 1 AND source = 'LOCAL') OR ? = 1 OR completed_at_utc_ms >= ? OR sync_status IN ('PENDING', 'FAILED'))
         AND (completed_at_utc_ms < ? OR (completed_at_utc_ms = ? AND room_id < ?))
         ORDER BY completed_at_utc_ms DESC, room_id DESC LIMIT ?`,
        uid, options.localPremium ? 1 : 0, options.serverPremium ? 1 : 0, cutoff, before, before, beforeId, GROUP_HISTORY_PAGE_SIZE + 1);
      const local: GroupHistoryEntry[] = localRows.flatMap(row => {
        const summary = decodeSummary(row.summary_json, uid);
        return summary ? [{ summary, syncStatus: row.sync_status }] : [];
      });
      let cloud: GroupHistoryEntry[] = [];
      let cloudError = false;
      if (options.online) {
        try {
          const constraints = [orderBy('completedAtUtcMs', 'desc'), orderBy(documentId(), 'desc')];
          const ref = collection(dependencies.firestore, 'users', uid, 'groupHistory');
          const result = await getDocsFromServer(query(ref, ...constraints,
            ...(options.cursor ? [startAfter(before, beforeId)] : []), limit(GROUP_HISTORY_PAGE_SIZE + 1)));
          if (!isActor(uid)) throw new Error('account-changed');
          cloud = result.docs.flatMap(d => {
            const summary = readGroupSummary(d.data(), uid, d.id);
            return summary && (options.serverPremium || summary.completedAtUtcMs >= cutoff) ? [{ summary, syncStatus: 'SYNCED' as const }] : [];
          });
          await db.withExclusiveTransactionAsync(async tx => {
            for (const entry of cloud) await tx.runAsync(`INSERT INTO group_history
              (actor_uid, room_id, completed_at_utc_ms, summary_json, sync_status, source) VALUES (?, ?, ?, ?, 'SYNCED', 'CLOUD')
              ON CONFLICT(actor_uid, room_id) DO NOTHING`, uid, entry.summary.roomId, entry.summary.completedAtUtcMs, JSON.stringify(entry.summary));
          });
        } catch { cloudError = true; }
      }
      const merged = mergeGroupHistory(local, cloud);
      const items = merged.slice(0, GROUP_HISTORY_PAGE_SIZE);
      return { items, cursor: items.length ? summaryCursor(items[items.length - 1]) : options.cursor,
        hasMore: merged.length > GROUP_HISTORY_PAGE_SIZE, cloudError };
    },
    async readEntry(uid: string, roomId: string): Promise<GroupHistoryEntry | null> {
      if (!isActor(uid)) return null;
      const row = await (await database()).getFirstAsync<HistoryRow>(
        'SELECT summary_json, sync_status FROM group_history WHERE actor_uid = ? AND room_id = ?', uid, roomId);
      const summary = row ? decodeSummary(row.summary_json, uid, roomId) : null;
      return summary && row ? { summary, syncStatus: row.sync_status } : null;
    },
    async readDetail(uid: string, roomId: string): Promise<GroupHistoryDetail> {
      if (!isActor(uid)) throw new Error('unauthenticated');
      const db = dependencies.firestore;
      const own = await getDocFromServer(doc(db, 'rooms', roomId, 'members', uid));
      if (!own.exists() || !['ACTIVE', 'EARLY_EXIT'].includes(own.data().status)) throw new Error('permission-denied');
      const [room, members] = await Promise.all([
        getDocFromServer(doc(db, 'rooms', roomId)), getDocsFromServer(collection(db, 'rooms', roomId, 'members')),
      ]);
      if (!isActor(uid) || !room.exists()) throw new Error('unavailable');
      const data = room.data();
      const excluded = ['ACTIVE', 'COMPLETED'].includes(data.status)
        ? await getDocsFromServer(query(collection(db, 'rooms', roomId, 'violations'),
          where('excludedFromFinalScore', '==', true), limit(101))) : null;
      let bill: PublishedBill | null = null;
      let billError = false;
      if (data.calculationVersion === 1) {
        try { bill = await createBillRepository(dependencies).readPublished(roomId); } catch { billError = true; }
      }
      const detail: GroupHistoryDetail = { roomStatus: data.status, reconciliation: data.reconciliationStatus ?? null,
        finalizationReason: data.finalizationReason ?? null, members: members.docs.map(m => ({ uid: m.id,
          name: m.data().displayName, status: m.data().status, score: m.data().penaltyScore })),
        excludedCount: Math.min(excluded?.size ?? 0, 100),
        excludedHasMore: (excluded?.size ?? 0) > 100, bill, billError };
      const local = await database();
      if (!isActor(uid)) throw new Error('account-changed');
      await local.runAsync('UPDATE group_history SET detail_json = ? WHERE actor_uid = ? AND room_id = ?', JSON.stringify(detail), uid, roomId);
      return detail;
    },
    async cachedDetail(uid: string, roomId: string): Promise<GroupHistoryDetail | null> {
      if (!isActor(uid)) return null;
      const row = await (await database()).getFirstAsync<{ detail_json: string | null }>(
        'SELECT detail_json FROM group_history WHERE actor_uid = ? AND room_id = ?', uid, roomId);
      return row?.detail_json ? JSON.parse(row.detail_json) as GroupHistoryDetail : null;
    },
  };
  return repository;
}
export type GroupHistoryRepository = ReturnType<typeof createGroupHistoryRepository>;
