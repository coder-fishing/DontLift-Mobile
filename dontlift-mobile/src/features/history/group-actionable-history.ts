/** Xác định và lưu cache các phiên nhóm đang cần người dùng xử lý. */
import {
  collection,
  doc,
  documentId,
  getDocFromServer,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore";
import type { Auth } from "firebase/auth";
import { createBillRepository, type PublishedBill } from "../settlement/bill-repository";
import { isTimestamp, type GroupHistoryContext } from "./group-history-support";

export const GROUP_ACTIONABLE_PAGE_SIZE = 10;
export type GroupActionableKind =
  | "RESUME_SESSION"
  | "SET_UP_BILL"
  | "WAITING_FOR_HOST_BILL"
  | "AWAITING_CONFIRMATION"
  | "REVIEW_PAYMENTS";
export type GroupActionableSession = {
  roomId: string;
  action: GroupActionableKind;
  roomStatus: string;
  role: "HOST" | "MEMBER";
  startedAtUtcMs: number | null;
  endedAtUtcMs: number | null;
  updatedAtUtcMs?: number | null;
  source: "LIVE" | "SAVED";
};
export type GroupActionableCursor = { joinedAtUtcMs: number; roomId: string };
export type GroupActionablePage = {
  items: GroupActionableSession[];
  cursor: GroupActionableCursor | null;
  hasMore: boolean;
  cloudError: boolean;
};
type ActionableInput = {
  roomId: string;
  ownUid: string;
  roomStatus: string;
  reconciliation: string | null;
  role: "HOST" | "MEMBER";
  ownMemberStatus: string;
  startedAtUtcMs: number | null;
  endedAtUtcMs: number | null;
  updatedAtUtcMs?: number | null;
  bill: PublishedBill | null;
  billReadFailed: boolean;
};
/**
 * Suy ra action từ trạng thái phòng, thành viên và hóa đơn; không đọc field action lưu sẵn.
 * Quy tắc:
 * - Thành viên không còn ACTIVE/EARLY_EXIT: không có action.
 * - Phòng ACTIVE: RESUME_SESSION.
 * - Phòng COMPLETED và FINALIZED, chưa đọc được hóa đơn: không đưa ra action thanh toán.
 * - Phòng COMPLETED và FINALIZED, chưa có hóa đơn đã publish: Host SET_UP_BILL,
 *   thành viên khác WAITING_FOR_HOST_BILL.
 * - Đã có hóa đơn: Host REVIEW_PAYMENTS nếu còn phần chưa trả; thành viên
 *   AWAITING_CONFIRMATION nếu phần của chính họ chưa được đánh dấu đã trả.
 * - Các trạng thái còn lại hoặc không còn khoản cần trả: không có action.
 */
export function deriveGroupActionableSession(
  input: ActionableInput,
): Omit<GroupActionableSession, "source"> | null {
  if (!["ACTIVE", "EARLY_EXIT"].includes(input.ownMemberStatus)) return null;
  if (input.roomStatus === "ACTIVE")
    return {
      roomId: input.roomId,
      action: "RESUME_SESSION",
      roomStatus: input.roomStatus,
      role: input.role,
      startedAtUtcMs: input.startedAtUtcMs,
      endedAtUtcMs: input.endedAtUtcMs,
      updatedAtUtcMs: input.updatedAtUtcMs,
    };
  if (input.roomStatus !== "COMPLETED" || input.reconciliation !== "FINALIZED")
    return null;
  if (input.billReadFailed) return null;
  if (!input.bill)
    return {
      roomId: input.roomId,
      action: input.role === "HOST" ? "SET_UP_BILL" : "WAITING_FOR_HOST_BILL",
      roomStatus: input.roomStatus,
      role: input.role,
      startedAtUtcMs: input.startedAtUtcMs,
      endedAtUtcMs: input.endedAtUtcMs,
      updatedAtUtcMs: input.updatedAtUtcMs,
    };
  const unpaidShares = input.bill.shares.filter(
    (share) => share.paymentStatus !== "MARKED_AS_PAID",
  );
  if (input.role === "HOST")
    return unpaidShares.length
      ? {
          roomId: input.roomId,
          action: "REVIEW_PAYMENTS",
          roomStatus: input.roomStatus,
          role: input.role,
          startedAtUtcMs: input.startedAtUtcMs,
          endedAtUtcMs: input.endedAtUtcMs,
          updatedAtUtcMs: input.updatedAtUtcMs,
        }
      : null;
  const ownShare = input.bill.shares.find(
    (share) => share.uid === input.ownUid,
  );
  return ownShare && ownShare.paymentStatus !== "MARKED_AS_PAID"
    ? {
        roomId: input.roomId,
        action: "AWAITING_CONFIRMATION",
        roomStatus: input.roomStatus,
        role: input.role,
        startedAtUtcMs: input.startedAtUtcMs,
        endedAtUtcMs: input.endedAtUtcMs,
        updatedAtUtcMs: input.updatedAtUtcMs,
      }
    : null;
}
// Sắp xếp phiên theo mức độ cần xử lý, sau đó theo thời điểm hoạt động gần nhất.
export function sortGroupActionableSessions(
  items: GroupActionableSession[],
): GroupActionableSession[] {
  const rank: Record<GroupActionableKind, number> = {
    RESUME_SESSION: 0,
    SET_UP_BILL: 1,
    WAITING_FOR_HOST_BILL: 2,
    AWAITING_CONFIRMATION: 3,
    REVIEW_PAYMENTS: 4,
  };
  return [...items].sort(
    (a, b) =>
      rank[a.action] - rank[b.action] ||
      (b.updatedAtUtcMs ?? b.endedAtUtcMs ?? b.startedAtUtcMs ?? 0) -
        (a.updatedAtUtcMs ?? a.endedAtUtcMs ?? a.startedAtUtcMs ?? 0),
  );
}

async function readLiveActionableSession(
  firestore: Firestore,
  auth: Auth,
  uid: string,
  roomId: string,
): Promise<Omit<GroupActionableSession, "source"> | null> {
  const [roomSnapshot, memberSnapshot] = await Promise.all([
    getDocFromServer(doc(firestore, "rooms", roomId)),
    getDocFromServer(doc(firestore, "rooms", roomId, "members", uid)),
  ]);
  if (!roomSnapshot.exists() || !memberSnapshot.exists()) return null;
  const room = roomSnapshot.data();
  const member = memberSnapshot.data();
  let bill: PublishedBill | null = null;
  if (
    room.status === "COMPLETED" &&
    room.reconciliationStatus === "FINALIZED"
  ) {
    bill = await createBillRepository({ firestore, auth }).readPublished(
      roomId,
    );
  }
  return deriveGroupActionableSession({
    roomId,
    ownUid: uid,
    roomStatus: String(room.status),
    reconciliation:
      typeof room.reconciliationStatus === "string"
        ? room.reconciliationStatus
        : null,
    role: member.role === "HOST" ? "HOST" : "MEMBER",
    ownMemberStatus: String(member.status),
    startedAtUtcMs: isTimestamp(room.startedAt)
      ? room.startedAt.toMillis()
      : null,
    endedAtUtcMs: isTimestamp(room.endedAt) ? room.endedAt.toMillis() : null,
    updatedAtUtcMs: isTimestamp(room.updatedAt)
      ? room.updatedAt.toMillis()
      : null,
    bill,
    billReadFailed: false,
  });
}
type SavedActionableCache = {
  items: GroupActionableSession[];
  cursor: GroupActionableCursor | null;
  hasMore: boolean;
  checkedAtUtcMs: number;
};
function parseActionableCache(
  raw: string | undefined,
): SavedActionableCache | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as SavedActionableCache;
    if (
      !Array.isArray(value.items) ||
      value.items.some(
        (item) =>
          typeof item.roomId !== "string" ||
          ![
            "RESUME_SESSION",
            "SET_UP_BILL",
            "WAITING_FOR_HOST_BILL",
            "AWAITING_CONFIRMATION",
            "REVIEW_PAYMENTS",
          ].includes(item.action) ||
          !["HOST", "MEMBER"].includes(item.role) ||
          !["LIVE", "SAVED"].includes(item.source),
      )
    )
      return null;
    return {
      ...value,
      items: value.items.map((item) => ({ ...item, source: "SAVED" as const })),
    };
  } catch {
    return null;
  }
}

/** Tạo các thao tác đọc phiên cần xử lý và dùng chung context tài khoản/cache. */
/**
 * GROUP ACTIONABLE SYNC - Đồng bộ phiên Group cần xử lý.
 * Đọc dữ liệu từ Firestore (Remote), kết hợp và lưu cache vào SQLite (Local).
 * Hỗ trợ hiển thị offline, phân trang và cập nhật trạng thái phiên.
 * Chỉ đồng bộ các phiên còn cần xử lý, không phải toàn bộ lịch sử Group.
 */
export function createGroupActionableHistory(context: GroupHistoryContext) {
  const { dependencies, database, isActor } = context;
  return {
    // Đọc một trang từ Firestore rồi ghép với cache các phiên cần xử lý.
    async readActionablePage(
      uid: string,
      options: { online: boolean; cursor: GroupActionableCursor | null },
    ): Promise<GroupActionablePage> {
      if (!isActor(uid)) throw new Error("unauthenticated");
      const cacheKey = `group-actionable:${uid}`;
      const db = await database();
      const readCache = async () => {
        try {
          const row = await db.getFirstAsync<{ value: string }>(
            "SELECT value FROM app_settings WHERE key = ?",
            cacheKey,
          );
          return parseActionableCache(row?.value);
        } catch {
          return null;
        }
      };
      const cached = await readCache();
      if (!options.online)
        return {
          items: cached?.items ?? [],
          cursor: cached?.cursor ?? null,
          hasMore: cached?.hasMore ?? false,
          cloudError: false,
        };

      let cloudError = false;
      let indexDocs: { id: string; data(): Record<string, unknown> }[] = [];
      let hasMore = false;
      let nextCursor = options.cursor;
      const checkedRoomIds = new Set<string>();
      const currentItems = new Map<string, GroupActionableSession>();
      try {
        const indexCollection = collection(
          dependencies.firestore,
          "users",
          uid,
          "groupRooms",
        );
        const constraints: QueryConstraint[] = [
          orderBy("joinedAt", "desc"),
          orderBy(documentId(), "desc"),
        ];
        if (options.cursor)
          constraints.push(
            startAfter(
              Timestamp.fromMillis(options.cursor.joinedAtUtcMs),
              options.cursor.roomId,
            ),
          );
        const page = await getDocsFromServer(
          query(
            indexCollection,
            ...constraints,
            limit(GROUP_ACTIONABLE_PAGE_SIZE + 1),
          ),
        );
        if (!isActor(uid)) throw new Error("account-changed");
        hasMore = page.docs.length > GROUP_ACTIONABLE_PAGE_SIZE;
        const scannedDocs = page.docs.slice(0, GROUP_ACTIONABLE_PAGE_SIZE);
        indexDocs = scannedDocs.filter((index) => {
          const data = index.data();
          return data.roomId === index.id && isTimestamp(data.joinedAt);
        });
        const last = scannedDocs[scannedDocs.length - 1];
        const joinedAt = last?.data().joinedAt;
        nextCursor = isTimestamp(joinedAt)
          ? { joinedAtUtcMs: joinedAt.toMillis(), roomId: last!.id }
          : options.cursor;

        const settled = await Promise.all(
          indexDocs.map(async (index) => {
            try {
              const [roomSnapshot, memberSnapshot] = await Promise.all([
                getDocFromServer(
                  doc(dependencies.firestore, "rooms", index.id),
                ),
                getDocFromServer(
                  doc(
                    dependencies.firestore,
                    "rooms",
                    index.id,
                    "members",
                    uid,
                  ),
                ),
              ]);
              if (!isActor(uid)) throw new Error("account-changed");
              if (!roomSnapshot.exists() || !memberSnapshot.exists()) {
                checkedRoomIds.add(index.id);
                return null;
              }
              const room = roomSnapshot.data();
              const member = memberSnapshot.data();
              if (!["ACTIVE", "EARLY_EXIT"].includes(String(member.status))) {
                checkedRoomIds.add(index.id);
                return null;
              }
              let bill: PublishedBill | null = null;
              let billReadFailed = false;
              if (
                room.status === "COMPLETED" &&
                room.reconciliationStatus === "FINALIZED"
              ) {
                try {
                  bill = await createBillRepository(dependencies).readPublished(
                    index.id,
                  );
                } catch {
                  billReadFailed = true;
                  cloudError = true;
                }
              }
              if (!billReadFailed) checkedRoomIds.add(index.id);
              const entry = deriveGroupActionableSession({
                roomId: index.id,
                ownUid: uid,
                roomStatus: String(room.status),
                reconciliation:
                  typeof room.reconciliationStatus === "string"
                    ? room.reconciliationStatus
                    : null,
                role: member.role === "HOST" ? "HOST" : "MEMBER",
                ownMemberStatus: String(member.status),
                startedAtUtcMs: isTimestamp(room.startedAt)
                  ? room.startedAt.toMillis()
                  : null,
                endedAtUtcMs: isTimestamp(room.endedAt)
                  ? room.endedAt.toMillis()
                  : null,
                updatedAtUtcMs: isTimestamp(room.updatedAt)
                  ? room.updatedAt.toMillis()
                  : null,
                bill,
                billReadFailed,
              });
              return entry ? { ...entry, source: "LIVE" as const } : null;
            } catch (error) {
              if (error instanceof Error && error.message === "account-changed")
                throw error;
              cloudError = true;
              return null;
            }
          }),
        );
        for (const item of settled)
          if (item) currentItems.set(item.roomId, item);
      } catch (error) {
        if (error instanceof Error && error.message === "account-changed")
          throw error;
        cloudError = true;
        hasMore = cached?.hasMore ?? false;
        nextCursor = options.cursor ?? cached?.cursor ?? null;
      }

      const merged = new Map<string, GroupActionableSession>(
        cached?.items.map((item) => [item.roomId, item]) ?? [],
      );
      for (const roomId of checkedRoomIds) merged.delete(roomId);
      for (const item of currentItems.values()) merged.set(item.roomId, item);
      const items = sortGroupActionableSessions([...merged.values()]);
      const snapshot: SavedActionableCache = {
        items: items.map((item) => ({ ...item, source: "SAVED" })),
        cursor: nextCursor,
        hasMore,
        checkedAtUtcMs: Date.now(),
      };
      if (isActor(uid)) {
        try {
          await db.runAsync(
            "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            cacheKey,
            JSON.stringify(snapshot),
          );
        } catch {
          /* Cache chỉ hỗ trợ hiển thị, không phải điều kiện để Group Home hoạt động. */
        }
      }
      return { items, cursor: nextCursor, hasMore, cloudError };
    },
    // Đọc trạng thái cần xử lý mới nhất của một phòng.
    async readActionableSession(
      uid: string,
      roomId: string,
    ): Promise<GroupActionableSession | null> {
      if (!isActor(uid)) throw new Error("unauthenticated");
      const entry = await readLiveActionableSession(
        dependencies.firestore,
        dependencies.auth,
        uid,
        roomId,
      );
      if (!isActor(uid)) throw new Error("account-changed");
      return entry ? { ...entry, source: "LIVE" } : null;
    },
  };
}
