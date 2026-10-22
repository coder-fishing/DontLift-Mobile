import { listenToPublishedBill } from '../src/features/settlement/published-bill-listener';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
}));

type Subscription = {
  next: (snapshot: unknown) => void;
  error: (error: Error) => void;
  unsubscribe: jest.Mock;
};
const onSnapshotMock = jest.requireMock('firebase/firestore').onSnapshot as jest.Mock;
const roomSnapshot = (fromCache = false) => ({
  exists: () => true,
  data: () => ({ billRequestId: 'request', calculationVersion: 1, totalBillVnd: 1_000, billShareCount: 1 }),
  metadata: { fromCache },
});
const sharesSnapshot = {
  docs: [{ id: 'member', data: () => ({ shareVnd: 1_000 }) }],
  metadata: { fromCache: false },
};

describe('published bill listener status', () => {
  let subscriptions: Subscription[];

  beforeEach(() => {
    jest.clearAllMocks();
    subscriptions = [];
    onSnapshotMock.mockImplementation((_ref: unknown, _options: unknown, next: Subscription['next'], error: Subscription['error']) => {
      const subscription = { next, error, unsubscribe: jest.fn() };
      subscriptions.push(subscription);
      return subscription.unsubscribe;
    });
  });

  it('does not label a locally pending room publication as confirmed', () => {
    const onState = jest.fn();
    const stop = listenToPublishedBill({} as never, 'room', onState);
    subscriptions[0].next({ ...roomSnapshot(), metadata: { fromCache: false, hasPendingWrites: true } });
    expect(onState.mock.calls.at(-1)?.[0].kind).toBe('cached');
    expect(subscriptions).toHaveLength(1);
    stop();
  });

  it.each([0, 1])('keeps an error from stream %s visible until a new subscription is attached', streamIndex => {
    const onState = jest.fn();
    const stop = listenToPublishedBill({} as never, 'room', onState);
    const room = subscriptions[0];
    room.next(roomSnapshot());
    const shares = subscriptions[1];
    shares.next(sharesSnapshot);
    expect(onState.mock.calls.at(-1)?.[0].kind).toBe('published');

    subscriptions[streamIndex].error(new Error('permission denied'));
    expect(onState.mock.calls.at(-1)?.[0].kind).toBe('error');
    room.next(roomSnapshot());
    for (const subscription of subscriptions.slice(1)) subscription.next(sharesSnapshot);
    expect(onState.mock.calls.at(-1)?.[0].kind).toBe('error');
    stop();
  });

  it('does not promote stale share callbacks to live after the room becomes cached', () => {
    const onState = jest.fn();
    const stop = listenToPublishedBill({} as never, 'room', onState);
    subscriptions[0].next(roomSnapshot());
    const shares = subscriptions[1];
    shares.next(sharesSnapshot);

    subscriptions[0].next(roomSnapshot(true));
    shares.next(sharesSnapshot);
    expect(onState.mock.calls.at(-1)?.[0].kind).toBe('cached');
    expect(shares.unsubscribe).toHaveBeenCalledTimes(1);
    stop();
  });

  it('recovers with a new subscription while discarding callbacks from the failed attempt', () => {
    const onState = jest.fn();
    const stopFirst = listenToPublishedBill({} as never, 'room', onState);
    subscriptions[0].next(roomSnapshot());
    const oldShares = subscriptions[1];
    oldShares.error(new Error('permission denied'));
    stopFirst();

    const stopRetry = listenToPublishedBill({} as never, 'room', onState);
    subscriptions[2].next(roomSnapshot());
    subscriptions[3].next(sharesSnapshot);
    expect(onState.mock.calls.at(-1)?.[0].kind).toBe('published');
    const delivered = onState.mock.calls.length;
    oldShares.error(new Error('late error'));
    oldShares.next(sharesSnapshot);
    expect(onState).toHaveBeenCalledTimes(delivered);
    stopRetry();
  });
});
