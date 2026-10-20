/** Trả PIN nguyên dạng để không làm mất số 0 ở đầu lời mời. */
export function parseRoomInvitation(value: string): string | null {
  const match = /^dontliftmobile:\/\/room\/(\d{4}|\d{8})$/.exec(value);
  return match?.[1] ?? null;
}
