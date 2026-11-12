import { shouldNavigateToGroupSummary } from '../src/features/rooms/group-terminal-navigation';

const roomId = 'room-1';

test.each([
  ['Host viewing another tab', 'COMPLETED', null, true, true],
  ['member viewing another tab', 'COMPLETED', null, true, true],
  ['restored completed room', 'COMPLETED', roomId, false, true],
  ['non-member in unrelated screen', 'COMPLETED', null, false, false],
  ['cancelled room member', 'CANCELLED', null, true, false],
])('%s routes only an eligible completed room to Summary', (_label, roomStatus, restoredRoomId, isRoomMember, expected) => {
  expect(shouldNavigateToGroupSummary({
    roomId, roomStatus: String(roomStatus),
    restoredRoomId: restoredRoomId === null ? null : String(restoredRoomId),
    isRoomMember: Boolean(isRoomMember),
  })).toBe(expected);
});
