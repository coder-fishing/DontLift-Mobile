import { toQR } from 'toqr';
import { encodeRoomInvitation } from '../src/features/rooms/room-invite-contract';

describe('room invitation QR contract', () => {
  test('preserves all eight digits including leading zeros in the canonical URI', () => {
    const invitation = encodeRoomInvitation('00000007');
    expect(invitation).toBe('dontliftmobile://room/00000007');

    const matrix = toQR(Uint8Array.from(invitation, character => character.charCodeAt(0)));
    expect(Math.sqrt(matrix.length)).toBeGreaterThanOrEqual(21);
    expect(matrix.every((module) => module === 0 || module === 1)).toBe(true);
  });

  test('rejects malformed PIN values before QR encoding', () => {
    expect(() => encodeRoomInvitation('0000007')).toThrow('invalid-room-pin');
    expect(() => encodeRoomInvitation('0000000a')).toThrow('invalid-room-pin');
  });
});
