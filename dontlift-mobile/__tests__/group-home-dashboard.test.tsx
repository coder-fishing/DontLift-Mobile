import React from 'react';
import { Pressable } from 'react-native';
import { GroupHomeDashboard } from '../src/components/GroupHomeDashboard';
import type { GroupHistoryEntry } from '../src/features/history/group-history-model';

jest.mock('../src/constants/theme', () => ({ Colors: { light: {
  primary: 'blue', onPrimary: 'white', text: 'black', textSecondary: 'gray', roomSecondaryText: 'gray',
  roomInviteGradient: ['blue', 'purple'], roomInviteQrSurface: 'white', roomInviteHint: 'white',
  backgroundSelected: 'lightblue', glassSurface: 'white', glassBorder: 'white',
} } }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

type Node = { props: Record<string, unknown>; findAllByProps(props: Record<string, unknown>): Node[]; findAllByType(type: unknown): Node[] };
type Rendered = { root: Node; unmount(): void };
const renderer = require('react-test-renderer') as { create(element: React.ReactElement): Rendered; act(task: () => void | Promise<void>): Promise<void> };
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
    expect(screen!.root.findAllByProps({ children: 'Focus together' })).toHaveLength(1);
    expect(screen!.root.findAllByProps({ children: 'Recent Sessions' })).toHaveLength(1);
    const row = screen!.root.findAllByType(Pressable)
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
    expect(screen!.root.findAllByProps({ children: 'No group sessions yet' })).toHaveLength(1);
    await renderer.act(() => screen?.unmount());
    await renderer.act(() => { screen = renderer.create(dashboard({ recentSessions: [session], recentSessionsState: 'cloud-error', onRetryRecentSessions })); });
    expect(screen!.root.findAllByProps({ children: 'Could not refresh cloud history. Showing saved sessions.' })).toHaveLength(1);
    expect(screen!.root.findAllByType(Pressable).filter(item => String(item.props.accessibilityLabel).includes('group session from'))).toHaveLength(1);
  } finally { await renderer.act(() => screen?.unmount()); }
});
