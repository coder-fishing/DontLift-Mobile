export function encodeRoomInvitation(pin: string): string {
  if (!/^(?:\d{4}|\d{8})$/.test(pin)) throw new Error('invalid-room-pin');
  return `dontliftmobile://room/${pin}`;
}
