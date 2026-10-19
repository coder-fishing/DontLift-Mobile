import React from 'react';
import { HistoryScreen } from '../src/screens/HistoryScreen';
import { SoloSelectScreen } from '../src/screens/SoloSelectScreen';
import { BottomNav } from '../src/components/BottomNav';
import { SCREEN_TITLES } from '../src/constants';
import type { HistoryRepository } from '../src/features/history/history-controller';

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: false, isInternetReachable: false })),
  addNetworkStateListener: () => ({ remove: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native/Libraries/Lists/FlatList', () => ({
  __esModule: true,
  default: (props: {
    data: unknown[]; testID: string; ListHeaderComponent: React.ReactNode; ListFooterComponent: React.ReactNode;
    ListEmptyComponent: React.ReactNode; renderItem: (input: { item: unknown; index: number }) => React.ReactNode;
  }) => {
    const react = require('react') as typeof React;
    return react.createElement('View', { testID: props.testID }, props.ListHeaderComponent,
      ...props.data.map((item, index) => react.createElement(react.Fragment, { key: index }, props.renderItem({ item, index }))),
      props.data.length ? null : props.ListEmptyComponent, props.ListFooterComponent);
  },
}));
jest.mock('../src/constants/theme', () => ({ Colors: { light: {
  text: '#000', textSecondary: '#60646C', authAccent: '#004AC6', border: '#C3C6D7', error: '#B42318',
  backgroundSelected: '#E0E1E6', authFormSurface: '#fff', glassBorder: '#eee', glassShadow: '#000',
} } }));
type Node = { props: Record<string, unknown>; children: (Node | string)[]; findByProps(props: Record<string, unknown>): Node; findAll(predicate: (node: Node) => boolean): Node[] };
type Rendered = { root: Node; toJSON(): unknown; unmount(): void };
const renderer = require('react-test-renderer') as {
  create(element: React.ReactElement): Rendered;
  act(task: () => void | Promise<void>): Promise<void>;
};
let mounted: Rendered | undefined;
afterEach(async () => { if (mounted) await renderer.act(() => mounted?.unmount()); mounted = undefined; });

test('Solo has a visible History entry and the history route remains within the Solo tab', async () => {
  const onOpenHistory = jest.fn();
  await renderer.act(() => { mounted = renderer.create(<SoloSelectScreen
    selectedDuration={25} selectedMode="COUNTDOWN" onSelectDuration={jest.fn()} onSelectMode={jest.fn()}
    onStartSession={jest.fn()} onContinueSession={jest.fn()} onCancelSession={jest.fn()} onOpenHistory={onOpenHistory}
    isStarting={false} isCancelling={false} sensorAvailability={{ kind: 'checking' }}
    onRetrySensorCheck={jest.fn()} onOpenSettings={jest.fn()}
  />); });
  await renderer.act(() => { (mounted!.root.findByProps({ title: 'View Solo history' }).props.onPress as () => void)(); });
  expect(onOpenHistory).toHaveBeenCalledTimes(1);
  expect(SCREEN_TITLES['11-solo-history']).toBe('Solo History');
}, 15_000);

test('offline history opens real metrics and returns to list and Solo', async () => {
  const item = { sessionId: 'session', userId: 'owner', mode: 'COUNTDOWN' as const, durationSeconds: 60, liftCount: 1, violationDurationSeconds: 3, penaltyScore: 13, startedAt: '2026-10-19T10:00:00Z', completedAt: '2026-10-19T10:01:00Z', syncStatus: 'pending' as const };
  const repository: HistoryRepository = {
    readLocalPage: async () => ({ items: [item], cursor: null, hasMore: false }),
    readCloudPage: jest.fn(),
  };
  const onBack = jest.fn();
  await renderer.act(async () => { mounted = renderer.create(<HistoryScreen userId="owner" serverPremium={false} repository={repository} onBack={onBack} />); });
  expect(JSON.stringify(mounted!.toJSON())).toContain('Offline');
  const entry = mounted!.root.findAll(node => node.props.accessibilityHint === 'Open session details')[0];
  await renderer.act(() => { (entry.props.onPress as () => void)(); });
  const detail = JSON.stringify(mounted!.toJSON());
  expect(detail).toContain('Session details');
  expect(detail).toContain('13 pts');
  expect(detail).toContain('Away time');
  await renderer.act(() => { (mounted!.root.findByProps({ title: 'Back to history' }).props.onPress as () => void)(); });
  await renderer.act(() => { (mounted!.root.findByProps({ title: 'Back to Solo' }).props.onPress as () => void)(); });
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(repository.readCloudPage).not.toHaveBeenCalled();
});

test('History keeps the existing five bottom tabs', async () => {
  await renderer.act(() => { mounted = renderer.create(<BottomNav currentScreen="11-solo-history" onNavigate={jest.fn()} />); });
  const tree = JSON.stringify(mounted!.toJSON());
  for (const label of ['Solo', 'Group', 'Sensors', 'Pro', 'Account']) expect(tree).toContain(label);
});
