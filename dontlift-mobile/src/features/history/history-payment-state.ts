import type { PublishedBillState } from '../settlement/published-bill-state';
import type { SettlementDetailsState } from '../settlement/settlement-details-repository';
export type HistoryPaymentState = {
  roomPin: string;
  member: { uid: string; displayName: string; status: string } | undefined;
  billState: PublishedBillState;
  detailsState: SettlementDetailsState;
};
export const emptyHistoryPayment = (): HistoryPaymentState => ({ roomPin: '', member: undefined,
  billState: { kind: 'loading' }, detailsState: { kind: 'loading' } });
