import { shouldNavigateToGroupSummary } from '../src/features/rooms/group-terminal-navigation';

const roomId = 'room-1';

test.each([
  ['Host on the active screen', 'COMPLETED', '06-group-active', null, true],
  ['member on the active screen', 'COMPLETED', '06-group-active', null, true],
  ['restored completed room', 'COMPLETED', '02-solo-select', roomId, true],
  ['cancelled room', 'CANCELLED', '06-group-active', null, false],
  ['completed room while viewing another screen', 'COMPLETED', '01-login', null, false],
])('%s routes only a completed active/restored room to Summary', (_label, roomStatus, currentScreen, restoredRoomId, expected) => {
  expect(shouldNavigateToGroupSummary({
    roomId, roomStatus: String(roomStatus), currentScreen: String(currentScreen),
    restoredRoomId: restoredRoomId === null ? null : String(restoredRoomId),
  })).toBe(expected);
});
