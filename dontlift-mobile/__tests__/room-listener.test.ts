import { listenToRoomLobby } from '../src/features/rooms/room-listener';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...parts: string[]) => ({ kind: 'collection', parts })),
  doc: jest.fn((_db: unknown, ...parts: string[]) => ({ kind: 'doc', parts })),
  onSnapshot: jest.fn(),
  orderBy: jest.fn((field: string, direction: string) => ({ field, direction })),
  query: jest.fn((collectionRef: unknown, order: unknown) => ({ collectionRef, order })),
  Timestamp: class MockTimestamp {
    private readonly mockMillis: number;
    constructor(mockMillis: number) { this.mockMillis = mockMillis; }
    toMillis() { return this.mockMillis; }
    toDate() { return new Date(this.mockMillis); }
  },
}));

const onSnapshotMock = jest.requireMock('firebase/firestore').onSnapshot as jest.Mock;

describe('room lobby listener errors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the lobby in error if the other stream later emits a snapshot', () => {
    const subscriptions: Array<{ next: (snapshot: unknown) => void; error: (error: Error) => void }> = [];
    onSnapshotMock.mockImplementation((_reference: unknown, _options: unknown, next: (snapshot: unknown) => void, error: (error: Error) => void) => {
      subscriptions.push({ next, error });
      return jest.fn();
    });
    const states: Array<{ kind: string; snapshot: { status?: string; members?: unknown[] } | null }> = [];
    listenToRoomLobby({} as never, 'room-1', state => states.push(state));
    const [room, members] = subscriptions;
    room.next({
      exists: () => true,
      data: () => ({ hostId: 'host', status: 'WAITING', participantCount: 1, startedAt: null }),
      metadata: { fromCache: false },
    });
    members.next({ docs: [], metadata: { fromCache: false } });
    expect(states.at(-1)?.kind).toBe('live');

    members.error(new Error('permission denied'));
    expect(states.at(-1)?.kind).toBe('error');

    room.next({
      exists: () => true,
      data: () => ({ hostId: 'host', status: 'ACTIVE', participantCount: 1, startedAt: null }),
      metadata: { fromCache: false },
    });
    expect(states.at(-1)).toMatchObject({
      kind: 'error',
      snapshot: { status: 'ACTIVE', members: [] },
    });
  });

  it('sends complete roster snapshots, including joinedAt, to the local projection', async () => {
    const Timestamp = jest.requireMock('firebase/firestore').Timestamp as new (millis: number) => unknown;
    const subscriptions: Array<{ next: (snapshot: unknown) => void; error: (error: Error) => void }> = [];
    onSnapshotMock.mockImplementation((_reference: unknown, _options: unknown, next: (snapshot: unknown) => void, error: (error: Error) => void) => {
      subscriptions.push({ next, error });
      return jest.fn();
    });
    const persisted: unknown[] = [];
    const persistSnapshot = jest.fn(async (snapshot: unknown) => { persisted.push(snapshot); });
    const time = Date.UTC(2026, 9, 20);
    listenToRoomLobby({} as never, 'room-2', jest.fn(), persistSnapshot);
    const [room, members] = subscriptions;
    room.next({
      exists: () => true,
      data: () => ({
        hostId: 'host', pin: '12345678', status: 'WAITING', participantCount: 1,
        startedAt: null, createdAt: new Timestamp(time), updatedAt: new Timestamp(time),
      }),
      metadata: { fromCache: false },
    });
    members.next({
      docs: [{ id: 'host', data: () => ({
        displayName: 'Host', role: 'HOST', status: 'ACTIVE', penaltyScore: 0,
        liftCount: 0, joinedAt: new Timestamp(time),
      }) }],
      metadata: { fromCache: false },
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(persistSnapshot).toHaveBeenCalledTimes(1);
    expect(persisted[0]).toMatchObject({
      roomId: 'room-2', pin: '12345678', createdAt: new Date(time).toISOString(),
      updatedAt: new Date(time).toISOString(),
      members: [{ uid: 'host', displayName: 'Host', role: 'HOST', joinedAt: new Date(time).toISOString() }],
    });
  });
});
