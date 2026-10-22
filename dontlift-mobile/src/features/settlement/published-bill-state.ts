import type { PublishedBill } from './bill-repository';

export type PublishedBillState =
  | { kind: 'loading'; bill?: PublishedBill | null }
  | { kind: 'unpublished'; bill?: PublishedBill | null }
  | { kind: 'cached'; bill: PublishedBill | null }
  | { kind: 'published'; bill: PublishedBill }
  | { kind: 'error'; bill?: PublishedBill | null };

export function selectPublishedBillState(
  state: PublishedBillState,
  committedBill: PublishedBill | null,
  roomId: string | undefined,
): PublishedBillState {
  if (state.kind === 'published') {
    return state.bill.roomId === roomId ? state : { kind: 'loading' };
  }
  // Giữ dữ liệu đã xác nhận của đúng room, nhưng không nâng cache/lỗi thành trạng thái live.
  const bill = state.bill && state.bill.roomId === roomId ? state.bill
    : committedBill && committedBill.roomId === roomId ? committedBill : null;
  if (state.kind === 'cached') return { kind: 'cached', bill };
  return bill ? { ...state, bill } : { kind: state.kind };
}
