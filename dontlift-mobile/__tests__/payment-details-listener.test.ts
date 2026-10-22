import { createSettlementDetailsRepository } from '../src/features/settlement/settlement-details-repository';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(), onSnapshot: jest.fn(),
  Timestamp: class Timestamp {
    private ms: number;
    constructor(value: number) { this.ms = value; }
    toMillis() { return this.ms; }
  },
}));
const sdk = jest.requireMock('firebase/firestore');
const roomId = '11111111-1111-4111-8111-111111111111';
let next: (snapshot: unknown) => void;
let fail: () => void;
const snapshot = (fromCache = false, hasPendingWrites = false, exists = true) => ({
  exists: () => exists,
  metadata: { fromCache, hasPendingWrites },
  data: () => ({ bankId: '970436', accountNumber: '0012345', accountName: 'HOST',
    expiresAt: new sdk.Timestamp(2_000), updatedAt: new sdk.Timestamp(1_000) }),
});

beforeEach(() => {
  jest.clearAllMocks();
  sdk.onSnapshot.mockImplementation((_ref: unknown, _options: unknown, onNext: typeof next, onError: typeof fail) => {
    next = onNext; fail = onError; return jest.fn();
  });
});

test('keeps cached and pending-write bank details unavailable until server confirmation', () => {
  const onState = jest.fn();
  const repository = createSettlementDetailsRepository({ firestore: {} as never, auth: { currentUser: { uid: 'member' } } });
  repository.listen(roomId, onState);
  next(snapshot(true));
  expect(onState.mock.calls.at(-1)[0]).toEqual({ kind: 'loading' });
  next(snapshot(false, true));
  expect(onState.mock.calls.at(-1)[0]).toEqual({ kind: 'loading' });
  next(snapshot());
  expect(onState.mock.calls.at(-1)[0]).toMatchObject({ kind: 'ready', details: { roomId, accountNumber: '0012345' } });
  fail();
  expect(onState.mock.calls.at(-1)[0]).toEqual({ kind: 'error' });
});

test('handles a missing document and refuses to subscribe when signed out', () => {
  const onState = jest.fn();
  const repository = createSettlementDetailsRepository({ firestore: {} as never, auth: { currentUser: { uid: 'member' } } });
  repository.listen(roomId, onState);
  next(snapshot(false, false, false));
  expect(onState.mock.calls.at(-1)[0]).toEqual({ kind: 'unavailable' });
  sdk.onSnapshot.mockClear();
  createSettlementDetailsRepository({ firestore: {} as never, auth: { currentUser: null } }).listen(roomId, onState);
  expect(onState.mock.calls.at(-1)[0]).toEqual({ kind: 'unavailable' });
  expect(sdk.onSnapshot).not.toHaveBeenCalled();
});
