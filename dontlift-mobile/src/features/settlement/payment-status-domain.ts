import { Timestamp } from 'firebase/firestore';

export type SharePaymentFields = {
  paymentStatus?: 'UNPAID' | 'MARKED_AS_PAID';
  paidAtUtcMs?: number | null;
  paidBy?: string;
  paymentRequestId?: string;
};

export function parseSharePayment(data: Record<string, unknown>): SharePaymentFields | null {
  const status = data.paymentStatus ?? 'UNPAID';
  if (status === 'UNPAID') {
    return data.paidAt == null && data.paidBy == null && data.paymentRequestId == null ? {} : null;
  }
  if (status !== 'MARKED_AS_PAID' || !(data.paidAt instanceof Timestamp)
    || typeof data.paidBy !== 'string' || !data.paidBy
    || typeof data.paymentRequestId !== 'string' || !data.paymentRequestId) return null;
  return { paymentStatus: status, paidAtUtcMs: data.paidAt.toMillis(), paidBy: data.paidBy,
    paymentRequestId: data.paymentRequestId };
}

// Receipt cũ không được hạ revision hoặc xóa paid counter mà subscription đã xác nhận.
export function acceptsBillProgress(candidate: { roomId: string; billRevision?: number; billPaidCount?: number },
  observed: { roomId: string | null; revision: number; paidCount: number }): boolean {
  if (candidate.roomId !== observed.roomId) return true;
  const revision = candidate.billRevision ?? 0;
  return revision > observed.revision
    || (revision === observed.revision && (candidate.billPaidCount ?? 0) >= observed.paidCount);
}
