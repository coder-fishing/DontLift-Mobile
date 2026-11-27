/** Context Firestore/SQLite và các hàm phân tích dùng chung cho luồng lịch sử nhóm. */
import { doc, getDocFromServer, Timestamp, type Firestore } from "firebase/firestore";
import type * as SQLite from "expo-sqlite";
import type { Auth } from "firebase/auth";
import {
  readGroupSummary,
  type GroupHistoryEntry,
  type GroupLocalSummary,
} from "./group-history-model";
import type { GroupHistoryAuthority } from "./group-history-authority";

export type GroupHistoryDependencies = {
  firestore: Firestore;
  auth: Auth;
  database?: Promise<SQLite.SQLiteDatabase>;
  readAuthority?: (uid: string, roomId: string) => Promise<GroupHistoryAuthority>;
};

export type GroupHistoryContext = {
  dependencies: GroupHistoryDependencies;
  database: () => Promise<SQLite.SQLiteDatabase>;
  isActor: (uid: string) => boolean;
};

export type HistoryRow = {
  summary_json: string;
  sync_status: "PENDING" | "SYNCED" | "FAILED";
};
/** Phân tích JSON summary và trả về null nếu dữ liệu không hợp lệ. */
export function decodeSummary(
  json: string,
  uid: string,
  roomId?: string,
): GroupLocalSummary | null {
  try {
    return readGroupSummary(JSON.parse(json), uid, roomId);
  } catch {
    return null;
  }
}
// Kiểm tra giá trị timestamp của Firestore trước khi đổi sang mili giây.
export function isTimestamp(value: unknown): value is Timestamp {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  );
}
/** Phân biệt lỗi đọc có thể thử lại với lỗi quyền truy cập hoặc dữ liệu đã mất. */
export function isUnavailableRead(error: unknown): boolean {
  const code =
    error instanceof Error && "code" in error
      ? String(error.code).replace(/^firestore\//, "")
      : "";
  return !["permission-denied", "not-found"].includes(code);
}
// Đọc summary của phòng đã kết thúc qua chỉ mục thuộc tài khoản người dùng.
export async function readIndexedRoomSummary(
  firestore: Firestore,
  uid: string,
  roomId: string,
): Promise<GroupHistoryEntry | null> {
  const [roomSnapshot, memberSnapshot] = await Promise.all([
    getDocFromServer(doc(firestore, "rooms", roomId)),
    getDocFromServer(doc(firestore, "rooms", roomId, "members", uid)),
  ]);
  if (!roomSnapshot.exists() || !memberSnapshot.exists()) return null;
  const room = roomSnapshot.data();
  const member = memberSnapshot.data();
  if (
    !["ACTIVE", "EARLY_EXIT"].includes(String(member.status)) ||
    !["COMPLETED", "CANCELLED", "ABORTED"].includes(String(room.status)) ||
    !(room.startedAt instanceof Timestamp) ||
    !(room.endedAt instanceof Timestamp)
  )
    return null;
  const earlyExitAt =
    member.earlyExitAt instanceof Timestamp
      ? member.earlyExitAt.toMillis()
      : null;
  const completedAtUtcMs =
    earlyExitAt == null
      ? room.endedAt.toMillis()
      : Math.min(room.endedAt.toMillis(), earlyExitAt);
  const summary = readGroupSummary(
    {
      version: 1,
      eventId: roomId,
      actorUid: uid,
      roomId,
      status: earlyExitAt == null ? room.status : "EARLY_EXIT",
      startedAtUtcMs: room.startedAt.toMillis(),
      completedAtUtcMs,
      liftCount: Number(member.liftCount),
      violationDurationSeconds: Number(member.violationDurationSeconds),
      penaltyScore: Number(member.penaltyScore),
    },
    uid,
    roomId,
  );
  return summary ? { summary, syncStatus: "SYNCED", source: "ROOM" } : null;
}
