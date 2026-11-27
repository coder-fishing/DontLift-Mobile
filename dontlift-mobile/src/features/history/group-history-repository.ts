/** Kết hợp các luồng đọc và đồng bộ thành API lịch sử nhóm dùng chung. */
import { getLocalDatabase } from "../local/database";
import { recoverGroupSummaries } from "./group-summary-repository";
import type { GroupHistoryEntry } from "./group-history-model";
import { listenToHistoryPayment, type HistoryPaymentState } from "./group-history-payment";
import { createGroupActionableHistory } from "./group-actionable-history";
import { createGroupHistoryDetailReader } from "./group-history-detail";
import { createGroupHistoryPageReader } from "./group-history-page";
import { createGroupHistorySync } from "./group-history-sync";
import { decodeSummary, type GroupHistoryContext, type GroupHistoryDependencies, type HistoryRow } from "./group-history-support";

export type { GroupHistoryDependencies } from "./group-history-support";
export type { GroupHistoryDetail, GroupRoomRosterPreview } from "./group-history-detail";
export type { GroupActionableKind, GroupActionableSession, GroupActionableCursor, GroupActionablePage } from "./group-actionable-history";
export { GROUP_ACTIONABLE_PAGE_SIZE, deriveGroupActionableSession, sortGroupActionableSessions } from "./group-actionable-history";
export type { GroupHistoryPage } from "./group-history-page";
export { canCorrectGroupSummary, sameGroupSummary } from "./group-history-sync";

export function createGroupHistoryRepository(dependencies: GroupHistoryDependencies) {
  const database = () => dependencies.database ?? getLocalDatabase();
  const isActor = (uid: string) => dependencies.auth.currentUser?.uid === uid;
  const context: GroupHistoryContext = { dependencies, database, isActor };
  const sync = createGroupHistorySync(context);
  const pages = createGroupHistoryPageReader(context);
  const actionable = createGroupActionableHistory(context);
  const details = createGroupHistoryDetailReader(context);

  return {
    // Theo dõi trạng thái hóa đơn cho một phiên đang xem trong lịch sử.
    listenPayment(
      uid: string,
      roomId: string,
      onState: (state: HistoryPaymentState) => void,
    ): () => void {
      return listenToHistoryPayment(dependencies, uid, roomId, onState);
    },
    // Khôi phục summary cục bộ trước các lần đồng bộ tiếp theo.
    async recoverLocal(uid: string): Promise<void> {
      if (isActor(uid)) await recoverGroupSummaries(await database(), uid);
    },
    ...sync,
    ...pages,
    ...actionable,
    // Tìm summary cá nhân trước, sau đó dùng bản cache lịch sử phòng nếu cần.
    async readEntry(uid: string, roomId: string): Promise<GroupHistoryEntry | null> {
      if (!isActor(uid)) return null;
      const db = await database();
      const row = await db.getFirstAsync<HistoryRow>(
        "SELECT summary_json, sync_status FROM group_history WHERE actor_uid = ? AND room_id = ?",
        uid,
        roomId,
      );
      const summary = row ? decodeSummary(row.summary_json, uid, roomId) : null;
      if (summary && row)
        return { summary, syncStatus: row.sync_status, source: "PERSONAL" };
      const shared = await db.getFirstAsync<{ summary_json: string }>(
        "SELECT summary_json FROM group_room_history_cache WHERE actor_uid = ? AND room_id = ?",
        uid,
        roomId,
      );
      const roomSummary = shared ? decodeSummary(shared.summary_json, uid, roomId) : null;
      return roomSummary
        ? { summary: roomSummary, syncStatus: "SYNCED", source: "ROOM" }
        : null;
    },
    ...details,
  };
}

export type GroupHistoryRepository = ReturnType<typeof createGroupHistoryRepository>;
