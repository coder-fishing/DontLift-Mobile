import { doc, onSnapshot, type Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { listenToPublishedBill } from '../settlement/published-bill-listener';
import type { PublishedBillState } from '../settlement/published-bill-state';
import { createSettlementDetailsRepository, type SettlementDetailsState } from '../settlement/settlement-details-repository';

import { emptyHistoryPayment, type HistoryPaymentState } from './history-payment-state';
export type { HistoryPaymentState } from './history-payment-state';

// Dùng subscription riêng cho room lịch sử; không dùng bill cache hay đổi room đang focus trong app.
export function listenToHistoryPayment(dependencies: { firestore: Firestore; auth: Auth }, uid: string, roomId: string,
  onState: (state: HistoryPaymentState) => void): () => void {
  let active = true;
  let failed = false;
  let room: Record<string, unknown> | null = null;
  let member: HistoryPaymentState['member'];
  let billState: PublishedBillState = { kind: 'loading' };
  let detailsState: SettlementDetailsState = { kind: 'loading' };
  const publish = () => {
    if (!active) return;
    if (failed || dependencies.auth.currentUser?.uid !== uid) {
      onState({ ...emptyHistoryPayment(), billState: { kind: 'error' }, detailsState: { kind: 'error' } }); return;
    }
    const publication = typeof room?.billOverrideRequestId === 'string' ? room.billOverrideRequestId : room?.billRequestId;
    // Hai stream đến lệch nhịp: chỉ mở QR khi pointer/revision/paid counter cùng khớp bill hiện hành.
    const matches = room?.status === 'COMPLETED' && room.reconciliationStatus === 'FINALIZED' && member
      && billState.kind === 'published' && billState.bill.roomId === roomId && billState.bill.requestId === publication
      && (billState.bill.billRevision ?? 0) === (room.billRevision ?? 0)
      && (billState.bill.billPaidCount ?? 0) === (room.billPaidCount ?? 0);
    onState({ roomPin: typeof room?.pin === 'string' ? room.pin : '', member,
      billState: matches ? billState : billState.kind === 'error' ? billState : { kind: 'loading' }, detailsState });
  };
  const fail = () => { failed = true; publish(); };
  onState(emptyHistoryPayment());
  if (dependencies.auth.currentUser?.uid !== uid || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId)) { fail(); return () => { active = false; }; }
  const stopRoom = onSnapshot(doc(dependencies.firestore, 'rooms', roomId), { includeMetadataChanges: true }, snapshot => {
    if (!active || failed) return;
    if (!snapshot.exists() && !snapshot.metadata.fromCache) { fail(); return; }
    room = snapshot.exists() && !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites ? snapshot.data() : null;
    publish();
  }, fail);
  const stopMember = onSnapshot(doc(dependencies.firestore, 'rooms', roomId, 'members', uid), { includeMetadataChanges: true }, snapshot => {
    if (!active || failed) return;
    if (!snapshot.exists() && !snapshot.metadata.fromCache) { fail(); return; }
    const data = snapshot.data();
    member = snapshot.exists() && !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites
      && typeof data?.displayName === 'string' && ['ACTIVE', 'EARLY_EXIT'].includes(data.status)
      ? { uid, displayName: data.displayName, status: data.status } : undefined;
    publish();
  }, fail);
  const stopBill = listenToPublishedBill(dependencies.firestore, roomId, state => { billState = state; publish(); });
  const stopDetails = createSettlementDetailsRepository(dependencies).listen(roomId, state => { detailsState = state; publish(); });
  return () => { active = false; stopRoom(); stopMember(); stopBill(); stopDetails(); };
}
