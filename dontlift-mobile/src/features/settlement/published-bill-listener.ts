import { collection, doc, onSnapshot, type Firestore } from 'firebase/firestore';
import type { BillShare, PublishedBill } from './bill-repository';
import type { PublishedBillState } from './published-bill-state';
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
    const requestId = room.billRequestId;
    const published = room.calculationVersion === 1 && typeof requestId === 'string'
      && Number.isSafeInteger(room.totalBillVnd) && Number.isSafeInteger(room.billShareCount);
    if (!published) {
      stopShares();
      onState(snapshot.metadata.fromCache ? { kind: 'loading' } : { kind: 'unpublished' });
      return;
    }

    if (snapshot.metadata.fromCache) {
      stopShares();
      onState({ kind: 'cached', bill: null });
      return;
    }

    unsubscribeShares?.();
    const generation = ++shareGeneration;
    unsubscribeShares = onSnapshot(
      collection(firestore, 'rooms', roomId, 'billShares'),
      { includeMetadataChanges: true },
      sharesSnapshot => {
        if (!active || failed || generation !== shareGeneration) return;
        const shares: BillShare[] = sharesSnapshot.docs.map(shareDoc => ({
          uid: shareDoc.id,
          shareVnd: shareDoc.data().shareVnd,
        }));
        if (shares.length !== room.billShareCount
          || shares.some(share => !Number.isSafeInteger(share.shareVnd) || share.shareVnd < 0)) {
          if (!sharesSnapshot.metadata.fromCache) fail();
          else onState({ kind: 'cached', bill: null });
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
        };
        if (sumShareVnd !== bill.totalBillVnd) {
          if (sharesSnapshot.metadata.fromCache) onState({ kind: 'cached', bill: null });
          else fail();
          return;
        }
        onState(sharesSnapshot.metadata.fromCache ? { kind: 'cached', bill } : { kind: 'published', bill });
      },
      () => {
        if (generation === shareGeneration) fail();
      },
    );
  }, fail);

  return () => {
    active = false;
    stopShares();
    unsubscribeRoom();
  };
}
