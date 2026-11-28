/** Tạo deeplink lời mời từ PIN để mã hóa vào QR tham gia phòng. */
export function encodeRoomInvitation(pin: string): string {
  if (!/^(?:\d{4}|\d{8})$/.test(pin)) throw new Error('invalid-room-pin');
  return `dontliftmobile://room/${pin}`;
}
