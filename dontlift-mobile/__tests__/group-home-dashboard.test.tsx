import React from 'react';
import { GroupHomeDashboard } from '../src/components/GroupHomeDashboard';
import type { GroupHistoryEntry } from '../src/features/history/group-history-model';

jest.mock('../src/constants/theme', () => ({ Colors: { light: {
  primary: 'blue', onPrimary: 'white', text: 'black', textSecondary: 'gray', roomSecondaryText: 'gray',
  roomInviteGradient: ['blue', 'purple'], roomInviteQrSurface: 'white', roomInviteHint: 'white',
  groupHomeHeroGradient: ['blue', 'purple'],
  backgroundSelected: 'lightblue', glassSurface: 'white', glassBorder: 'white',
  groupHomeSessionSurface: 'white', groupHomeSessionBorder: 'gray', groupHomeSecondarySurface: '#eee',
  warning: '#965500', error: 'red',
} } }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

type Node = { props: Record<string, unknown>; findAll(predicate: (node: Node) => boolean): Node[];
  findAllByProps(props: Record<string, unknown>): Node[]; findAllByType(type: unknown): Node[] };
type Rendered = { root: Node; unmount(): void };
const renderer = require('react-test-renderer') as { create(element: React.ReactElement): Rendered; act(task: () => void | Promise<void>): Promise<void> };
function textItems(screen: Rendered) {
  return screen.root.findAllByType(require('react-native').Text).map(node => node.props.children);
}
const session: GroupHistoryEntry = { summary: { version: 1, eventId: '20000000-0000-4000-8000-000000000028', actorUid: 'member',
  roomId: '10000000-0000-4000-8000-000000000028', status: 'COMPLETED', startedAtUtcMs: 1_000, completedAtUtcMs: 121_000,
  liftCount: 2, violationDurationSeconds: 3, penaltyScore: 23 }, syncStatus: 'SYNCED' };
function dashboard(overrides: Partial<React.ComponentProps<typeof GroupHomeDashboard>> = {}) {
  return <GroupHomeDashboard isCreating={false} recentSessions={[]} recentSessionsState="ready"
    onCreateRoom={jest.fn()} onJoinRoom={jest.fn()} onCancelCreate={jest.fn()} onOpenHistory={jest.fn()}
    onOpenRecentSession={jest.fn()} onRetryRecentSessions={jest.fn()} {...overrides} />;
}

test('shows the Focus Together actions and opens a recent session by room id', async () => {
  let screen: Rendered | undefined;
  const onOpenRecentSession = jest.fn();
  const onOpenHistory = jest.fn();
  try {
    await renderer.act(() => { screen = renderer.create(dashboard({ recentSessions: [session], onOpenRecentSession, onOpenHistory })); });
    expect(textItems(screen!).filter(value => value === 'Focus together')).toHaveLength(1);
    expect(textItems(screen!).filter(value => value === 'Recent Sessions')).toHaveLength(1);
    const row = screen!.root.findAllByProps({ accessibilityRole: 'button' })
      .find(item => String(item.props.accessibilityLabel).includes('group session from'));
    expect(row).toBeDefined();
    await renderer.act(() => { (row!.props.onPress as () => void)(); });
    expect(onOpenRecentSession).toHaveBeenCalledWith(session.summary.roomId);
    const history = screen!.root.findAllByProps({ accessibilityLabel: 'View group history' })[0];
    await renderer.act(() => { (history.props.onPress as () => void)(); });
    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  } finally { await renderer.act(() => screen?.unmount()); }
});

test('shows a useful empty state and cloud refresh failure while keeping saved sessions visible', async () => {
  let screen: Rendered | undefined;
  const onRetryRecentSessions = jest.fn();
  try {
    await renderer.act(() => { screen = renderer.create(dashboard({ recentSessionsState: 'ready' })); });
    expect(textItems(screen!).filter(value => value === 'No group sessions yet')).toHaveLength(1);
    await renderer.act(() => screen?.unmount());
    await renderer.act(() => { screen = renderer.create(dashboard({ recentSessions: [session], recentSessionsState: 'cloud-error', onRetryRecentSessions })); });
    expect(textItems(screen!).filter(value => value === 'Could not refresh cloud history. Showing saved sessions.')).toHaveLength(1);
    expect(screen!.root.findAll(node => typeof node.props.onPress === 'function'
      && String(node.props.accessibilityLabel).includes('group session from'))).toHaveLength(1);
  } finally { await renderer.act(() => screen?.unmount()); }
});

test('uses the recent-row layout for actionable sessions, keeps History, and opens the selected action', async () => {
  let screen: Rendered | undefined;
  const onOpenActionableSession = jest.fn();
  const action = { roomId: '10000000-0000-4000-8000-000000000009', action: 'AWAITING_CONFIRMATION' as const,
    roomStatus: 'COMPLETED', role: 'MEMBER' as const, startedAtUtcMs: 1_000, endedAtUtcMs: 121_000, source: 'LIVE' as const };
  const sessions = Array.from({ length: 7 }, (_, index) => ({ ...session,
    summary: { ...session.summary, roomId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}` } }));
  try {
    await renderer.act(() => { screen = renderer.create(dashboard({ recentSessions: sessions,
      actionableSessions: [action], actionableSessionsState: 'ready', actionableHasMore: true,
      onOpenActionableSession, onLoadMoreActionableSessions: jest.fn() })); });
    const labels = textItems(screen!);
    expect(labels.indexOf('Needs attention')).toBeGreaterThanOrEqual(0);
    expect(labels.filter(value => value === 'Recent Sessions')).toHaveLength(0);
    expect(screen!.root.findAll(node => typeof node.props.onPress === 'function'
      && node.props.accessibilityLabel === 'View group history')).toHaveLength(1);
    expect(screen!.root.findAll(node => typeof node.props.onPress === 'function'
      && String(node.props.accessibilityLabel).startsWith('Review payment.'))).toHaveLength(1);
    const actionRow = screen!.root.findAll(node => typeof node.props.onPress === 'function'
      && String(node.props.accessibilityLabel).startsWith('Review payment.'))[0];
    expect(actionRow).toBeDefined();
    await renderer.act(() => { (actionRow!.props.onPress as () => void)(); });
    expect(onOpenActionableSession).toHaveBeenCalledWith(action);
    expect(screen!.root.findAll(node => typeof node.props.onPress === 'function'
      && node.props.accessibilityLabel === 'Load more sessions that need attention')).toHaveLength(1);
  } finally { await renderer.act(() => screen?.unmount()); }
});

test('keeps Needs attention visible when the current page is empty but more actions can load', async () => {
  let screen: Rendered | undefined;
  const onLoadMoreActionableSessions = jest.fn();
  try {
    await renderer.act(() => { screen = renderer.create(dashboard({ actionableSessions: [], actionableSessionsState: 'ready',
      actionableHasMore: true, onLoadMoreActionableSessions })); });
    expect(textItems(screen!).filter(value => value === 'Needs attention')).toHaveLength(1);
    expect(textItems(screen!).filter(value => value === 'Recent Sessions')).toHaveLength(0);
    const loadMore = screen!.root.findAllByProps({ accessibilityLabel: 'Load more sessions that need attention' })[0];
    expect(loadMore).toBeDefined();
    await renderer.act(() => { (loadMore.props.onPress as () => void)(); });
    expect(onLoadMoreActionableSessions).toHaveBeenCalledTimes(1);
  } finally { await renderer.act(() => screen?.unmount()); }
});

test('shows five actionable sessions at a time and reveals five more per tap', async () => {
  let screen: Rendered | undefined;
  const actions = Array.from({ length: 7 }, (_, index) => ({ roomId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    action: 'RESUME_SESSION' as const, roomStatus: 'ACTIVE', role: 'MEMBER' as const,
    startedAtUtcMs: 1_000 + index, endedAtUtcMs: null, source: 'LIVE' as const }));
  try {
    await renderer.act(() => { screen = renderer.create(dashboard({ actionableSessions: actions, actionableSessionsState: 'ready' })); });
    const countVisibleRows = () => screen!.root.findAll(node => typeof node.props.onPress === 'function'
      && String(node.props.accessibilityLabel).startsWith('Resume session.')).length;
    expect(countVisibleRows()).toBe(5);
    const loadMore = screen!.root.findAll(node => typeof node.props.onPress === 'function'
      && node.props.accessibilityLabel === 'Load more sessions that need attention')[0];
    await renderer.act(() => { (loadMore.props.onPress as () => void)(); });
    expect(countVisibleRows()).toBe(7);
  } finally { await renderer.act(() => screen?.unmount()); }
});

test('labels saved actions and hides an empty action section', async () => {
  let screen: Rendered | undefined;
  const action = { roomId: '10000000-0000-4000-8000-000000000010', action: 'RESUME_SESSION' as const,
    roomStatus: 'ACTIVE', role: 'MEMBER' as const, startedAtUtcMs: 1_000, endedAtUtcMs: null, source: 'SAVED' as const };
  try {
    await renderer.act(() => { screen = renderer.create(dashboard({ actionableSessions: [action], actionableSessionsState: 'offline' })); });
    expect(textItems(screen!).filter(value => value === 'Saved copy · reconnect to refresh')).toHaveLength(1);
    expect(textItems(screen!).filter(value => value === 'Offline · showing saved actions')).toHaveLength(1);
    await renderer.act(() => screen?.unmount());
    await renderer.act(() => { screen = renderer.create(dashboard({ actionableSessions: [], actionableSessionsState: 'ready' })); });
    expect(textItems(screen!).filter(value => value === 'Needs attention')).toHaveLength(0);
  } finally { await renderer.act(() => screen?.unmount()); }
});

test('shows a Recent-shaped skeleton while actionable sessions load', async () => {
  let screen: Rendered | undefined;
  try {
    await renderer.act(() => { screen = renderer.create(dashboard({ actionableSessions: [], actionableSessionsState: 'loading' })); });
    expect(screen!.root.findAll(node => node.props.accessibilityRole === 'progressbar'
      && node.props.accessibilityLabel === 'Loading sessions that need attention').length).toBeGreaterThanOrEqual(1);
    expect(screen!.root.findAllByProps({ importantForAccessibility: 'no-hide-descendants' }).length).toBeGreaterThanOrEqual(3);
    expect(textItems(screen!).filter(value => value === 'Needs attention')).toHaveLength(1);
  } finally { await renderer.act(() => screen?.unmount()); }
});
