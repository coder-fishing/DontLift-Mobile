import { mapRoomCreateError, roomCreateErrorMessage, RoomCreateError } from '../src/features/rooms/room-create-error';

test('permission denial at the clock probe points to cloud access configuration', () => {
  const error = mapRoomCreateError({ code: 'firestore/permission-denied', message: 'private data' }, 'clock-write');
  expect(error.code).toBe('rejected');
  expect(error.firebaseCode).toBe('permission-denied');
  expect(error.stage).toBe('clock-write');
  expect(roomCreateErrorMessage(error)).toContain('Rules');
  expect(roomCreateErrorMessage(error)).not.toContain('private data');
});

test('transaction denial does not claim that a PIN collision or missing deployment is proven', () => {
  const error = mapRoomCreateError({ code: 'permission-denied' }, 'transaction');
  expect(roomCreateErrorMessage(error)).toContain('giao dịch');
  expect(error.stage).toBe('transaction');
});

test('quota exhaustion retains its specific message', () => {
  expect(roomCreateErrorMessage(new RoomCreateError('quota-exhausted'))).toContain('7/month');
});

test('unknown SDK errors do not expose arbitrary error data', () => {
  const error = mapRoomCreateError({ code: 'secret-value', message: 'private data' }, 'clock-read');
  expect(error.firebaseCode).toBeUndefined();
  expect(roomCreateErrorMessage(error)).not.toContain('private data');
});
