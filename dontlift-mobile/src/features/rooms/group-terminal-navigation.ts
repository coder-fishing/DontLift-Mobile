/** Chỉ cho phép mở tổng kết khi phòng đã hoàn tất và người dùng còn quyền xem. */
export function shouldNavigateToGroupSummary(input: {
  roomId: string;
  roomStatus: string;
  restoredRoomId: string | null;
  isRoomMember: boolean;
}): boolean {
  return input.roomStatus === 'COMPLETED'
    && (input.isRoomMember || input.roomId === input.restoredRoomId);
}
