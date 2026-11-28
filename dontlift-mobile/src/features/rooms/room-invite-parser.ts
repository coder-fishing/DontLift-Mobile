/** Đọc PIN từ nội dung QR lời mời và giữ nguyên số 0 ở đầu mã. */
export function parseRoomInvitation(value: string): string | null {
  const match = /^dontliftmobile:\/\/room\/(\d{4}|\d{8})$/.exec(value);
  return match?.[1] ?? null;
}
