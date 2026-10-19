export function encodeRoomInvitation(pin: string): string {
  if (!/^\d{4}$/.test(pin)) throw new Error('invalid-room-pin');
  return `dontliftmobile://room/${pin}`;
}
