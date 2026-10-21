import { createEarlyExitRepository } from '../src/features/rooms/early-exit-repository';
import { doc, getDocFromServer, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';

jest.mock('firebase/firestore', () => {
  class TestTimestamp {
    constructor(private readonly mockSeconds: number, private readonly mockNanoseconds: number) {}
    toMillis() { return this.mockSeconds * 1000 + this.mockNanoseconds / 1_000_000; }
  }
  return {
    Timestamp: TestTimestamp,
    doc: jest.fn((_database: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    getDocFromServer: jest.fn(),
    runTransaction: jest.fn(),
    serverTimestamp: jest.fn(() => ({ kind: 'server-timestamp' })),
  };
});

type RecordData = Record<string, unknown>;
type Snapshot = { exists: () => boolean; data: () => RecordData };
const roomId = '10000000-0000-4000-8000-000000000018';
const memberUid = 'member-uid';
const hostUid = 'host-uid';
const firstRequestId = '00000000-0000-4000-8000-000000000081';

function makeSnapshot(data?: RecordData): Snapshot {
  return { exists: () => data !== undefined, data: () => data ?? {} };
}

function installTransaction(seed: Record<string, RecordData>) {
  const records = new Map(Object.entries(seed));
  const writes: Array<{ kind: 'set' | 'update'; path: string; data: RecordData }> = [];
  const stamp = new Timestamp(50, 0);
  const resolveTimestamps = (data: RecordData) => Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, (value as { kind?: string })?.kind === 'server-timestamp' ? stamp : value]),
  );
  (runTransaction as jest.Mock).mockImplementation(async (_database: unknown, callback: (transaction: unknown) => Promise<unknown>) => {
    const transaction = {
      get: async (reference: { path: string }) => makeSnapshot(records.get(reference.path)),
      set: (reference: { path: string }, data: RecordData) => writes.push({ kind: 'set', path: reference.path, data }),
      update: (reference: { path: string }, data: RecordData) => writes.push({ kind: 'update', path: reference.path, data }),
    };
    const result = await callback(transaction);
    for (const write of writes) {
      if (write.kind === 'set') records.set(write.path, resolveTimestamps(write.data));
      else records.set(write.path, { ...records.get(write.path), ...resolveTimestamps(write.data) });
    }
    return result;
  });
  (getDocFromServer as jest.Mock).mockImplementation(async (reference: { path: string }) => makeSnapshot(records.get(reference.path)));
  return { records, writes };
}

function roomData() { return { status: 'ACTIVE', hostId: hostUid, activeMemberCount: 2 }; }
function memberData(role: 'HOST' | 'MEMBER', status = 'ACTIVE') {
  return { role, status, earlyExitAt: null, penaltyScore: 0, liftCount: 0, violationDurationSeconds: 0 };
}

describe('early-exit Spark repository', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates one online request with a server timestamp and returns the committed result', async () => {
    const { writes } = installTransaction({
      [`rooms/${roomId}`]: roomData(),
      [`rooms/${roomId}/members/${memberUid}`]: memberData('MEMBER'),
    });
    const repository = createEarlyExitRepository({
      firestore: {} as never, auth: { currentUser: { uid: memberUid } } as never,
    });
    const result = await repository.requestEarlyExit({ roomId, requestId: firstRequestId });
    expect(result).toMatchObject({ version: 1, roomId, requestId: firstRequestId, memberUid, status: 'OPEN' });
    expect(result.requestedAtUtcMs).toBe(50_000);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ kind: 'set', path: `rooms/${roomId}/earlyExitRequests/${memberUid}` });
    expect(serverTimestamp).toHaveBeenCalledTimes(1);
  });

  it('replays the same request without writing a second request', async () => {
    const { writes } = installTransaction({
      [`rooms/${roomId}`]: roomData(),
      [`rooms/${roomId}/members/${memberUid}`]: memberData('MEMBER', 'EARLY_EXIT'),
      [`rooms/${roomId}/earlyExitRequests/${memberUid}`]: {
        requestId: firstRequestId, memberUid, status: 'APPROVED', decision: 'APPROVE',
        requestedAt: new Timestamp(40, 0), decidedAt: new Timestamp(50, 0), cutoffAt: new Timestamp(50, 0),
      },
    });
    const repository = createEarlyExitRepository({ firestore: {} as never, auth: { currentUser: { uid: memberUid } } as never });
    const result = await repository.requestEarlyExit({ roomId, requestId: firstRequestId });
    expect(result.status).toBe('APPROVED');
    expect(result.cutoffUtcMs).toBe(50_000);
    expect(writes).toHaveLength(0);
  });

  it('approves atomically with a server cutoff and updates membership', async () => {
    const { writes, records } = installTransaction({
      [`rooms/${roomId}`]: roomData(),
      [`rooms/${roomId}/members/${hostUid}`]: memberData('HOST'),
      [`rooms/${roomId}/members/${memberUid}`]: memberData('MEMBER'),
      [`rooms/${roomId}/earlyExitRequests/${memberUid}`]: {
        requestId: firstRequestId, memberUid, status: 'OPEN', decision: null,
        requestedAt: new Timestamp(40, 0), decidedBy: null, decidedAt: null, cutoffAt: null,
      },
    });
    const repository = createEarlyExitRepository({ firestore: {} as never, auth: { currentUser: { uid: hostUid } } as never });
    const result = await repository.decideEarlyExit({ roomId, memberUid, requestId: firstRequestId, decision: 'APPROVE' });
    expect(result.status).toBe('APPROVED');
    expect(result.cutoffUtcMs).toBe(50_000);
    expect(writes.map(write => write.path)).toEqual([
      `rooms/${roomId}/earlyExitRequests/${memberUid}`,
      `rooms/${roomId}/members/${memberUid}`,
      `rooms/${roomId}`,
    ]);
    expect(records.get(`rooms/${roomId}/members/${memberUid}`)?.status).toBe('EARLY_EXIT');
  });

  it('removes an exited NO voter and cancels when the remaining ACTIVE roster is unanimous', async () => {
    const votePath = `rooms/${roomId}/terminationVotes/current`;
    const { records, writes } = installTransaction({
      [`rooms/${roomId}`]: roomData(),
      [`rooms/${roomId}/members/${hostUid}`]: memberData('HOST'),
      [`rooms/${roomId}/members/${memberUid}`]: memberData('MEMBER'),
      [`rooms/${roomId}/earlyExitRequests/${memberUid}`]: {
        requestId: firstRequestId, memberUid, status: 'OPEN', decision: null,
        requestedAt: new Timestamp(40, 0), decidedBy: null, decidedAt: null, cutoffAt: null,
      },
      [votePath]: {
        version: 1, voteId: firstRequestId, status: 'OPEN',
        openedAt: new Timestamp(Math.floor(Date.now() / 1000) - 5, 0), eligibleVoterCount: 2, yesVoteCount: 1,
      },
      [`${votePath}/ballots/${memberUid}`]: { voteId: firstRequestId, choice: 'NO' },
    });
    const repository = createEarlyExitRepository({ firestore: {} as never, auth: { currentUser: { uid: hostUid } } as never });

    const result = await repository.decideEarlyExit({ roomId, memberUid, requestId: firstRequestId, decision: 'APPROVE' });

    expect(result.status).toBe('APPROVED');
    expect(records.get(votePath)).toMatchObject({ eligibleVoterCount: 1, yesVoteCount: 1, status: 'CANCELLED' });
    expect(records.get(`rooms/${roomId}`)).toMatchObject({ activeMemberCount: 1, status: 'CANCELLED' });
    expect(writes.map(write => write.path)).toContain(votePath);
  });

  it('replays the same committed decision after the room and Host are no longer active', async () => {
    const { writes } = installTransaction({
      [`rooms/${roomId}`]: { ...roomData(), status: 'COMPLETED' },
      [`rooms/${roomId}/members/${hostUid}`]: memberData('HOST', 'INACTIVE'),
      [`rooms/${roomId}/members/${memberUid}`]: memberData('MEMBER', 'EARLY_EXIT'),
      [`rooms/${roomId}/earlyExitRequests/${memberUid}`]: {
        requestId: firstRequestId, memberUid, status: 'APPROVED', decision: 'APPROVE',
        requestedAt: new Timestamp(40, 0), decidedAt: new Timestamp(50, 0), cutoffAt: new Timestamp(50, 0),
      },
    });
    const repository = createEarlyExitRepository({ firestore: {} as never, auth: { currentUser: { uid: hostUid } } as never });

    const result = await repository.decideEarlyExit({ roomId, memberUid, requestId: firstRequestId, decision: 'APPROVE' });

    expect(result).toMatchObject({ status: 'APPROVED', decision: 'APPROVE', cutoffUtcMs: 50_000 });
    expect(writes).toHaveLength(0);
  });

  it('does not replay a committed decision for a different decision', async () => {
    const { writes } = installTransaction({
      [`rooms/${roomId}`]: { ...roomData(), status: 'COMPLETED' },
      [`rooms/${roomId}/members/${hostUid}`]: memberData('HOST', 'INACTIVE'),
      [`rooms/${roomId}/members/${memberUid}`]: memberData('MEMBER', 'EARLY_EXIT'),
      [`rooms/${roomId}/earlyExitRequests/${memberUid}`]: {
        requestId: firstRequestId, memberUid, status: 'APPROVED', decision: 'APPROVE',
        requestedAt: new Timestamp(40, 0), decidedAt: new Timestamp(50, 0), cutoffAt: new Timestamp(50, 0),
      },
    });
    const repository = createEarlyExitRepository({ firestore: {} as never, auth: { currentUser: { uid: hostUid } } as never });

    await expect(repository.decideEarlyExit({ roomId, memberUid, requestId: firstRequestId, decision: 'DENY' }))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    expect(writes).toHaveLength(0);
  });

  it('maps malformed IDs and Firestore authorization failures to stable errors', async () => {
    const repository = createEarlyExitRepository({ firestore: {} as never, auth: { currentUser: { uid: memberUid } } as never });
    await expect(repository.requestEarlyExit({ roomId, requestId: 'bad-id' }))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    installTransaction({ [`rooms/${roomId}`]: roomData(), [`rooms/${roomId}/members/${memberUid}`]: memberData('MEMBER') });
    (runTransaction as jest.Mock).mockRejectedValueOnce({ code: 'firestore/permission-denied' });
    await expect(repository.requestEarlyExit({ roomId, requestId: firstRequestId }))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });
});
