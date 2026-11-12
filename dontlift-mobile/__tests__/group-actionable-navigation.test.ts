import { doc, getDocFromServer } from 'firebase/firestore';
import { createRoomRepository } from '../src/features/rooms/room-repository';

jest.mock('firebase/firestore', () => ({
  Timestamp: class { private ms = 0; constructor(ms: number) { this.ms = ms; } toDate() { return new Date(this.ms); } },
  doc: jest.fn((_db, ...parts: string[]) => parts.join('/')),
  getDocFromServer: jest.fn(),
}));

const uid = 'member-1';
const roomId = '10000000-0000-4000-8000-000000000051';
const room = (status: string, reconciliationStatus: string | null = 'FINALIZED') => ({
  exists: () => true, data: () => ({ pin: '00000051', hostId: 'host', status, reconciliationStatus }),
});
const member = (status = 'ACTIVE') => ({ exists: () => true, data: () => ({ status, role: 'MEMBER', displayName: 'Member' }) });
function repository() {
  return createRoomRepository({ firestore: {} as never, auth: { currentUser: { uid } } as never,
    database: Promise.resolve({} as never), randomUUID: () => '20000000-0000-4000-8000-000000000051' });
}

describe('loadMemberRoom for actionable navigation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('loads and validates current membership and active room before resume', async () => {
    jest.mocked(getDocFromServer).mockResolvedValueOnce(room('ACTIVE') as never).mockResolvedValueOnce(member() as never);
    const selected = await repository().loadMemberRoom(roomId, 'ACTIVE');
    expect(doc).toHaveBeenNthCalledWith(1, {}, 'rooms', roomId);
    expect(doc).toHaveBeenNthCalledWith(2, {}, 'rooms', roomId, 'members', uid);
    expect(selected).toMatchObject({ roomId, pin: '00000051', invitation: 'dontliftmobile://room/00000051', hostUid: 'host' });
  });

  test('does not open a stale state or a room after membership is no longer active', async () => {
    jest.mocked(getDocFromServer).mockResolvedValueOnce(room('COMPLETED') as never).mockResolvedValueOnce(member() as never);
    await expect(repository().loadMemberRoom(roomId, 'ACTIVE')).rejects.toMatchObject({ code: 'failed-precondition' });
    jest.mocked(getDocFromServer).mockResolvedValueOnce(room('ACTIVE') as never).mockResolvedValueOnce(member('REMOVED') as never);
    await expect(repository().loadMemberRoom(roomId, 'ACTIVE')).rejects.toMatchObject({ code: 'rejected' });
  });

  test('requires a finalized room for summary and bill destinations', async () => {
    jest.mocked(getDocFromServer).mockResolvedValueOnce(room('COMPLETED', 'PENDING') as never).mockResolvedValueOnce(member() as never);
    await expect(repository().loadMemberRoom(roomId, 'COMPLETED')).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
