import { createBillRepository, BillRepositoryError } from '../src/features/settlement/bill-repository';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_firestore: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  doc: jest.fn((_firestore: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  getDocFromServer: jest.fn(),
  getDocsFromServer: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIME'),
  Timestamp: class FakeTimestamp {
    seconds: number;
    constructor(value: number) { this.seconds = value; }
  },
}));

type StoredDocument = Record<string, unknown>;
type Reference = { path: string };
type Snapshot = { id: string; exists: () => boolean; data: () => StoredDocument | undefined };
type PendingWrite = { kind: 'set' | 'update'; ref: Reference; data: StoredDocument };

const firestoreApi = jest.requireMock('firebase/firestore') as {
  getDocFromServer: jest.Mock;
  getDocsFromServer: jest.Mock;
  runTransaction: jest.Mock;
  Timestamp: new (seconds: number) => object;
};
const ROOM_ID = '10000000-0000-4000-8000-000000000024';

function snapshot(path: string, data: StoredDocument | undefined): Snapshot {
  return { id: path.split('/').at(-1) ?? '', exists: () => data !== undefined, data: () => data };
}

function seedStore(memberCount: number) {
  const FakeTimestamp = firestoreApi.Timestamp;
  const documents = new Map<string, StoredDocument>([
    [`rooms/${ROOM_ID}`, {
      hostId: 'host', status: 'COMPLETED', reconciliationStatus: 'FINALIZED',
      participantCount: memberCount, endedAt: new FakeTimestamp(1_800_000_000),
    }],
    [`rooms/${ROOM_ID}/members/host`, { role: 'HOST', status: 'ACTIVE', penaltyScore: 0 }],
    [`rooms/${ROOM_ID}/settlementDetails/current`, { expiresAt: new FakeTimestamp(1_900_000_000) }],
  ]);
  const uids = ['host', ...Array.from({ length: memberCount - 1 }, (_, index) => `member-${String(index).padStart(3, '0')}`)];
  for (const uid of uids.slice(1)) {
    documents.set(`rooms/${ROOM_ID}/members/${uid}`, { role: 'MEMBER', status: 'ACTIVE', penaltyScore: 0 });
  }
  return { documents, uids };
}

function installTransactions(documents: Map<string, StoredDocument>, failAtCall?: number) {
  firestoreApi.getDocFromServer.mockImplementation(async (ref: Reference) => snapshot(ref.path, documents.get(ref.path)));
  firestoreApi.getDocsFromServer.mockImplementation(async (ref: Reference) => {
    const prefix = `${ref.path}/`;
    const docs = [...documents.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([path, data]) => snapshot(path, data));
    return { size: docs.length, docs };
  });
  const writeSizes: number[] = [];
  let calls = 0;
  firestoreApi.runTransaction.mockImplementation(async (_firestore: unknown, callback: (tx: unknown) => Promise<unknown>) => {
    calls += 1;
    const writes: PendingWrite[] = [];
    const transaction = {
      get: async (ref: Reference) => snapshot(ref.path, documents.get(ref.path)),
      set: (ref: Reference, data: StoredDocument) => writes.push({ kind: 'set', ref, data }),
      update: (ref: Reference, data: StoredDocument) => writes.push({ kind: 'update', ref, data }),
    };
    const result = await callback(transaction);
    writeSizes.push(writes.length);
    if (calls === failAtCall) throw Object.assign(new Error('network interrupted'), { code: 'unavailable' });
    for (const write of writes) {
      if (write.kind === 'set') documents.set(write.ref.path, write.data);
      else documents.set(write.ref.path, { ...documents.get(write.ref.path), ...write.data });
    }
    return result;
  });
  return { writeSizes, get calls() { return calls; } };
}

describe('bill repository chunked publication', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resumes when the first share chunk fails after the preparation lock commits', async () => {
    const { documents, uids } = seedStore(2);
    installTransactions(documents, 2);
    const repository = createBillRepository({
      firestore: {} as never,
      auth: { currentUser: { uid: 'host' } } as never,
      createId: () => '40000000-0000-4000-8000-000000000004',
    });
    const command = {
      version: 1 as const, requestId: '40000000-0000-4000-8000-000000000004', roomId: ROOM_ID, totalBillVnd: 2_000,
    };

    await expect(repository.publish(command, uids)).rejects.toMatchObject({ code: 'unavailable' });
    expect(documents.get(`rooms/${ROOM_ID}/billPreparations/current`)?.status).toBe('PREPARING');

    firestoreApi.runTransaction.mockReset();
    installTransactions(documents);
    await expect(repository.publish(command, uids)).resolves.toMatchObject({ requestId: command.requestId, sumShareVnd: 2_000 });
  });

  it('resumes a partially staged large roster and publishes through chunks of at most eight', async () => {
    const { documents, uids } = seedStore(25);
    const transactions = installTransactions(documents, 3);
    const repository = createBillRepository({
      firestore: {} as never,
      auth: { currentUser: { uid: 'host' } } as never,
      createId: () => '40000000-0000-4000-8000-000000000001',
    });
    const firstCommand = {
      version: 1 as const, requestId: '40000000-0000-4000-8000-000000000001', roomId: ROOM_ID, totalBillVnd: 25_000,
    };

    await expect(repository.publish(firstCommand, uids)).rejects.toMatchObject({ code: 'unavailable' });
    expect(documents.get(`rooms/${ROOM_ID}/billPreparations/current`)?.status).toBe('PREPARING');
    expect([...documents.keys()].filter(path => path.startsWith(`rooms/${ROOM_ID}/billShares/`))).toHaveLength(8);

    firestoreApi.runTransaction.mockReset();
    const resumed = installTransactions(documents);
    const result = await repository.publish({ ...firstCommand, requestId: '40000000-0000-4000-8000-000000000002' }, uids);

    expect(result.requestId).toBe(firstCommand.requestId);
    expect(result.shares).toHaveLength(25);
    expect(result.sumShareVnd).toBe(25_000);
    expect(resumed.writeSizes.every(size => size <= 8)).toBe(true);
    expect(documents.get(`rooms/${ROOM_ID}`)?.calculationVersion).toBe(1);
    expect(documents.get(`rooms/${ROOM_ID}/billPreparations/current`)?.status).toBe('PUBLISHED');
    expect(documents.get(`rooms/${ROOM_ID}/billCommands/${firstCommand.requestId}`)?.shareCount).toBe(25);
  });

  it('rejects a different amount while resuming an existing preparation', async () => {
    const { documents, uids } = seedStore(2);
    documents.set(`rooms/${ROOM_ID}`, {
      ...documents.get(`rooms/${ROOM_ID}`),
      billRequestId: '40000000-0000-4000-8000-000000000001',
      totalBillVnd: 10_000,
      billShareCount: 2,
      billPreparationStartedAt: 'SERVER_TIME',
    });
    documents.set(`rooms/${ROOM_ID}/billPreparations/current`, {
      status: 'PREPARING', requestId: '40000000-0000-4000-8000-000000000001', hostUid: 'host',
      roomId: ROOM_ID, totalBillVnd: 10_000, shareCount: 2,
      shareUids: ['host', 'member-000'], sumShareVnd: 10_000,
    });
    installTransactions(documents);
    const repository = createBillRepository({
      firestore: {} as never,
      auth: { currentUser: { uid: 'host' } } as never,
    });

    await expect(repository.publish({
      version: 1, requestId: '40000000-0000-4000-8000-000000000002', roomId: ROOM_ID, totalBillVnd: 12_000,
    }, uids)).rejects.toBeInstanceOf(BillRepositoryError);
  });

  it('fails closed when a staged share conflicts with the frozen allocation', async () => {
    const { documents, uids } = seedStore(2);
    documents.set(`rooms/${ROOM_ID}`, {
      ...documents.get(`rooms/${ROOM_ID}`), billRequestId: '40000000-0000-4000-8000-000000000005',
      totalBillVnd: 2_000, billShareCount: 2, billPreparationStartedAt: 'SERVER_TIME',
    });
    documents.set(`rooms/${ROOM_ID}/billPreparations/current`, {
      status: 'PREPARING', requestId: '40000000-0000-4000-8000-000000000005', hostUid: 'host',
      roomId: ROOM_ID, totalBillVnd: 2_000, shareCount: 2, shareUids: ['host', 'member-000'], sumShareVnd: 2_000,
    });
    documents.set(`rooms/${ROOM_ID}/billShares/host`, {
      uid: 'host', shareVnd: 1_999, requestId: '40000000-0000-4000-8000-000000000005',
    });
    installTransactions(documents);
    const repository = createBillRepository({
      firestore: {} as never,
      auth: { currentUser: { uid: 'host' } } as never,
    });

    await expect(repository.publish({
      version: 1, requestId: '40000000-0000-4000-8000-000000000005', roomId: ROOM_ID, totalBillVnd: 2_000,
    }, uids)).rejects.toBeInstanceOf(BillRepositoryError);
  });

  it('replays the immutable receipt and complete share collection after publication', async () => {
    const { documents, uids } = seedStore(2);
    const transactions = installTransactions(documents);
    const repository = createBillRepository({
      firestore: {} as never,
      auth: { currentUser: { uid: 'host' } } as never,
      createId: () => '40000000-0000-4000-8000-000000000003',
    });
    const command = {
      version: 1 as const, requestId: '40000000-0000-4000-8000-000000000003', roomId: ROOM_ID, totalBillVnd: 2_000,
    };

    const published = await repository.publish(command, uids);
    const writesBeforeReplay = transactions.writeSizes.length;
    const replayed = await repository.publish(command, uids);

    expect(replayed).toEqual(published);
    expect(transactions.writeSizes).toHaveLength(writesBeforeReplay + 1);
    expect(transactions.writeSizes.at(-1)).toBe(0);
  });
});
