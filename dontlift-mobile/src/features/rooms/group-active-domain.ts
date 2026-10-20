export type GroupMemberScore = {
  uid: string;
  displayName: string;
  status: string;
  penaltyScore: number;
  liftCount: number;
  violationDurationSeconds: number;
};

// Server member score là nguồn xếp hạng; UID tạo thứ tự ổn định khi hòa điểm.
export function rankGroupMembers(members: readonly GroupMemberScore[]): GroupMemberScore[] {
  return members
    .filter(member => member.status === 'ACTIVE')
    .slice()
    .sort((left, right) => left.penaltyScore - right.penaltyScore
      || (left.uid < right.uid ? -1 : left.uid > right.uid ? 1 : 0));
}
