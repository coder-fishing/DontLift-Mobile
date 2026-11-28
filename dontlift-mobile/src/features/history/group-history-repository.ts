
/** API chung cho đọc, đồng bộ và theo dõi lịch sử Group. */
import { getLocalDatabase } from "../local/database";
import { recoverGroupSummaries } from "./group-summary-repository";
import type { GroupHistoryEntry } from "./group-history-model";
import { listenToHistoryPayment } from "./group-history-payment";
import { createGroupActionableHistory } from "./group-actionable-history";
import { createGroupHistoryDetailReader } from "./group-history-detail";
import { createGroupHistoryPageReader } from "./group-history-page";
import { createGroupHistorySync } from "./group-history-sync";
import {
  decodeSummary,
  type GroupHistoryContext,
  type GroupHistoryDependencies,
  type HistoryRow,
} from "./group-history-support";

export type { GroupHistoryDependencies } from "./group-history-support";
export type { GroupHistoryDetail, GroupRoomRosterPreview } from "./group-history-detail";
export type {
  GroupActionableKind,
  GroupActionableSession,
  GroupActionableCursor,
  GroupActionablePage,
} from "./group-actionable-history";
export {
  GROUP_ACTIONABLE_PAGE_SIZE,
  deriveGroupActionableSession,
  sortGroupActionableSessions,
} from "./group-actionable-history";
export type { GroupHistoryPage } from "./group-history-page";
export { canCorrectGroupSummary, sameGroupSummary } from "./group-history-sync";

export function createGroupHistoryRepository(
  dependencies: GroupHistoryDependencies,
) {
  const database = () => dependencies.database ?? getLocalDatabase();
  const isActor = (uid: string) => dependencies.auth.currentUser?.uid === uid;

  const context: GroupHistoryContext = {
    dependencies,
    database,
    isActor,
  };

  // Đọc một lịch sử: ưu tiên PERSONAL, fallback sang ROOM cache.
  const readEntry = async (
    uid: string,
    roomId: string,
  ): Promise<GroupHistoryEntry | null> => {
    if (!isActor(uid)) return null;

    const db = await database();

    const personal = await db.getFirstAsync<HistoryRow>(
      `SELECT summary_json, sync_status
       FROM group_history
       WHERE actor_uid = ? AND room_id = ?`,
      uid,
      roomId,
    );

    const summary = personal
      ? decodeSummary(personal.summary_json, uid, roomId)
      : null;

    if (summary && personal) {
      return {
        summary,
        syncStatus: personal.sync_status,
        source: "PERSONAL",
      };
    }

    const cached = await db.getFirstAsync<{ summary_json: string }>(
      `SELECT summary_json
       FROM group_room_history_cache
       WHERE actor_uid = ? AND room_id = ?`,
      uid,
      roomId,
    );

    const roomSummary = cached
      ? decodeSummary(cached.summary_json, uid, roomId)
      : null;

    return roomSummary
      ? { summary: roomSummary, syncStatus: "SYNCED", source: "ROOM" }
      : null;
  };

  return {
    // Theo dõi hóa đơn realtime.
    listenPayment: (
      uid: string,
      roomId: string,
      onState: Parameters<typeof listenToHistoryPayment>[3],
    ) => listenToHistoryPayment(dependencies, uid, roomId, onState),

    // Khôi phục lịch sử Local.
    recoverLocal: async (uid: string): Promise<void> => {
      if (isActor(uid)) {
        await recoverGroupSummaries(await database(), uid);
      }
    },

    // Kết hợp các API chuyên trách.
    ...createGroupHistorySync(context),
    ...createGroupHistoryPageReader(context),
    ...createGroupActionableHistory(context),
    readEntry,
    ...createGroupHistoryDetailReader(context),
  };
}

export type GroupHistoryRepository =
  ReturnType<typeof createGroupHistoryRepository>;
