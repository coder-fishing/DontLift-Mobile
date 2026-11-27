/** Đọc các trang lịch sử cá nhân và lịch sử nhóm được chia sẻ, đồng thời cập nhật cache cục bộ. */
import {
  collection,
  doc,
  documentId,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  Timestamp,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import {
  GROUP_HISTORY_PAGE_SIZE,
  GROUP_HISTORY_WINDOW_MS,
  mergeGroupHistory,
  readGroupSummary,
  summaryCursor,
  type GroupHistoryCursor,
  type GroupHistoryEntry,
} from "./group-history-model";
import {
  decodeSummary,
  isUnavailableRead,
  readIndexedRoomSummary,
  type GroupHistoryContext,
  type HistoryRow,
} from "./group-history-support";

export type GroupHistoryPage = {
  items: GroupHistoryEntry[];
  cursor: GroupHistoryCursor | null;
  hasMore: boolean;
  cloudError: boolean;
};

/** Tạo bộ đọc phân trang cho lịch sử cá nhân và lịch sử nhóm qua chỉ mục phòng. */
export function createGroupHistoryPageReader(context: GroupHistoryContext) {
  const { dependencies, database, isActor } = context;
  return {
    // Ghép summary cục bộ, lịch sử cá nhân trên cloud và các phòng trong chỉ mục.
    async readPage(
      uid: string,
      options: {
        cursor: GroupHistoryCursor | null;
        online: boolean;
        localPremium: boolean;
        serverPremium: boolean;
        nowUtcMs: number;
      },
    ): Promise<GroupHistoryPage> {
      if (!isActor(uid)) throw new Error("unauthenticated");
      const db = await database();
      const before =
        options.cursor?.completedAtUtcMs ?? Number.MAX_SAFE_INTEGER;
      const beforeId = options.cursor?.roomId ?? "\uffff";
      const cutoff = options.nowUtcMs - GROUP_HISTORY_WINDOW_MS;
      const localRows = await db.getAllAsync<HistoryRow>(
        `SELECT summary_json, sync_status FROM group_history WHERE actor_uid = ?
         AND ((? = 1 AND source = 'LOCAL') OR ? = 1 OR completed_at_utc_ms >= ? OR sync_status IN ('PENDING', 'FAILED'))
         AND (completed_at_utc_ms < ? OR (completed_at_utc_ms = ? AND room_id < ?))
         ORDER BY completed_at_utc_ms DESC, room_id DESC LIMIT ?`,
        uid,
        options.localPremium ? 1 : 0,
        options.serverPremium ? 1 : 0,
        cutoff,
        before,
        before,
        beforeId,
        GROUP_HISTORY_PAGE_SIZE + 1,
      );
      const local: GroupHistoryEntry[] = localRows.flatMap((row) => {
        const summary = decodeSummary(row.summary_json, uid);
        return summary
          ? [
              {
                summary,
                syncStatus: row.sync_status,
                source: "PERSONAL" as const,
              },
            ]
          : [];
      });
      const cachedRoomRows = await db.getAllAsync<{ summary_json: string }>(
        `SELECT summary_json FROM group_room_history_cache WHERE actor_uid = ?
         AND (? = 1 OR completed_at_utc_ms >= ?)
         AND (completed_at_utc_ms < ? OR (completed_at_utc_ms = ? AND room_id < ?))
         ORDER BY completed_at_utc_ms DESC, room_id DESC LIMIT ?`,
        uid,
        options.serverPremium ? 1 : 0,
        cutoff,
        before,
        before,
        beforeId,
        GROUP_HISTORY_PAGE_SIZE + 1,
      );
      const cachedRooms: GroupHistoryEntry[] = cachedRoomRows.flatMap((row) => {
        const summary = decodeSummary(row.summary_json, uid);
        return summary
          ? [{ summary, syncStatus: "SYNCED", source: "ROOM" as const }]
          : [];
      });
      let cloud: GroupHistoryEntry[] = [];
      let sharedRooms: GroupHistoryEntry[] = [];
      let cloudError = false;
      if (options.online) {
        try {
          const constraints = [
            orderBy("completedAtUtcMs", "desc"),
            orderBy(documentId(), "desc"),
          ];
          const ref = collection(
            dependencies.firestore,
            "users",
            uid,
            "groupHistory",
          );
          const result = await getDocsFromServer(
            query(
              ref,
              ...constraints,
              ...(options.cursor ? [startAfter(before, beforeId)] : []),
              limit(GROUP_HISTORY_PAGE_SIZE + 1),
            ),
          );
          if (!isActor(uid)) throw new Error("account-changed");
          cloud = result.docs.flatMap((d) => {
            const summary = readGroupSummary(d.data(), uid, d.id);
            return summary &&
              (options.serverPremium || summary.completedAtUtcMs >= cutoff)
              ? [
                  {
                    summary,
                    syncStatus: "SYNCED" as const,
                    source: "PERSONAL" as const,
                  },
                ]
              : [];
          });
          await db.withExclusiveTransactionAsync(async (tx) => {
            for (const entry of cloud)
              await tx.runAsync(
                `INSERT INTO group_history
              (actor_uid, room_id, completed_at_utc_ms, summary_json, sync_status, source) VALUES (?, ?, ?, ?, 'SYNCED', 'CLOUD')
              ON CONFLICT(actor_uid, room_id) DO UPDATE SET summary_json=excluded.summary_json, completed_at_utc_ms=excluded.completed_at_utc_ms
              WHERE group_history.source = 'CLOUD'`,
                uid,
                entry.summary.roomId,
                entry.summary.completedAtUtcMs,
                JSON.stringify(entry.summary),
              );
          });
        } catch {
          cloudError = true;
        }
        try {
          // Chỉ bổ sung chỉ mục cho các phòng thiết bị đã biết, không truy vấn toàn bộ phòng.
          const known = await db.getAllAsync<{
            room_id: string;
            joined_at: string;
          }>(
            `SELECT m.room_id, m.joined_at FROM room_members m WHERE m.uid = ? AND m.status IN ('ACTIVE', 'EARLY_EXIT')
             ORDER BY m.joined_at DESC`,
            uid,
          );
          for (const item of known) {
            if (!isActor(uid)) throw new Error("account-changed");
            if (!options.serverPremium && Date.parse(item.joined_at) < cutoff)
              continue;
            try {
              await runTransaction(dependencies.firestore, async (tx) => {
                const indexRef = doc(
                  dependencies.firestore,
                  "users",
                  uid,
                  "groupRooms",
                  item.room_id,
                );
                const memberRef = doc(
                  dependencies.firestore,
                  "rooms",
                  item.room_id,
                  "members",
                  uid,
                );
                const [index, member] = await Promise.all([
                  tx.get(indexRef),
                  tx.get(memberRef),
                ]);
                if (
                  index.exists() ||
                  !member.exists() ||
                  !["ACTIVE", "EARLY_EXIT"].includes(
                    String(member.data().status),
                  )
                )
                  return;
                const joinedAt = member.data().joinedAt;
                if (!(joinedAt instanceof Timestamp)) return;
                tx.set(indexRef, { roomId: item.room_id, joinedAt });
              });
            } catch (error) {
              if (isUnavailableRead(error)) cloudError = true;
            }
          }
          const indexCollection = collection(
            dependencies.firestore,
            "users",
            uid,
            "groupRooms",
          );
          const indexConstraints: QueryConstraint[] = [
            orderBy("joinedAt", "desc"),
          ];
          if (!options.serverPremium)
            indexConstraints.push(
              where("joinedAt", ">=", Timestamp.fromMillis(cutoff)),
            );
          const indexes = await getDocsFromServer(
            query(indexCollection, ...indexConstraints),
          );
          const indexData = indexes.docs.filter(
            (index) =>
              index.data().roomId === index.id &&
              index.data().joinedAt instanceof Timestamp &&
              (options.serverPremium ||
                index.data().joinedAt.toMillis() >= cutoff),
          );
          const fetched = await Promise.all(
            indexData.map(async (index) => {
              try {
                const entry = await readIndexedRoomSummary(
                  dependencies.firestore,
                  uid,
                  index.id,
                );
                return entry &&
                  (options.serverPremium ||
                    entry.summary.completedAtUtcMs >= cutoff) &&
                  (entry.summary.completedAtUtcMs < before ||
                    (entry.summary.completedAtUtcMs === before &&
                      entry.summary.roomId < beforeId))
                  ? entry
                  : null;
              } catch (error) {
                if (isUnavailableRead(error)) cloudError = true;
                return null;
              }
            }),
          );
          if (!isActor(uid)) throw new Error("account-changed");
          sharedRooms = fetched.filter(
            (entry): entry is GroupHistoryEntry => entry !== null,
          );
          await db.withExclusiveTransactionAsync(async (tx) => {
            for (const entry of sharedRooms)
              await tx.runAsync(
                `INSERT INTO group_room_history_cache
              (actor_uid, room_id, completed_at_utc_ms, summary_json) VALUES (?, ?, ?, ?)
              ON CONFLICT(actor_uid, room_id) DO UPDATE SET completed_at_utc_ms=excluded.completed_at_utc_ms,
                summary_json=excluded.summary_json`,
                uid,
                entry.summary.roomId,
                entry.summary.completedAtUtcMs,
                JSON.stringify(entry.summary),
              );
          });
        } catch (error) {
          if (!(error instanceof Error) || error.message !== "account-changed")
            cloudError = true;
          else throw error;
        }
      }
      const merged = mergeGroupHistory(
        [...local, ...cachedRooms],
        [...cloud, ...sharedRooms],
      );
      const items = merged.slice(0, GROUP_HISTORY_PAGE_SIZE);
      return {
        items,
        cursor: items.length
          ? summaryCursor(items[items.length - 1])
          : options.cursor,
        hasMore: merged.length > GROUP_HISTORY_PAGE_SIZE,
        cloudError,
      };
    },
  };
}
