import { collection, doc, onSnapshot, type Firestore } from 'firebase/firestore';
import type { BillShare, PublishedBill } from './bill-repository';
import type { PublishedBillState } from './published-bill-state';
import { parseSharePayment } from './payment-status-domain';
export type { PublishedBillState } from './published-bill-state';

export function listenToPublishedBill(
  firestore: Firestore,
  roomId: string,
  onState: (state: PublishedBillState) => void,
): () => void {
  const roomRef = doc(firestore, 'rooms', roomId);
  let active = true;
  let failed = false;
  let shareGeneration = 0;
  let unsubscribeShares: (() => void) | undefined;
  let blockedShareRequestId: string | null = null;
  let lastPublishedBill: PublishedBill | null = null;

  const stopShares = () => {
    shareGeneration += 1;
    unsubscribeShares?.();
    unsubscribeShares = undefined;
  };
  const fail = () => {
    if (!active || failed) return;
    // Một stream đã lỗi thì callback còn sót không được biến breakdown cũ thành live.
    failed = true;
    stopShares();
    onState({ kind: 'error' });
  };

  const unsubscribeRoom = onSnapshot(roomRef, { includeMetadataChanges: true }, snapshot => {
    if (!active || failed) return;
    if (!snapshot.exists()) {
      fail();
      return;
    }
    const room = snapshot.data();
    const defaultRequestId = room.billRequestId;
    const overrideRequestId = typeof room.billOverrideRequestId === 'string' ? room.billOverrideRequestId : null;
    const requestId = overrideRequestId ?? defaultRequestId;
    const billPaidCount = room.billPaidCount === undefined ? 0 : room.billPaidCount;
    const published = room.calculationVersion === 1 && typeof requestId === 'string'
      && Number.isSafeInteger(room.totalBillVnd) && Number.isSafeInteger(room.billShareCount);
    if (!published) {
      stopShares();
      onState(snapshot.metadata.fromCache ? { kind: 'loading' } : { kind: 'unpublished' });
      return;
    }

    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
      stopShares();
      onState({ kind: 'cached', bill: null });
      return;
    }

    // Quyền đọc version cũ bị thu hồi ngay khi room đổi pointer; chờ snapshot room mới thay vì dừng listener.
    if (blockedShareRequestId === requestId) {
      onState({ kind: 'error', bill: lastPublishedBill });
      return;
    }
    if (blockedShareRequestId !== null) blockedShareRequestId = null;

    unsubscribeShares?.();
    const generation = ++shareGeneration;
    const sharesPath = overrideRequestId
      ? collection(firestore, 'rooms', roomId, 'billOverrides', overrideRequestId, 'shares')
      : collection(firestore, 'rooms', roomId, 'billShares');
    unsubscribeShares = onSnapshot(
      sharesPath,
      { includeMetadataChanges: true },
      sharesSnapshot => {
        if (!active || failed || generation !== shareGeneration) return;
        const payments = sharesSnapshot.docs.map(shareDoc => parseSharePayment(shareDoc.data()));
        if (payments.some(payment => payment === null)) {
          if (sharesSnapshot.metadata.hasPendingWrites || sharesSnapshot.metadata.fromCache) onState({ kind: 'cached', bill: null });
          else fail();
          return;
        }
        const shares: BillShare[] = sharesSnapshot.docs.map((shareDoc, index) => ({
          uid: shareDoc.id,
          shareVnd: shareDoc.data().shareVnd,
          ...payments[index],
        }));
        if (!Number.isSafeInteger(billPaidCount) || billPaidCount < 0
          || shares.length !== room.billShareCount
          || shares.some(share => !Number.isSafeInteger(share.shareVnd) || share.shareVnd < 0)) {
          if (!sharesSnapshot.metadata.fromCache) fail();
          else onState({ kind: 'cached', bill: null });
          return;
        }
        // Hai stream có thể tới lệch nhịp; chờ room counter và share markers cùng version trước khi báo live.
        if (shares.filter(share => share.paymentStatus === 'MARKED_AS_PAID').length !== billPaidCount) {
          onState({ kind: 'cached', bill: null });
          return;
        }
        const sumShareVnd = shares.reduce((sum, share) => sum + share.shareVnd, 0);
        const bill: PublishedBill = {
          version: 1,
          requestId,
          roomId,
          totalBillVnd: room.totalBillVnd,
          calculationVersion: 1,
          shares: shares.sort((a, b) => a.uid.localeCompare(b.uid)),
          sumShareVnd,
          billRevision: Number.isSafeInteger(room.billRevision) ? room.billRevision : 0,
          billPaidCount,
          overrideApplied: overrideRequestId !== null,
        };
        if (sumShareVnd !== bill.totalBillVnd) {
          if (sharesSnapshot.metadata.fromCache) onState({ kind: 'cached', bill: null });
          else fail();
          return;
        }
        lastPublishedBill = bill;
        onState(sharesSnapshot.metadata.fromCache || sharesSnapshot.metadata.hasPendingWrites
          ? { kind: 'cached', bill } : { kind: 'published', bill });
      },
      error => {
        if (generation !== shareGeneration) return;
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code).replace(/^firestore\//, '') : '';
        if (code === 'permission-denied') {
          // Pointer đã đổi nhưng snapshot room có thể tới sau lỗi permission của share cũ.
          blockedShareRequestId = requestId;
          stopShares();
          onState({ kind: 'error', bill: lastPublishedBill });
          return;
        }
        fail();
      },
    );
  }, fail);

  return () => {
    active = false;
    stopShares();
    unsubscribeRoom();
  };
}
