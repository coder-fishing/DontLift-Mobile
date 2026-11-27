import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { EarlyExitRequest } from './early-exit-repository';
import { listenToOpenEarlyExitRequests } from './early-exit-listener';
import { listenToTerminationVote, type TerminationVoteState } from './termination-vote-listener';

export function useRoomRequestSubscriptions({
  firestore,
  roomId,
  uid,
  setOpenEarlyExitRequests,
  setTerminationVoteState,
  clearEarlyExitError,
  setEarlyExitLoadError,
  clearTerminationVoteError,
}: {
  firestore: Firestore;
  roomId: string | undefined;
  uid: string;
  setOpenEarlyExitRequests: Dispatch<SetStateAction<EarlyExitRequest[]>>;
  setTerminationVoteState: Dispatch<SetStateAction<TerminationVoteState>>;
  clearEarlyExitError: () => void;
  setEarlyExitLoadError: () => void;
  clearTerminationVoteError: () => void;
}) {
  useEffect(() => {
    if (!roomId) return undefined;
    return listenToOpenEarlyExitRequests(
      firestore,
      roomId,
      requests => { setOpenEarlyExitRequests(requests); clearEarlyExitError(); },
      setEarlyExitLoadError,
    );
  }, [firestore, roomId, setOpenEarlyExitRequests, clearEarlyExitError, setEarlyExitLoadError]);

  useEffect(() => {
    if (!roomId) {
      setTerminationVoteState({ vote: null, ownBallot: null, error: false });
      return undefined;
    }
    return listenToTerminationVote(firestore, roomId, uid, state => {
      setTerminationVoteState(state);
      if (!state.error) clearTerminationVoteError();
    });
  }, [firestore, roomId, uid, setTerminationVoteState, clearTerminationVoteError]);
}
