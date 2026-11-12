export function shouldNavigateToGroupSummary(input: {
  roomId: string;
  roomStatus: string;
  currentScreen: string;
  restoredRoomId: string | null;
}): boolean {
  return input.roomStatus === 'COMPLETED'
    && (input.currentScreen === '06-group-active' || input.roomId === input.restoredRoomId);
}
