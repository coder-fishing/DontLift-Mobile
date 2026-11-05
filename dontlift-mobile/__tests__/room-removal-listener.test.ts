import { onSnapshot } from 'firebase/firestore';
import { listenToOwnRoomRemoval } from '../src/features/rooms/room-listener';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...parts: string[]) => parts.join('/')),
  onSnapshot: jest.fn(() => jest.fn()),
}));

test('Only confirmed server removal ends membership; cache, pending writes and errors do not', () => {
  const removed = jest.fn();
  const stop = listenToOwnRoomRemoval({} as never, 'room', 'user', removed);
  const [, , publish, failed] = jest.mocked(onSnapshot).mock.calls[0] as unknown as [
    unknown, unknown, (snapshot: unknown) => void, () => void,
  ];
  const snapshot = (exists: boolean, fromCache = false, hasPendingWrites = false) => ({
    exists: () => exists, metadata: { fromCache, hasPendingWrites },
  });
  publish(snapshot(false, true));
  publish(snapshot(false, false, true));
  publish(snapshot(true));
  failed();
  expect(removed).not.toHaveBeenCalled();
  publish(snapshot(false));
  publish(snapshot(false));
  expect(removed).toHaveBeenCalledTimes(1);
  stop();
  expect(onSnapshot).toHaveBeenCalledWith('rooms/room/members/user', expect.any(Object), expect.any(Function), expect.any(Function));
});
