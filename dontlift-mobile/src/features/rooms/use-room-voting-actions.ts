import { useCallback, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { createEarlyExitRepository, EarlyExitError, type EarlyExitDecision, type EarlyExitRequest } from './early-exit-repository';
import { createTerminationVoteRepository, TerminationVoteError, type TerminationChoice } from './termination-vote-repository';
import type { TerminationVoteState } from './termination-vote-listener';

type EarlyExitRepository = ReturnType<typeof createEarlyExitRepository>;
type TerminationVoteRepository = ReturnType<typeof createTerminationVoteRepository>;

function earlyExitErrorMessage(error: unknown): string {
  if (!(error instanceof EarlyExitError)) return 'Could not complete the early-exit action. Try again.';
  switch (error.code) {
    case 'unauthenticated': return 'Your sign-in expired. Sign in again and retry.';
    case 'invalid-argument': return 'The early-exit request is invalid.';
    case 'not-found': return 'This room or request no longer exists.';
    case 'failed-precondition': return 'The room or request is no longer in a state that allows this action.';
    case 'permission-denied': return 'Firebase rejected this action. Confirm the room role and deployed Firestore Rules.';
    case 'unavailable': return 'Connect to Firebase and retry. No offline command was queued.';
    case 'already-exists': return 'This request ID was already used for another request.';
    default: return 'Could not complete the early-exit action. Try again.';
  }
}

/** Xử lý yêu cầu rời sớm, quyết định của Host và các thao tác mở/gửi phiếu kết thúc. */
export function useRoomVotingActions({
  roomId,
  earlyExitRepository,
  terminationVoteRepository,
  terminationVoteState,
}: {
  roomId: string | undefined;
  earlyExitRepository: EarlyExitRepository;
  terminationVoteRepository: TerminationVoteRepository;
  terminationVoteState: TerminationVoteState;
}) {
  const [isRequestingEarlyExit, setIsRequestingEarlyExit] = useState(false);
  const [decidingEarlyExit, setDecidingEarlyExit] = useState<{ requestId: string; decision: EarlyExitDecision } | null>(null);
  const [earlyExitError, setEarlyExitError] = useState<string>();
  const [isOpeningTerminationVote, setIsOpeningTerminationVote] = useState(false);
  const [isCastingTerminationVote, setIsCastingTerminationVote] = useState(false);
  const [terminationVoteError, setTerminationVoteError] = useState<string>();
  const pendingVoteOpen = useRef<{ roomId: string; requestId: string } | null>(null);
  const pendingBallot = useRef<{ roomId: string; voteId: string; requestId: string; choice: TerminationChoice } | null>(null);
  const pendingEarlyExit = useRef<{ roomId: string; requestId: string } | null>(null);
  const clearEarlyExitError = useCallback(() => setEarlyExitError(undefined), []);
  const setEarlyExitLoadError = useCallback(() => {
    setEarlyExitError('Could not load early-exit requests. Reopen the room while connected to retry.');
  }, []);
  const clearTerminationVoteError = useCallback(() => setTerminationVoteError(undefined), []);

  const handleRequestEarlyExit = async () => {
    if (!roomId || isRequestingEarlyExit) return;
    setIsRequestingEarlyExit(true);
    setEarlyExitError(undefined);
    const pending = pendingEarlyExit.current?.roomId === roomId
      ? pendingEarlyExit.current
      : { roomId, requestId: Crypto.randomUUID() };
    pendingEarlyExit.current = pending;
    try {
      await earlyExitRepository.requestEarlyExit({ roomId, requestId: pending.requestId });
      pendingEarlyExit.current = null;
    } catch (error) {
      if (!(error instanceof EarlyExitError) || error.code !== 'unavailable') pendingEarlyExit.current = null;
      setEarlyExitError(earlyExitErrorMessage(error));
    } finally {
      setIsRequestingEarlyExit(false);
    }
  };

  const handleDecideEarlyExit = async (request: EarlyExitRequest, decision: EarlyExitDecision) => {
    if (!roomId || decidingEarlyExit) return;
    setDecidingEarlyExit({ requestId: request.requestId, decision });
    setEarlyExitError(undefined);
    try {
      await earlyExitRepository.decideEarlyExit({
        roomId,
        memberUid: request.memberUid,
        requestId: request.requestId,
        decision,
      });
    } catch (error) {
      setEarlyExitError(earlyExitErrorMessage(error));
    } finally {
      setDecidingEarlyExit(null);
    }
  };

  const handleOpenTerminationVote = async () => {
    if (!roomId || isOpeningTerminationVote) return;
    setIsOpeningTerminationVote(true);
    setTerminationVoteError(undefined);
    const pending = pendingVoteOpen.current?.roomId === roomId
      ? pendingVoteOpen.current
      : { roomId, requestId: Crypto.randomUUID() };
    pendingVoteOpen.current = pending;
    try {
      await terminationVoteRepository.open(pending);
      pendingVoteOpen.current = null;
    } catch (error) {
      if (!(error instanceof TerminationVoteError) || error.code !== 'unavailable') pendingVoteOpen.current = null;
      setTerminationVoteError(error instanceof TerminationVoteError && error.code === 'permission-denied'
        ? 'Could not start a new vote. The current vote may still be open; wait and try again.'
        : 'Could not start the vote. Reconnect and try again.');
    } finally {
      setIsOpeningTerminationVote(false);
    }
  };

  const handleCastTerminationVote = async (choice: TerminationChoice) => {
    if (!roomId || !terminationVoteState.vote || isCastingTerminationVote) return;
    setIsCastingTerminationVote(true);
    setTerminationVoteError(undefined);
    const currentVote = terminationVoteState.vote;
    const pending = pendingBallot.current?.roomId === roomId
      && pendingBallot.current.voteId === currentVote.voteId
      && pendingBallot.current.choice === choice
      ? pendingBallot.current
      : { roomId, voteId: currentVote.voteId, requestId: Crypto.randomUUID(), choice };
    pendingBallot.current = pending;
    try {
      await terminationVoteRepository.cast(pending);
      pendingBallot.current = null;
    } catch (error) {
      if (!(error instanceof TerminationVoteError) || error.code !== 'unavailable') pendingBallot.current = null;
      setTerminationVoteError(error instanceof TerminationVoteError && error.code === 'permission-denied'
        ? 'Your vote was not accepted. The voting window may have ended; check the room and try again.'
        : 'Could not submit your vote. Reconnect and try again.');
    } finally {
      setIsCastingTerminationVote(false);
    }
  };

  return {
    isRequestingEarlyExit, decidingEarlyExit, earlyExitError,
    isOpeningTerminationVote, isCastingTerminationVote, terminationVoteError,
    clearEarlyExitError, setEarlyExitLoadError, clearTerminationVoteError,
    handleRequestEarlyExit, handleDecideEarlyExit, handleOpenTerminationVote, handleCastTerminationVote,
  };
}
