import type { PublishedBillState } from './published-bill-state';
import type { SettlementDetailsState } from './settlement-details-repository';

export type VietQrPayment = {
  kind: 'ready'; imageUrl: string; identity: string; amountVnd: number;
  bankBin: string; accountNumber: string; accountName: string; memo: string;
};
export type VietQrState = VietQrPayment | { kind: 'unavailable'; message: string } | { kind: 'zero' };

export function buildVietQrPayment(input: {
  roomId: string; roomPin: string; actorUid: string;
  member: { uid: string; displayName: string; status: string } | undefined;
  billState: PublishedBillState; detailsState: SettlementDetailsState;
  isOnline: boolean; nowUtcMs: number;
}): VietQrState {
  const unavailable = (message: string): VietQrState => ({ kind: 'unavailable', message });
  if (!input.member || input.member.uid !== input.actorUid
    || !['ACTIVE', 'EARLY_EXIT'].includes(input.member.status)) return unavailable('This room is not available for your account.');
  if (!input.isOnline) return unavailable('Reconnect to confirm the latest bill and payment details.');
  if (input.billState.kind !== 'published') return unavailable('Confirm the latest published bill before generating a payment QR.');
  const bill = input.billState.bill;
  const shares = bill.shares.filter(share => share.uid === input.actorUid);
  if (bill.roomId !== input.roomId || !bill.requestId || bill.calculationVersion !== 1
    || !Number.isSafeInteger(bill.totalBillVnd) || bill.totalBillVnd < 1_000
    || bill.sumShareVnd !== bill.totalBillVnd
    || new Set(bill.shares.map(share => share.uid)).size !== bill.shares.length
    || !Number.isSafeInteger(bill.billRevision ?? 0)
    || (bill.billRevision ?? 0) < 0 || shares.length !== 1
    || bill.shares.some(share => !Number.isSafeInteger(share.shareVnd) || share.shareVnd < 0)
    || bill.shares.reduce((sum, share) => sum + share.shareVnd, 0) !== bill.totalBillVnd) {
    return unavailable('Your published share could not be confirmed. Refresh the bill.');
  }
  const amount = shares[0].shareVnd;
  if (amount === 0) return { kind: 'zero' };
  if (amount > 9_999_999_999_999) return unavailable('This amount exceeds the VietQR limit. Use a manual transfer.');
  if (input.detailsState.kind !== 'ready') return unavailable(input.detailsState.kind === 'loading'
    ? 'Confirming Host payment details…' : 'Host payment details are unavailable. Refresh or ask the Host to update them.');
  const details = input.detailsState.details;
  if (details.roomId !== input.roomId || !Number.isFinite(input.nowUtcMs)
    || !Number.isFinite(details.expiresAtUtcMs) || details.expiresAtUtcMs <= input.nowUtcMs) {
    return unavailable('These payment details have expired. A new QR cannot be generated.');
  }
  if (!/^\d{6}$/.test(details.bankId) || !/^[A-Za-z0-9]{1,19}$/.test(details.accountNumber)
    || !details.accountName.trim()) return unavailable('Ask the Host to select a bank and check the account details before generating a QR.');
  if (!/^\d{8}$/.test(input.roomPin)) return unavailable('The room code could not be confirmed.');
  // VietQR giới hạn memo 50 ký tự: bỏ dấu tiếng Việt, loại ký tự đặc biệt và giữ nguyên mã phòng.
  const name = input.member.displayName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) return unavailable('Your member name cannot be used in a VietQR transfer memo.');
  const prefix = `DL ${input.roomPin} `;
  const memo = prefix + name.slice(0, 50 - prefix.length).trimEnd();
  const imageUrl = `https://img.vietqr.io/image/${details.bankId}-${details.accountNumber}-qr_only.svg`
    + `?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(details.accountName.trim())}`;
  return {
    kind: 'ready', imageUrl, identity: `${bill.requestId}:${bill.billRevision ?? 0}:${imageUrl}`,
    amountVnd: amount, bankBin: details.bankId, accountNumber: details.accountNumber,
    accountName: details.accountName.trim(), memo,
  };
}
