import { doc, onSnapshot, Timestamp, type Firestore, type Unsubscribe } from 'firebase/firestore';
import type { TerminationBallot, TerminationVote } from './termination-vote-repository';

export type TerminationVoteState = {
  vote: TerminationVote | null;
  ownBallot: TerminationBallot | null;
  error: boolean;
};

export function listenToTerminationVote(
  firestore: Firestore,
  roomId: string,
  uid: string,
  onState: (state: TerminationVoteState) => void,
): Unsubscribe {
  let vote: TerminationVote | null = null;
  let ownBallot: TerminationBallot | null = null;
  let voteReady = false;
  let ballotReady = false;
  let failed = false;
  let active = true;
  const publish = () => {
    if (active && voteReady && ballotReady) onState({ vote, ownBallot, error: failed });
  };
  onState({ vote: null, ownBallot: null, error: false });
  const stopVote = onSnapshot(doc(firestore, 'rooms', roomId, 'terminationVotes', 'current'), snapshot => {
    if (!active) return;
    const data = snapshot.exists() ? snapshot.data() : null;
    const openedAt = data?.openedAt;
    vote = data ? {
      version: 1,
      roomId,
      voteId: String(data.voteId ?? ''),
      openedAtUtcMs: openedAt instanceof Timestamp ? openedAt.toMillis() : null,
      eligibleVoterCount: Number(data.eligibleVoterCount ?? 0),
      yesVoteCount: Number(data.yesVoteCount ?? 0),
      status: data.status === 'CANCELLED' ? 'CANCELLED' : 'OPEN',
    } : null;
    voteReady = true;
    publish();
  }, () => {
    failed = true;
    voteReady = true;
    publish();
  });
  const stopBallot = onSnapshot(doc(firestore, 'rooms', roomId, 'terminationVotes', 'current', 'ballots', uid), snapshot => {
    if (!active) return;
    const data = snapshot.exists() ? snapshot.data() : null;
    ownBallot = data && (data.choice === 'YES' || data.choice === 'NO')
      ? { voteId: String(data.voteId ?? ''), requestId: String(data.requestId ?? ''), choice: data.choice }
      : null;
    ballotReady = true;
    publish();
  }, () => {
    failed = true;
    ballotReady = true;
    publish();
  });
  return () => { active = false; stopVote(); stopBallot(); };
}
