import type { PublishedBillState } from "../settlement/published-bill-state";
import type { SettlementDetailsState } from "../settlement/settlement-details-repository";
/** Trạng thái thanh toán và thông tin thành viên của phiên trong lịch sử. */
export type HistoryPaymentState = {
  roomPin: string;
  member: { uid: string; displayName: string; status: string } | undefined;
  billState: PublishedBillState;
  detailsState: SettlementDetailsState;
};
/** Tạo trạng thái ban đầu khi dữ liệu thanh toán chưa được tải. */
export const emptyHistoryPayment = (): HistoryPaymentState => ({
  roomPin: "",
  member: undefined,
  billState: { kind: "loading" },
  detailsState: { kind: "loading" },
});
