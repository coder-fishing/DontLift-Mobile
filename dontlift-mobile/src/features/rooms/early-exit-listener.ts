import {
  collection, onSnapshot, query, where, type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import type { EarlyExitRequest } from './early-exit-repository';

export function listenToOpenEarlyExitRequests(
  firestore: Firestore,
  roomId: string,
  onRequests: (requests: EarlyExitRequest[]) => void,
  onError: () => void,
): Unsubscribe {
  const requestsQuery = query(
    collection(firestore, 'rooms', roomId, 'earlyExitRequests'),
    where('status', '==', 'OPEN'),
  );
  return onSnapshot(requestsQuery, snapshot => {
    onRequests(snapshot.docs.map(requestDoc => {
      const data = requestDoc.data();
      const requestedAt = data.requestedAt;
      return {
        requestId: String(data.requestId ?? ''),
        memberUid: requestDoc.id,
        status: 'OPEN',
        decision: null,
        requestedAtUtcMs: requestedAt && typeof requestedAt.toMillis === 'function' ? requestedAt.toMillis() : null,
        decidedAtUtcMs: null,
        cutoffUtcMs: null,
      };
    }));
  }, onError);
}
