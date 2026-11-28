/** Đọc, lưu cache và định dạng chi tiết lịch sử nhóm cùng phần xem trước thành viên. */
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { createBillRepository, type PublishedBill } from "../settlement/bill-repository";
import { readPremiumExpiry } from "../premium/premium-entitlement";
import type { GroupHistoryContext } from "./group-history-support";

export type GroupHistoryDetail = {
  roomStatus: string;
  reconciliation: string | null;
  finalizationReason: string | null;
  members: {
    uid: string;
    name: string;
    status: string;
    score: number;
    avatarUri?: string;
    premiumExpiresAtUtcMs?: number | null;
  }[];
  excludedCount: number;
  excludedHasMore: boolean;
  bill: PublishedBill | null;
  billError: boolean;
};
export type GroupRoomRosterPreview = {
  totalCount: number;
  members: {
    uid: string;
    displayName: string;
    avatarUri?: string;
    premiumExpiresAtUtcMs?: number | null;
  }[];
};

/** Tạo các thao tác đọc chi tiết và danh sách thành viên dùng chung cache cục bộ. */
export function createGroupHistoryDetailReader(context: GroupHistoryContext) {
  const { dependencies, database, isActor } = context;
  return {
    // Dùng chi tiết đã lưu khi offline, truy vấn giới hạn thành viên khi online.
    async readRoomRosterPreview(
      uid: string,
      roomId: string,
      online: boolean,
    ): Promise<GroupRoomRosterPreview | null> {
      if (!isActor(uid)) return null;
      const rosterCacheKey = `group-roster:${uid}:${roomId}`;
      if (!online) {
        try {
          const saved = await (
            await database()
          ).getFirstAsync<{ value: string }>(
            "SELECT value FROM app_settings WHERE key = ?",
            rosterCacheKey,
          );
          const preview = saved
            ? (JSON.parse(saved.value) as GroupRoomRosterPreview)
            : null;
          if (
            preview &&
            Number.isSafeInteger(preview.totalCount) &&
            Array.isArray(preview.members) &&
            preview.members.length <= 3 &&
            preview.totalCount >= preview.members.length &&
            preview.members.every(
              (member) =>
                typeof member.uid === "string" &&
                typeof member.displayName === "string" &&
                (member.avatarUri === undefined ||
                  typeof member.avatarUri === "string") &&
                (member.premiumExpiresAtUtcMs === undefined ||
                  member.premiumExpiresAtUtcMs === null ||
                  typeof member.premiumExpiresAtUtcMs === "number"),
            )
          )
            return preview;
        } catch {
          /* Nếu không có cache roster thì dùng chi tiết phiên đã lưu. */
        }
      }
      let cachedJson: string | null = null;
      try {
        const local = await database();
        const [personal, shared] = await Promise.all([
          local.getFirstAsync<{ detail_json: string | null }>(
            "SELECT detail_json FROM group_history WHERE actor_uid = ? AND room_id = ?",
            uid,
            roomId,
          ),
          local.getFirstAsync<{ detail_json: string | null }>(
            "SELECT detail_json FROM group_room_history_cache WHERE actor_uid = ? AND room_id = ?",
            uid,
            roomId,
          ),
        ]);
        cachedJson = personal?.detail_json ?? shared?.detail_json ?? null;
      } catch {
        /* Vẫn có thể đọc roster online khi cache cục bộ không khả dụng. */
      }
      if (cachedJson && !online) {
        try {
          const detail = JSON.parse(cachedJson) as GroupHistoryDetail;
          if (Array.isArray(detail.members) && detail.members.length > 0) {
            return {
              totalCount: detail.members.length,
              members: detail.members.slice(0, 3).map((member) => ({
                uid: member.uid,
                displayName: member.name,
                ...(typeof member.avatarUri === "string"
                  ? { avatarUri: member.avatarUri }
                  : {}),
                premiumExpiresAtUtcMs: member.premiumExpiresAtUtcMs ?? null,
              })),
            };
          }
        } catch {
          /* Bỏ qua cache roster offline không hợp lệ. */
        }
      }
      if (!online) return null;
      try {
        const roomRef = doc(dependencies.firestore, "rooms", roomId);
        const ownRef = doc(
          dependencies.firestore,
          "rooms",
          roomId,
          "members",
          uid,
        );
        const [room, own] = await Promise.all([
          getDocFromServer(roomRef),
          getDocFromServer(ownRef),
        ]);
        if (
          !isActor(uid) ||
          !room.exists() ||
          !own.exists() ||
          !["ACTIVE", "EARLY_EXIT"].includes(String(own.data().status)) ||
          !["COMPLETED", "CANCELLED", "ABORTED"].includes(
            String(room.data().status),
          )
        )
          return null;
        const roster = await getDocsFromServer(
          query(
            collection(dependencies.firestore, "rooms", roomId, "members"),
            orderBy("joinedAt", "asc"),
            limit(3),
          ),
        );
        if (!isActor(uid)) return null;
        const members = roster.docs.flatMap((member) => {
          const data = member.data();
          if (!["ACTIVE", "EARLY_EXIT"].includes(String(data.status)))
            return [];
          return [
            {
              uid: member.id,
              displayName: String(data.displayName ?? "Member"),
              ...(typeof data.avatarUri === "string" && data.avatarUri.trim()
                ? { avatarUri: data.avatarUri }
                : {}),
              premiumExpiresAtUtcMs: readPremiumExpiry(data.premiumExpiresAt),
            },
          ];
        });
        const count = Number(room.data().participantCount);
        const preview = {
          totalCount:
            Number.isSafeInteger(count) && count >= members.length
              ? count
              : members.length,
          members,
        };
        try {
          await (
            await database()
          ).runAsync(
            "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rosterCacheKey,
            JSON.stringify(preview),
          );
        } catch {
          /* Lỗi ghi cache không được làm mất roster đã xác nhận từ máy chủ. */
        }
        return preview;
      } catch {
        return null;
      }
    },
    // Đọc phòng, thành viên, vi phạm và hóa đơn rồi lưu chi tiết vào thiết bị.
    async readDetail(uid: string, roomId: string): Promise<GroupHistoryDetail> {
      if (!isActor(uid)) throw new Error("unauthenticated");
      const db = dependencies.firestore;
      const own = await getDocFromServer(
        doc(db, "rooms", roomId, "members", uid),
      );
      if (
        !own.exists() ||
        !["ACTIVE", "EARLY_EXIT"].includes(own.data().status)
      )
        throw new Error("permission-denied");
      const [room, members] = await Promise.all([
        getDocFromServer(doc(db, "rooms", roomId)),
        getDocsFromServer(collection(db, "rooms", roomId, "members")),
      ]);
      if (!isActor(uid) || !room.exists()) throw new Error("unavailable");
      const data = room.data();
      const excluded = ["ACTIVE", "COMPLETED"].includes(data.status)
        ? await getDocsFromServer(
            query(
              collection(db, "rooms", roomId, "violations"),
              where("excludedFromFinalScore", "==", true),
              limit(101),
            ),
          )
        : null;
      let bill: PublishedBill | null = null;
      let billError = false;
      if (data.calculationVersion === 1) {
        try {
          bill = await createBillRepository(dependencies).readPublished(roomId);
        } catch {
          billError = true;
        }
      }
      const detail: GroupHistoryDetail = {
        roomStatus: data.status,
        reconciliation: data.reconciliationStatus ?? null,
        finalizationReason: data.finalizationReason ?? null,
        members: members.docs.map((m) => ({
          uid: m.id,
          name: m.data().displayName,
          status: m.data().status,
          score: m.data().penaltyScore,
          ...(typeof m.data().avatarUri === "string" &&
          m.data().avatarUri.trim()
            ? { avatarUri: m.data().avatarUri }
            : {}),
          premiumExpiresAtUtcMs: readPremiumExpiry(m.data().premiumExpiresAt),
        })),
        excludedCount: Math.min(excluded?.size ?? 0, 100),
        excludedHasMore: (excluded?.size ?? 0) > 100,
        bill,
        billError,
      };
      const local = await database();
      if (!isActor(uid)) throw new Error("account-changed");
      await local.runAsync(
        "UPDATE group_history SET detail_json = ? WHERE actor_uid = ? AND room_id = ?",
        JSON.stringify(detail),
        uid,
        roomId,
      );
      await local.runAsync(
        "UPDATE group_room_history_cache SET detail_json = ? WHERE actor_uid = ? AND room_id = ?",
        JSON.stringify(detail),
        uid,
        roomId,
      );
      return detail;
    },
    // Ưu tiên chi tiết cá nhân đã lưu, sau đó mới đọc cache lịch sử phòng dùng chung.
    async cachedDetail(
      uid: string,
      roomId: string,
    ): Promise<GroupHistoryDetail | null> {
      if (!isActor(uid)) return null;
      const db = await database();
      const row = await db.getFirstAsync<{ detail_json: string | null }>(
        "SELECT detail_json FROM group_history WHERE actor_uid = ? AND room_id = ?",
        uid,
        roomId,
      );
      if (row?.detail_json)
        return JSON.parse(row.detail_json) as GroupHistoryDetail;
      const shared = await db.getFirstAsync<{ detail_json: string | null }>(
        "SELECT detail_json FROM group_room_history_cache WHERE actor_uid = ? AND room_id = ?",
        uid,
        roomId,
      );
      return shared?.detail_json
        ? (JSON.parse(shared.detail_json) as GroupHistoryDetail)
        : null;
    },  };
}
