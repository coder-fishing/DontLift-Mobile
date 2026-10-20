import { parseRoomInvitation } from '../src/features/rooms/room-invite-parser';

describe('parseRoomInvitation', () => {
  test('extracts an eight-digit PIN and preserves leading zeroes', () => {
    expect(parseRoomInvitation('dontliftmobile://room/00000042')).toBe('00000042');
  });

  test('accepts legacy four-digit room invitations', () => {
    expect(parseRoomInvitation('dontliftmobile://room/0042')).toBe('0042');
  });

  test.each([
    'https://pay.example/00000042',
    'dontliftmobile://other/00000042',
    'dontliftmobile://room/1234567',
    'dontliftmobile://room/12345678/extra',
    'dontliftmobile://room/12345678?redirect=https://pay.example',
    'dontliftmobile://room/%30%30%30%30',
  ])('rejects QR content outside the canonical invitation contract: %s', value => {
    expect(parseRoomInvitation(value)).toBeNull();
  });
});
