import { deriveGroupActionableSession, createGroupHistoryRepository, GROUP_ACTIONABLE_PAGE_SIZE,
  sortGroupActionableSessions } from '../src/features/history/group-history-repository';
import type { PublishedBill } from '../src/features/settlement/bill-repository';
import type * as SQLite from 'expo-sqlite';

class MockTestTimestamp {
  constructor(private readonly ms: number) {}
  toMillis() { return this.ms; }
  toDate() { return new Date(this.ms); }
  static fromMillis(ms: number) { return new MockTestTimestamp(ms); }
}

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, ...parts: string[]) => ({ path: parts.join('/'), kind: 'collection' })),
  doc: jest.fn((_db, ...parts: string[]) => ({ path: parts.join('/'), kind: 'document' })),
  documentId: () => '__name__',
  orderBy: jest.fn((field, direction) => ({ field, direction })),
  limit: jest.fn(count => ({ limit: count })),
  query: jest.fn((ref, ...constraints) => ({ ref, constraints })),
  startAfter: jest.fn((...values) => ({ startAfter: values })),
  where: jest.fn((field, operator, value) => ({ field, operator, value })),
  runTransaction: jest.fn(), getDocsFromServer: jest.fn(), getDocFromServer: jest.fn(),
  serverTimestamp: () => 'SERVER_TIME', Timestamp: MockTestTimestamp,
}));

const firestore = jest.requireMock('firebase/firestore');
const uid = 'member';
const roomId = '10000000-0000-4000-8000-000000000001';
const day = 24 * 60 * 60 * 1000;

function bill(shares: PublishedBill['shares']): PublishedBill {
  return { version: 1, requestId: 'request', roomId, totalBillVnd: 100_000, calculationVersion: 1,
    shares, sumShareVnd: 100_000, billRevision: 0, billPaidCount: 0 };
}

test.each([
  ['active room', { roomStatus: 'ACTIVE', reconciliation: null, role: 'MEMBER', bill: null }, 'RESUME_SESSION'],
  ['host bill setup', { roomStatus: 'COMPLETED', reconciliation: 'FINALIZED', role: 'HOST', bill: null }, 'SET_UP_BILL'],
  ['member waiting for host bill', { roomStatus: 'COMPLETED', reconciliation: 'FINALIZED', role: 'MEMBER', bill: null }, 'WAITING_FOR_HOST_BILL'],
  ['member share awaits host confirmation', { roomStatus: 'COMPLETED', reconciliation: 'FINALIZED', role: 'MEMBER', bill: bill([{ uid, shareVnd: 50_000 }]) }, 'AWAITING_CONFIRMATION'],
  ['host has unpaid shares to review', { roomStatus: 'COMPLETED', reconciliation: 'FINALIZED', role: 'HOST', bill: bill([{ uid: 'host', shareVnd: 50_000 }, { uid, shareVnd: 50_000 }]) }, 'REVIEW_PAYMENTS'],
] as const)('%s produces the expected action', (_label, state, action) => {
  expect(deriveGroupActionableSession({ roomId, ownUid: uid, ownMemberStatus: 'ACTIVE', billReadFailed: false,
    startedAtUtcMs: 1_000, endedAtUtcMs: 2_000, ...state })).toMatchObject({ roomId, action });
});

test('paid member shares and terminal rooms without an open action are omitted', () => {
  const paid = bill([{ uid, shareVnd: 50_000, paymentStatus: 'MARKED_AS_PAID', paidAtUtcMs: 2, paidBy: 'host', paymentRequestId: 'payment' }]);
  expect(deriveGroupActionableSession({ roomId, ownUid: uid, roomStatus: 'COMPLETED', ownMemberStatus: 'ACTIVE', role: 'MEMBER',
    reconciliation: 'FINALIZED', bill: paid, billReadFailed: false, startedAtUtcMs: 1, endedAtUtcMs: 2 })).toBeNull();
  for (const roomStatus of ['CANCELLED', 'ABORTED'] as const) {
    expect(deriveGroupActionableSession({ roomId, ownUid: uid, roomStatus, ownMemberStatus: 'ACTIVE', role: 'HOST',
      reconciliation: 'FINALIZED', bill: null, billReadFailed: false, startedAtUtcMs: 1, endedAtUtcMs: 2 })).toBeNull();
  }
});

test('sorts each action class by most recently updated before session chronology', () => {
  const base = { roomStatus: 'COMPLETED', role: 'HOST' as const, startedAtUtcMs: 1, endedAtUtcMs: 2, source: 'LIVE' as const };
  const sessions = [
    { ...base, roomId: 'newer-session', action: 'SET_UP_BILL' as const, startedAtUtcMs: 900, updatedAtUtcMs: 300 },
    { ...base, roomId: 'recently-updated', action: 'SET_UP_BILL' as const, startedAtUtcMs: 100, updatedAtUtcMs: 500 },
    { ...base, roomId: 'active', action: 'RESUME_SESSION' as const, roomStatus: 'ACTIVE', updatedAtUtcMs: 1 },
  ];
  expect(sortGroupActionableSessions(sessions).map(item => item.roomId))
    .toEqual(['active', 'recently-updated', 'newer-session']);
});

test('non-Premium unresolved actions older than seven days remain discoverable', async () => {
  const old = Date.now() - 30 * day;
  const timestamp = (ms: number) => new MockTestTimestamp(ms);
  firestore.getDocsFromServer.mockResolvedValueOnce({ docs: [{ id: roomId, data: () => ({ roomId, joinedAt: timestamp(old) }) }] });
  firestore.getDocFromServer.mockImplementation(async (ref: { path: string }) => {
    if (ref.path === `rooms/${roomId}`) return { exists: () => true, data: () => ({
      status: 'COMPLETED', reconciliationStatus: 'FINALIZED', hostId: 'host', startedAt: timestamp(old - day), endedAt: timestamp(old),
    }) };
    if (ref.path === `rooms/${roomId}/members/${uid}`) return { exists: () => true, data: () => ({ status: 'ACTIVE', role: 'MEMBER' }) };
    return { exists: () => false, data: () => ({}) };
  });
  const settings = new Map<string, string>();
  const database = {
    getFirstAsync: jest.fn(async (_sql: string, key: string) => settings.has(key) ? { value: settings.get(key) } : null),
    runAsync: jest.fn(async (_sql: string, key: string, value: string) => { settings.set(key, value); return { changes: 1 }; }),
    withExclusiveTransactionAsync: jest.fn(async (work: (tx: unknown) => Promise<void>) => work(database)),
  } as unknown as SQLite.SQLiteDatabase;
  const repository = createGroupHistoryRepository({ firestore: {} as never,
    auth: { currentUser: { uid } } as never, database: Promise.resolve(database) });

  const page = await repository.readActionablePage(uid, { online: true, cursor: null });
  expect(page.items).toMatchObject([{ roomId, action: 'WAITING_FOR_HOST_BILL', source: 'LIVE' }]);
  expect(page.hasMore).toBe(false);
  expect(firestore.limit).toHaveBeenCalledWith(GROUP_ACTIONABLE_PAGE_SIZE + 1);
  expect(firestore.query.mock.calls[0][0].path).toBe(`users/${uid}/groupRooms`);
  const offline = await repository.readActionablePage(uid, { online: false, cursor: null });
  expect(offline.items).toMatchObject([{ roomId, action: 'WAITING_FOR_HOST_BILL', source: 'SAVED' }]);
});
