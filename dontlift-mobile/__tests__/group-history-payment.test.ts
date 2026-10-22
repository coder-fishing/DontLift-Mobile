import { listenToHistoryPayment, type HistoryPaymentState } from '../src/features/history/group-history-payment';
import { buildVietQrPayment } from '../src/features/settlement/vietqr-payload';
jest.mock('firebase/firestore', () => ({ doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }), onSnapshot: jest.fn() }));
jest.mock('../src/features/settlement/published-bill-listener', () => ({ listenToPublishedBill: jest.fn() }));
jest.mock('../src/features/settlement/settlement-details-repository', () => ({ createSettlementDetailsRepository: () => ({ listen: jest.fn((...args: unknown[]) => {
  (globalThis as unknown as { detailsArgs: unknown[] }).detailsArgs = args; return jest.fn();
}) }) }));
const api = jest.requireMock('firebase/firestore');
const billApi = jest.requireMock('../src/features/settlement/published-bill-listener');
const roomId = '10000000-0000-4000-8000-000000000028';
type Subscription = { next: (value: unknown) => void; error: () => void; stop: jest.Mock };
let subs: Subscription[];
let emit: jest.Mock;
let stop: () => void;
const room = { pin: '12345678', status: 'COMPLETED', reconciliationStatus: 'FINALIZED', billRequestId: 'first', billRevision: 0, billPaidCount: 0 };
const bill = { version: 1, roomId, requestId: 'first', billRevision: 0, billPaidCount: 0, calculationVersion: 1,
  totalBillVnd: 1000, sumShareVnd: 1000, shares: [{ uid: 'member', shareVnd: 1000 }] };
const details = { kind: 'ready', details: { version: 1, roomId, bankId: '970436', accountNumber: '001234567', accountName: 'HOST', updatedAtUtcMs: 900, expiresAtUtcMs: 10000 } };
const snap = (data: unknown, fromCache = false) => ({ exists: () => true, data: () => data, metadata: { fromCache, hasPendingWrites: false } });
const sendBill = (value: unknown) => billApi.listenToPublishedBill.mock.calls[0][2](value);
const latest = () => emit.mock.calls.at(-1)![0] as HistoryPaymentState;
const payment = () => buildVietQrPayment({ ...latest(), roomId, actorUid: 'member', isOnline: true, nowUtcMs: 1000 });
function ready() {
  subs[0].next(snap(room)); subs[1].next(snap({ displayName: 'Member', status: 'EARLY_EXIT' }));
  sendBill({ kind: 'published', bill });
  ((globalThis as unknown as { detailsArgs: unknown[] }).detailsArgs[1] as (state: unknown) => void)(details);
}
beforeEach(() => {
  jest.clearAllMocks(); subs = []; emit = jest.fn();
  api.onSnapshot.mockImplementation((_ref: unknown, _options: unknown, next: Subscription['next'], error: Subscription['error']) => {
    const subscription = { next, error, stop: jest.fn() }; subs.push(subscription); return subscription.stop;
  });
  billApi.listenToPublishedBill.mockReturnValue(jest.fn());
  stop = listenToHistoryPayment({ firestore: {} as never, auth: { currentUser: { uid: 'member' } } as never }, 'member', roomId, emit);
});
afterEach(() => stop());
test('historical bill can generate QR only after server membership, current bill and bank details', () => {
  expect(payment().kind).toBe('unavailable'); ready(); expect(payment().kind).toBe('ready');
  subs[1].next(snap({ displayName: 'Member', status: 'ACTIVE' }, true));
  expect(payment().kind).toBe('unavailable');
});
test('pointer changes invalidate old bill until replacement arrives', () => {
  ready(); subs[0].next(snap({ ...room, billOverrideRequestId: 'replacement', billRevision: 1 }));
  expect(payment().kind).toBe('unavailable');
  sendBill({ kind: 'published', bill: { ...bill, requestId: 'replacement', billRevision: 1 } });
  expect(payment().kind).toBe('ready');
  sendBill({ kind: 'cached', bill }); expect(payment().kind).toBe('unavailable');
});
test('Host payment confirmation removes the QR after counter/markers agree', () => {
  ready(); subs[0].next(snap({ ...room, billPaidCount: 1 })); expect(payment().kind).toBe('unavailable');
  sendBill({ kind: 'published', bill: { ...bill, billPaidCount: 1, shares: [{ uid: 'member', shareVnd: 1000, paymentStatus: 'MARKED_AS_PAID', paidAtUtcMs: 1234 }] } });
  expect(payment().kind).toBe('paid');
});
test('expired bank details, revoked membership and listener errors never show an old QR', () => {
  ready();
  ((globalThis as unknown as { detailsArgs: unknown[] }).detailsArgs[1] as (state: unknown) => void)({ ...details, details: { ...details.details, expiresAtUtcMs: 999 } });
  expect(payment().kind).toBe('unavailable');
  subs[1].next(snap({ displayName: 'Member', status: 'LEFT' })); expect(payment().kind).toBe('unavailable');
  subs[0].error(); ready(); expect(latest().billState.kind).toBe('error');
});
test('unmount stops callbacks and every subscription', () => {
  ready(); stop(); const count = emit.mock.calls.length; ready(); expect(emit).toHaveBeenCalledTimes(count);
  expect(subs[0].stop).toHaveBeenCalled(); expect(subs[1].stop).toHaveBeenCalled();
});
