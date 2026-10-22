import { createPaymentStatusRepository } from '../src/features/settlement/payment-status-repository';
import { acceptsBillProgress, parseSharePayment } from '../src/features/settlement/payment-status-domain';
jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  runTransaction: jest.fn(), getDocFromServer: jest.fn(), serverTimestamp: () => 'SERVER_TIME',
  Timestamp: class { toMillis() { return 1234; } },
}));
const api = jest.requireMock('firebase/firestore');
const command = { version: 1 as const, roomId: '10000000-0000-4000-8000-000000000027',
  requestId: '20000000-0000-4000-8000-000000000027', memberUid: 'member',
  publicationRequestId: '30000000-0000-4000-8000-000000000027', expectedRevision: 0,
  targetStatus: 'MARKED_AS_PAID' as const };
const root = `rooms/${command.roomId}`;
let store: Map<string, Record<string, unknown>>;
let writes: { path: string; data: Record<string, unknown> }[];
const repo = () => createPaymentStatusRepository({ firestore: {} as never, auth: { currentUser: { uid: 'host' } } });
beforeEach(() => {
  writes = [];
  store = new Map([
    [root, { hostId: 'host', status: 'COMPLETED', reconciliationStatus: 'FINALIZED', calculationVersion: 1,
      billRequestId: command.publicationRequestId, billShareCount: 2 }],
    [`${root}/members/host`, { role: 'HOST', status: 'ACTIVE' }],
    [`${root}/members/member`, { role: 'MEMBER', status: 'ACTIVE' }],
    [`${root}/settlementDetails/current`, { expiresAt: new api.Timestamp() }],
    [`${root}/billShares/member`, { uid: 'member', requestId: command.publicationRequestId, shareVnd: 1000 }],
  ]);
  api.runTransaction.mockImplementation(async (_: unknown, fn: (tx: unknown) => unknown) => fn({
    get: async ({ path }: { path: string }) => ({ exists: () => store.has(path), data: () => store.get(path) }),
    update: ({ path }: { path: string }, data: Record<string, unknown>) => writes.push({ path, data }),
    set: ({ path }: { path: string }, data: Record<string, unknown>) => writes.push({ path, data }),
  }));
  api.getDocFromServer.mockRejectedValue(new Error('readback offline'));
});
test('committed mark writes share, counter and receipt; failed readback is pending success', async () => {
  const result = await repo().markPaid(command, true);
  expect(result.paidAtUtcMs).toBeNull();
  expect(writes).toHaveLength(3);
  expect(writes[0].data).toEqual({ paymentStatus: 'MARKED_AS_PAID', paidAt: 'SERVER_TIME', paidBy: 'host', paymentRequestId: command.requestId });
  expect(writes[1].data).toEqual({ billPaidCount: 1, lastPaymentRequestId: command.requestId });
});
test('receipt replay precedes live publication checks and performs no writes', async () => {
  store.get(root)!.status = 'ABORTED';
  store.set(`${root}/billPaymentCommands/${command.requestId}`, { ...command, actorUid: 'host', shareVnd: 1000, paidAt: new api.Timestamp() });
  expect((await repo().markPaid(command, true)).paidAtUtcMs).toBe(1234);
  expect(writes).toHaveLength(0);
  await expect(repo().markPaid({ ...command, memberUid: 'other' }, true)).rejects.toMatchObject({ code: 'already-exists' });
});
test.each(['revision', 'paid', 'zero', 'host'] )('rejects %s before writes', async variant => {
  if (variant === 'revision') store.get(root)!.billRevision = 1;
  if (variant === 'paid') store.get(`${root}/billShares/member`)!.paymentStatus = 'MARKED_AS_PAID';
  if (variant === 'zero') store.get(`${root}/billShares/member`)!.shareVnd = 0;
  if (variant === 'host') store.get(root)!.hostId = 'other';
  await expect(repo().markPaid(command, true)).rejects.toMatchObject({ code: variant === 'host' ? 'permission-denied' : 'failed-precondition' });
  expect(writes).toHaveLength(0);
});
test('override resolves current version path', async () => {
  store.get(root)!.billOverrideRequestId = command.publicationRequestId;
  store.set(`${root}/billOverrides/${command.publicationRequestId}/shares/member`, store.get(`${root}/billShares/member`)!);
  await repo().markPaid(command, true);
  expect(writes[0].path).toContain('/billOverrides/');
});
test('offline and malformed UID never start a transaction', async () => {
  api.runTransaction.mockClear();
  await expect(repo().markPaid(command, false)).rejects.toMatchObject({ code: 'unavailable' });
  await expect(repo().markPaid({ ...command, memberUid: undefined as never }, true)).rejects.toMatchObject({ code: 'invalid-argument' });
  expect(api.runTransaction).not.toHaveBeenCalled();
});
test('payment parser rejects partial markers and preserves committed fields', () => {
  expect(parseSharePayment({})).toEqual({});
  expect(parseSharePayment({ paymentStatus: 'MARKED_AS_PAID' })).toBeNull();
  expect(parseSharePayment({ paymentStatus: 'MARKED_AS_PAID', paidAt: new api.Timestamp(), paidBy: 'host', paymentRequestId: 'id' })).toMatchObject({ paidAtUtcMs: 1234 });
});
test('old receipts cannot lower a live revision or its paid counter', () => {
  const observed = { roomId: 'room', revision: 2, paidCount: 1 };
  expect(acceptsBillProgress({ roomId: 'room', billRevision: 1, billPaidCount: 2 }, observed)).toBe(false);
  expect(acceptsBillProgress({ roomId: 'room', billRevision: 2, billPaidCount: 0 }, observed)).toBe(false);
  expect(acceptsBillProgress({ roomId: 'room', billRevision: 2, billPaidCount: 1 }, observed)).toBe(true);
});
