import React from 'react';
import { GroupHistoryScreen } from '../src/screens/GroupHistoryScreen';
import type { GroupHistoryRepository } from '../src/features/history/group-history-repository';
import type { GroupHistoryEntry } from '../src/features/history/group-history-model';
jest.mock('../src/constants/theme', () => ({ Colors: { light: { primary: 'blue', text: 'black', textSecondary: 'gray', error: 'red', authBackdrop: 'white', border: 'gray', glassSurface: 'white' } } }));
jest.mock('../src/components/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('expo-image', () => ({ Image: 'PaymentQrImage' }));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn(), addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })) }));
const network = jest.requireMock('expo-network');
type Node = { props: Record<string, unknown>; findByProps(props: Record<string, unknown>): Node; findAllByProps(props: Record<string, unknown>): Node[] };
type Rendered = { root: Node; unmount(): void };
const renderer = require('react-test-renderer') as { create(element: React.ReactElement): Rendered; act(task: () => void | Promise<void>): Promise<void> };
const entry: GroupHistoryEntry = { summary: { version: 1, eventId: '20000000-0000-4000-8000-000000000028', actorUid: 'member', roomId: '10000000-0000-4000-8000-000000000028',
  status: 'EARLY_EXIT', startedAtUtcMs: 1000, completedAtUtcMs: 11000, liftCount: 1, violationDurationSeconds: 3, penaltyScore: 13 }, syncStatus: 'PENDING' };
function repository(items = [entry]) {
  return { readPage: jest.fn(async () => ({ items, cursor: null, hasMore: false, cloudError: false })),
    syncPending: jest.fn(async () => undefined), readEntry: jest.fn(async () => null), cachedDetail: jest.fn(async () => null),
    listenPayment: jest.fn(() => jest.fn()),
    readDetail: jest.fn(async () => ({ roomStatus: 'COMPLETED', reconciliation: 'FINALIZED', finalizationReason: 'HOST_OVERRIDE',
      members: [{ uid: 'member', name: 'Member', status: 'EARLY_EXIT', score: 10 }], excludedCount: 1, excludedHasMore: false, bill: null, billError: false })) };
}
beforeEach(() => { jest.clearAllMocks(); network.getNetworkStateAsync.mockResolvedValue({ isConnected: false }); });
test('offline history shows durable local entry and back navigation', async () => {
  const repo = repository(); const onBack = jest.fn(); let screen: Rendered | undefined;
  try {
    await renderer.act(async () => { screen = renderer.create(<GroupHistoryScreen userId="member" repository={repo as unknown as GroupHistoryRepository} serverPremium={false} onBack={onBack} />); });
    expect(screen!.root.findAllByProps({ children: 'Offline · Saved on this device' }).length).toBeGreaterThan(0);
    expect(repo.syncPending).not.toHaveBeenCalled();
    await renderer.act(() => { (screen!.root.findByProps({ title: 'Back to Group' }).props.onPress as () => void)(); });
    expect(onBack).toHaveBeenCalledTimes(1);
  } finally { await renderer.act(() => screen?.unmount()); }
});
test('detail distinguishes local recording from final result and excluded history', async () => {
  network.getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  const repo = repository(); let screen: Rendered | undefined;
  try {
    await renderer.act(async () => { screen = renderer.create(<GroupHistoryScreen userId="member" repository={repo as unknown as GroupHistoryRepository} serverPremium={false} onBack={jest.fn()} />); });
    const button = screen!.root.findByProps({ accessibilityLabel: `Open group session from ${new Date(11000).toLocaleString()}` });
    await renderer.act(async () => { (button.props.onPress as () => void)(); });
    expect(screen!.root.findAllByProps({ children: 'Your device recording' }).length).toBeGreaterThan(0);
    expect(screen!.root.findAllByProps({ children: 'Room result' }).length).toBeGreaterThan(0);
    expect(screen!.root.findAllByProps({ children: 'The Host finalized before everyone synced. Late excluded violations do not change points or payment.' }).length).toBeGreaterThan(0);
    expect(repo.readDetail).toHaveBeenCalledWith('member', entry.summary.roomId);
    await renderer.act(() => { (screen!.root.findByProps({ title: 'Back to history' }).props.onPress as () => void)(); });
    expect(screen!.root.findAllByProps({ children: 'Your device recording' })).toHaveLength(0);
  } finally { await renderer.act(() => screen?.unmount()); }
});
test('empty history and cloud errors remain recoverable', async () => {
  network.getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  const repo = repository([]); repo.readPage.mockResolvedValue({ items: [], cursor: null, hasMore: false, cloudError: true });
  let screen: Rendered | undefined;
  try {
    await renderer.act(async () => { screen = renderer.create(<GroupHistoryScreen userId="member" repository={repo as unknown as GroupHistoryRepository} serverPremium={false} onBack={jest.fn()} />); });
    expect(screen!.root.findAllByProps({ children: 'No group sessions yet' }).length).toBeGreaterThan(0);
    expect(screen!.root.findAllByProps({ children: 'Could not refresh cloud history. Your saved sessions are still available.' }).length).toBeGreaterThan(0);
    const before = repo.syncPending.mock.calls.length;
    await renderer.act(async () => { (screen!.root.findByProps({ title: 'Refresh & retry sync' }).props.onPress as () => void)(); });
    expect(repo.syncPending.mock.calls.length).toBeGreaterThan(before);
  } finally { await renderer.act(() => screen?.unmount()); }
});

test('one Premium entitlement controls local and cloud origins', async () => {
  for (const active of [true, false]) {
    const repo = repository([]);
    let screen: Rendered | undefined;
    try {
      await renderer.act(async () => { screen = renderer.create(<GroupHistoryScreen userId="member" repository={repo as unknown as GroupHistoryRepository}
        serverPremium={active} onBack={jest.fn()} />); });
      expect(repo.readPage).toHaveBeenCalledWith('member', expect.objectContaining({ localPremium: active, serverPremium: active }));
    } finally { await renderer.act(() => screen?.unmount()); }
  }
});

test('unpaid history opens a separate current-bill payment subscription and returns to the same session', async () => {
  const { AppState } = require('react-native') as typeof import('react-native');
  const old = AppState.currentState;
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  network.getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  const repo = repository();
  const currentBill = { version: 1, requestId: 'current', roomId: entry.summary.roomId, calculationVersion: 1,
    totalBillVnd: 1000, sumShareVnd: 1000, billRevision: 2, billPaidCount: 0, shares: [{ uid: 'member', shareVnd: 1000 }] };
  repo.readDetail.mockResolvedValue({ roomStatus: 'COMPLETED', reconciliation: 'FINALIZED', finalizationReason: 'ALL_SYNCED',
    members: [{ uid: 'member', name: 'Member', status: 'EARLY_EXIT', score: 13 }], excludedCount: 0, excludedHasMore: false, bill: currentBill, billError: false } as never);
  repo.listenPayment.mockImplementation(((uid: string, roomId: string, callback: (state: unknown) => void) => {
    callback({ roomPin: '12345678', member: { uid, displayName: 'Member', status: 'EARLY_EXIT' },
      billState: { kind: 'published', bill: currentBill }, detailsState: { kind: 'ready', details: {
        version: 1, roomId, bankId: '970436', accountNumber: '001234567', accountName: 'HOST', updatedAtUtcMs: Date.now(), expiresAtUtcMs: Date.now() + 86400000 } } });
    return jest.fn();
  }) as never);
  let screen: Rendered | undefined;
  try {
    await renderer.act(async () => { screen = renderer.create(<GroupHistoryScreen userId="member" repository={repo as unknown as GroupHistoryRepository} serverPremium={false} onBack={jest.fn()} />); });
    await renderer.act(async () => { (screen!.root.findByProps({ accessibilityLabel: `Open group session from ${new Date(11000).toLocaleString()}` }).props.onPress as () => void)(); });
    await renderer.act(async () => { (screen!.root.findByProps({ title: 'Pay my share' }).props.onPress as () => void)(); });
    expect(repo.listenPayment).toHaveBeenCalledWith('member', entry.summary.roomId, expect.any(Function));
    const qrScreen = screen!.root.findByProps({ backLabel: 'Group session' });
    expect(qrScreen.props.billState).toMatchObject({ kind: 'published', bill: { billRevision: 2 } });
    await renderer.act(async () => { (screen!.root.findByProps({ accessibilityLabel: 'Back to group session' }).props.onPress as () => void)(); });
    expect(screen!.root.findAllByProps({ children: 'Your device recording' }).length).toBeGreaterThan(0);
  } finally { await renderer.act(() => screen?.unmount()); Object.defineProperty(AppState, 'currentState', { configurable: true, value: old }); }
});
