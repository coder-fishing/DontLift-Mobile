import {
  doc,
  onSnapshot,
  type Firestore,
  type SnapshotMetadata,
} from "firebase/firestore";
import type { Auth } from "firebase/auth";
import { listenToPublishedBill } from "../settlement/published-bill-listener";
import type { PublishedBillState } from "../settlement/published-bill-state";
import {
  createSettlementDetailsRepository,
  type SettlementDetailsState,
} from "../settlement/settlement-details-repository";
import {
  emptyHistoryPayment,
  type HistoryPaymentState,
} from "./history-payment-state";

/** Theo dõi hóa đơn và thông tin thanh toán của phiên trong màn hình lịch sử. */
export type { HistoryPaymentState } from "./history-payment-state";

type RoomData = Record<string, unknown> & {
  pin?: unknown;
  status?: unknown;
  reconciliationStatus?: unknown;
  billRequestId?: unknown;
  billOverrideRequestId?: unknown;
  billRevision?: unknown;
  billPaidCount?: unknown;
};

type Member = NonNullable<HistoryPaymentState["member"]>;

const ROOM_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Chỉ dùng snapshot lấy từ máy chủ và không còn ghi cục bộ đang chờ. */
function isTrustedSnapshot(metadata: SnapshotMetadata): boolean {
  return !metadata.fromCache && !metadata.hasPendingWrites;
}

/** Kiểm tra hóa đơn đã publish có khớp phiên bản và trạng thái phòng hiện tại không. */
function isBillCurrent(
  room: RoomData | null,
  member: Member | undefined,
  billState: PublishedBillState,
  roomId: string,
): boolean {
  const publication =
    typeof room?.billOverrideRequestId === "string"
      ? room.billOverrideRequestId
      : room?.billRequestId;

  return Boolean(
    room?.status === "COMPLETED" &&
      room.reconciliationStatus === "FINALIZED" &&
      member &&
      billState.kind === "published" &&
      billState.bill.roomId === roomId &&
      billState.bill.requestId === publication &&
      (billState.bill.billRevision ?? 0) === (room.billRevision ?? 0) &&
      (billState.bill.billPaidCount ?? 0) === (room.billPaidCount ?? 0),
  );
}

/** Theo dõi trạng thái phòng, thành viên và thanh toán để cập nhật màn hình lịch sử. */
export function listenToHistoryPayment(
  dependencies: { firestore: Firestore; auth: Auth },
  uid: string,
  roomId: string,
  onState: (state: HistoryPaymentState) => void,
): () => void {
  let active = true;
  let failed = false;
  let room: RoomData | null = null;
  let member: Member | undefined;
  let billState: PublishedBillState = { kind: "loading" };
  let detailsState: SettlementDetailsState = { kind: "loading" };

  // Mỗi listener thay đổi sẽ gọi hàm này để cập nhật trạng thái giao diện.
  const publish = () => {
    if (!active) return;

    if (failed || dependencies.auth.currentUser?.uid !== uid) {
      onState({
        ...emptyHistoryPayment(),
        billState: { kind: "error" },
        detailsState: { kind: "error" },
      });
      return;
    }

    const billIsCurrent = isBillCurrent(room, member, billState, roomId);
    onState({
      roomPin: typeof room?.pin === "string" ? room.pin : "",
      member,
      billState: billIsCurrent
        ? billState
        : billState.kind === "error"
          ? billState
          : { kind: "loading" },
      detailsState,
    });
  };

  const fail = () => {
    failed = true;
    publish();
  };

  onState(emptyHistoryPayment());

  // Không mở listener nếu sai tài khoản hoặc roomId không đúng UUID v4.
  if (
    dependencies.auth.currentUser?.uid !== uid ||
    !ROOM_ID_PATTERN.test(roomId)
  ) {
    fail();
    return () => {
      active = false;
    };
  }

  // Theo dõi trạng thái phòng; snapshot cache chưa được dùng để xác nhận hóa đơn.
  const stopRoom = onSnapshot(
    doc(dependencies.firestore, "rooms", roomId),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!active || failed) return;
      if (!snapshot.exists() && !snapshot.metadata.fromCache) {
        fail();
        return;
      }

      room =
        snapshot.exists() && isTrustedSnapshot(snapshot.metadata)
          ? snapshot.data()
          : null;
      publish();
    },
    fail,
  );

  // Theo dõi thành viên đang xem History và chỉ nhận membership còn hiệu lực.
  const stopMember = onSnapshot(
    doc(dependencies.firestore, "rooms", roomId, "members", uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!active || failed) return;
      if (!snapshot.exists() && !snapshot.metadata.fromCache) {
        fail();
        return;
      }

      const data = snapshot.data();
      member =
        snapshot.exists() &&
        isTrustedSnapshot(snapshot.metadata) &&
        typeof data?.displayName === "string" &&
        ["ACTIVE", "EARLY_EXIT"].includes(data.status)
          ? { uid, displayName: data.displayName, status: data.status }
          : undefined;
      publish();
    },
    fail,
  );

  // Theo dõi hóa đơn đã công bố và chi tiết quyết toán.
  const stopBill = listenToPublishedBill(
    dependencies.firestore,
    roomId,
    (state) => {
      billState = state;
      publish();
    },
  );

  const stopDetails = createSettlementDetailsRepository(dependencies).listen(
    roomId,
    (state) => {
      detailsState = state;
      publish();
    },
  );

  // Hủy cả bốn subscription khi rời màn hình hoặc kết thúc phiên theo dõi.
  return () => {
    active = false;
    stopRoom();
    stopMember();
    stopBill();
    stopDetails();
  };
}
