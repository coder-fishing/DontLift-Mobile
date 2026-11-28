import {
  doc,
  runTransaction,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import type { Auth } from "firebase/auth";
import type { GroupHistoryStatus } from "./group-history-model";

/** Xác định trạng thái phiên nhóm có thẩm quyền từ dữ liệu Firestore hiện tại. */
export type GroupHistoryAuthority = {
  status: GroupHistoryStatus;
  cutoffUtcMs: number;
  startedAtUtcMs: number;
  terminal: boolean;
  roomStatus: "ACTIVE" | "COMPLETED" | "CANCELLED" | "ABORTED";
  earlyExitAtUtcMs: number | null;
};
/** Đọc phòng và thành viên cùng transaction để tránh ghép trạng thái phòng mới với roster cũ. */
/**
 * GROUP HISTORY AUTHORITY - Xác minh lịch sử phiên Group từ Firestore.
 * Đọc trạng thái phòng và thành viên bằng transaction để đảm bảo nhất quán.
 * Xác định thời điểm kết thúc hợp lệ (cutoffUtcMs),
 * bao gồm trường hợp thành viên rời phòng sớm (EARLY_EXIT).
 * Không thực hiện đồng bộ hoặc lưu cache SQLite.
 */
export async function readGroupHistoryAuthority(
  dependencies: { firestore: Firestore; auth: Auth },
  uid: string,
  roomId: string,
): Promise<GroupHistoryAuthority> {
  if (dependencies.auth.currentUser?.uid !== uid)
    throw new Error("unauthenticated");
  return runTransaction(dependencies.firestore, async (tx) => {
    const [roomDoc, memberDoc] = await Promise.all([
      tx.get(doc(dependencies.firestore, "rooms", roomId)),
      tx.get(doc(dependencies.firestore, "rooms", roomId, "members", uid)),
    ]);
    if (dependencies.auth.currentUser?.uid !== uid)
      throw new Error("account-changed");
    if (!roomDoc.exists() || !memberDoc.exists())
      throw new Error("permission-denied");
    const room = roomDoc.data();
    const member = memberDoc.data();
    const terminal = ["COMPLETED", "CANCELLED", "ABORTED"].includes(
      room.status,
    );
    const early = member.status === "EARLY_EXIT";
    if (!["ACTIVE", "EARLY_EXIT"].includes(member.status))
      throw new Error("permission-denied");
    if (
      !(room.startedAt instanceof Timestamp) ||
      (!early && !terminal) ||
      (terminal && !(room.endedAt instanceof Timestamp)) ||
      (early && !(member.earlyExitAt instanceof Timestamp))
    ) {
      throw new Error("failed-precondition");
    }
    const end = terminal ? Math.floor(room.endedAt.toMillis()) : null;
    const earlyExitAtUtcMs = early
      ? Math.floor(member.earlyExitAt.toMillis())
      : null;
    const cutoffUtcMs =
      earlyExitAtUtcMs == null
        ? end!
        : end == null
          ? earlyExitAtUtcMs
          : Math.min(end, earlyExitAtUtcMs);
    return {
      status: early ? "EARLY_EXIT" : room.status,
      roomStatus: room.status,
      startedAtUtcMs: Math.floor(room.startedAt.toMillis()),
      cutoffUtcMs,
      earlyExitAtUtcMs,
      terminal,
    };
  });
}
