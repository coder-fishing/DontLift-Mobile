import { rankGroupMembers, type GroupMemberScore } from '../src/features/rooms/group-active-domain';

describe('group active leaderboard', () => {
  const member = (uid: string, penaltyScore: number, liftCount = 0): GroupMemberScore => ({
    uid, displayName: uid, status: 'ACTIVE', penaltyScore, liftCount, violationDurationSeconds: penaltyScore - liftCount * 10,
  });

  it('ranks by actual penalty score and uses UID for stable ties', () => {
    expect(rankGroupMembers([
      member('z-user', 3),
      member('b-user', 10, 1),
      member('a-user', 10, 1),
    ]).map(value => value.uid)).toEqual(['z-user', 'a-user', 'b-user']);
  });

  it('does not include non-active members in the live leaderboard', () => {
    expect(rankGroupMembers([
      member('active', 0),
      { ...member('exited', 2), status: 'EARLY_EXIT' },
    ]).map(value => value.uid)).toEqual(['active']);
  });

  it('can include early-exit members for completed-room sync while preserving score and UID order', () => {
    const exited = { ...member('early', 4), status: 'EARLY_EXIT' };
    expect(rankGroupMembers([
      member('later', 4),
      exited,
      member('lowest', 1),
    ], ['ACTIVE', 'EARLY_EXIT']).map(value => value.uid)).toEqual(['lowest', 'early', 'later']);
  });
});
