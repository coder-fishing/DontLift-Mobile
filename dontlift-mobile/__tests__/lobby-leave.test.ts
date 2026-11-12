import { createLobbyLeaveRepository } from '../src/features/rooms/lobby-leave-repository';
import { getDocFromServer, getDocsFromServer, runTransaction, Timestamp } from 'firebase/firestore';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...parts: string[]) => ({ path: parts.join('/') })),
  collection: jest.fn(), getDocFromServer: jest.fn(), getDocsFromServer: jest.fn(), runTransaction: jest.fn(),
  serverTimestamp: () => 'SERVER_TIME',
  Timestamp: class { ms: number; constructor(ms: number) { this.ms = ms; } toMillis() { return this.ms; } },
}));

function setup({ role = 'HOST', count = 3, status = 'WAITING', missing = false } = {}) {
  const snapshot = (data: Record<string, unknown>, exists = true) => ({ exists: () => exists, data: () => data });
  const update = jest.fn();
  const remove = jest.fn();
  const cleanup = jest.fn();
  jest.mocked(getDocFromServer).mockResolvedValue(snapshot({ role }, !missing) as never);
  jest.mocked(getDocsFromServer).mockResolvedValue({ size: 3, docs: [
    { id: 'host', data: () => ({ status: 'ACTIVE', joinedAt: new Timestamp(0, 0) }) },
    { id: 'later', ref: { path: 'rooms/room/members/later' }, data: () => ({ status: 'ACTIVE', joinedAt: new Timestamp(20, 0) }) },
    { id: 'first', ref: { path: 'rooms/room/members/first' }, data: () => ({ status: 'ACTIVE', joinedAt: new Timestamp(10, 0) }) },
  ] } as never);
  jest.mocked(runTransaction).mockImplementation(async (_db, operation) => operation({
    get: async (ref: { path: string }) => ref.path === 'rooms/room'
      ? snapshot({ hostId: role === 'HOST' ? 'host' : 'another-host', count, participantCount: count, status })
      : snapshot({ role: ref.path.endsWith('/host') ? role : 'MEMBER', status: 'ACTIVE' }),
    update, delete: remove,
  } as never) as never);
  const repository = createLobbyLeaveRepository({ firestore: {} as never,
    auth: { currentUser: { uid: 'host' } } as never, database: Promise.resolve({ runAsync: cleanup } as never) });
  return { repository, update, remove, cleanup };
}

beforeEach(() => jest.clearAllMocks());

test('Host passes authority to earliest remaining member in the transaction', async () => {
  const { repository, update, remove } = setup();
  await repository.leave('room');
  expect(update).toHaveBeenCalledWith({ path: 'rooms/room/members/first' }, { role: 'HOST' });
  expect(update).toHaveBeenCalledWith({ path: 'rooms/room' }, expect.objectContaining({ hostId: 'first', participantCount: 2 }));
  expect(remove).toHaveBeenCalledWith({ path: 'rooms/room/members/host' });
});
test('Member leaves without enumerating the roster or changing Host', async () => {
  const { repository, update } = setup({ role: 'MEMBER', count: 2 });
  await repository.leave('room');
  expect(getDocsFromServer).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledWith({ path: 'rooms/room' }, expect.objectContaining({ hostId: 'another-host', participantCount: 1 }));
});
test('A room that started during confirmation cannot be left through the lobby', async () => {
  const { repository, update, cleanup } = setup({ status: 'ACTIVE' });
  await expect(repository.leave('room')).rejects.toThrow('already started');
  expect(update).not.toHaveBeenCalled();
  expect(cleanup).not.toHaveBeenCalled();
});
test('Changed roster requires retry without mutation', async () => {
  const { repository, update } = setup({ count: 4 });
  await expect(repository.leave('room')).rejects.toThrow('member list changed');
  expect(update).not.toHaveBeenCalled();
});
test('Missing membership confirms retry and repairs only local membership', async () => {
  const { repository, cleanup } = setup({ missing: true });
  await repository.leave('room');
  expect(runTransaction).not.toHaveBeenCalled();
  expect(cleanup).toHaveBeenCalledWith(expect.any(String), 'room', 'host');
});
test('Last Host cancels the waiting room with zero members', async () => {
  const { repository, update } = setup({ count: 1 });
  await repository.leave('room');
  expect(update).toHaveBeenCalledWith({ path: 'rooms/room' }, expect.objectContaining({ participantCount: 0, status: 'CANCELLED', endedAt: 'SERVER_TIME' }));
});
test('A connection failure keeps the local room membership intact', async () => {
  const { repository, cleanup } = setup();
  jest.mocked(getDocFromServer).mockRejectedValueOnce(new Error('offline'));
  await expect(repository.leave('room')).rejects.toThrow('offline');
  expect(cleanup).not.toHaveBeenCalled();
});

test('Host removes a Member and decrements the count atomically', async () => {
  const { repository, update, remove, cleanup } = setup();
  await repository.removeMember('room', 'first');
  expect(update).toHaveBeenCalledWith({ path: 'rooms/room' }, { participantCount: 2, lastKickUid: 'first', updatedAt: 'SERVER_TIME' });
  expect(remove).toHaveBeenCalledWith({ path: 'rooms/room/members/first' });
  expect(cleanup).not.toHaveBeenCalled();
});
test('Member cannot remove another Member', async () => {
  const { repository, update, remove } = setup({ role: 'MEMBER' });
  await expect(repository.removeMember('room', 'first')).rejects.toThrow('Only the current host');
  expect(update).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
test('Host cannot remove themselves or remove members from an active session', async () => {
  const { repository, update } = setup({ status: 'ACTIVE' });
  await expect(repository.removeMember('room', 'host')).rejects.toThrow('Leave Room');
  await expect(repository.removeMember('room', 'first')).rejects.toThrow('before the session starts');
  expect(update).not.toHaveBeenCalled();
});
