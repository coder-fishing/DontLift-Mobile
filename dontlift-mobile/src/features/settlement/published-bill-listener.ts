import { collection, doc, onSnapshot, type Firestore } from 'firebase/firestore';
import type { BillShare, PublishedBill } from './bill-repository';

export type PublishedBillState =
  | { kind: 'loading' }
  | { kind: 'unpublished' }
  | { kind: 'cached'; bill: PublishedBill | null }
  | { kind: 'published'; bill: PublishedBill }
  | { kind: 'error' };

export function listenToPublishedBill(
  firestore: Firestore,
  roomId: string,
  onState: (state: PublishedBillState) => void,
): () => void {
  const roomRef = doc(firestore, 'rooms', roomId);
  let active = true;
  let shareGeneration = 0;
  let unsubscribeShares: (() => void) | undefined;

  const unsubscribeRoom = onSnapshot(roomRef, { includeMetadataChanges: true }, snapshot => {
    if (!active) return;
    if (!snapshot.exists()) {
      onState({ kind: 'error' });
      return;
    }
    const room = snapshot.data();
    const requestId = room.billRequestId;
    const published = room.calculationVersion === 1 && typeof requestId === 'string'
      && Number.isSafeInteger(room.totalBillVnd) && Number.isSafeInteger(room.billShareCount);
    if (!published) {
      shareGeneration += 1;
      unsubscribeShares?.();
      unsubscribeShares = undefined;
      onState(snapshot.metadata.fromCache ? { kind: 'loading' } : { kind: 'unpublished' });
      return;
    }

    if (snapshot.metadata.fromCache) {
      onState({ kind: 'cached', bill: null });
      return;
    }

    unsubscribeShares?.();
    const generation = ++shareGeneration;
    unsubscribeShares = onSnapshot(
      collection(firestore, 'rooms', roomId, 'billShares'),
      { includeMetadataChanges: true },
      sharesSnapshot => {
        if (!active || generation !== shareGeneration) return;
        const shares: BillShare[] = sharesSnapshot.docs.map(shareDoc => ({
          uid: shareDoc.id,
          shareVnd: shareDoc.data().shareVnd,
        }));
        if (shares.length !== room.billShareCount
          || shares.some(share => !Number.isSafeInteger(share.shareVnd) || share.shareVnd < 0)) {
          if (!sharesSnapshot.metadata.fromCache) onState({ kind: 'error' });
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
          onState(sharesSnapshot.metadata.fromCache ? { kind: 'cached', bill: null } : { kind: 'error' });
          return;
        }
        onState(sharesSnapshot.metadata.fromCache ? { kind: 'cached', bill } : { kind: 'published', bill });
      },
      () => {
        if (active && generation === shareGeneration) onState({ kind: 'error' });
      },
    );
  }, () => {
    if (active) onState({ kind: 'error' });
  });

  return () => {
    active = false;
    shareGeneration += 1;
    unsubscribeShares?.();
    unsubscribeRoom();
  };
}
