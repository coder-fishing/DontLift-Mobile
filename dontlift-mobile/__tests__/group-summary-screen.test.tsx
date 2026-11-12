import React from 'react';
import { Alert, Text } from 'react-native';
import { GroupSummaryScreen } from '../src/screens/GroupSummaryScreen';

jest.mock('../src/components/GlassCard', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-image', () => ({ Image: 'AvatarImage' }));
jest.mock('../src/constants/theme', () => ({ Colors: { light: {
  text: '#0F172A', textSecondary: '#64748B', primary: '#2563EB', onPrimary: '#FFFFFF', error: '#B42318',
  border: '#C3C6D7', glassSurface: 'rgba(255,255,255,0.58)', glassBorder: 'rgba(255,255,255,0.88)',
  success: '#059669', successSurface: '#DCFCE7', warning: '#9A5800', warningSurface: '#FFF4D6',
  roomMemberAvatar: '#D7E7FF', roomMemberAccent: '#2456B8', roomHostAvatar: '#E5DCFA', roomHostAccent: '#6545A5',
} } }));

type Node = {
  type: unknown;
  props: Record<string, unknown>;
  findByProps(props: Record<string, unknown>): Node;
  findAllByProps(props: Record<string, unknown>): Node[];
  findAll(predicate: (node: Node) => boolean): Node[];
};
type Rendered = { root: Node; unmount(): void };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as {
  create(element: React.ReactElement): Rendered;
  act(task: () => void | Promise<void>): Promise<void>;
};

function renderedText(children: unknown): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(renderedText).join('');
  return '';
}
const findText = (root: Node, value: string) => root.findAll(node => node.type === Text && renderedText(node.props.children) === value);
function styleHasBackground(style: unknown, color: string): boolean {
  if (Array.isArray(style)) return style.some(item => styleHasBackground(item, color));
  return typeof style === 'object' && style !== null && 'backgroundColor' in style
    && (style as { backgroundColor?: unknown }).backgroundColor === color;
}
function styleHasValue(style: unknown, key: string, value: unknown): boolean {
  if (Array.isArray(style)) return style.some(item => styleHasValue(item, key, value));
  return typeof style === 'object' && style !== null && key in style
    && (style as Record<string, unknown>)[key] === value;
}
function findButton(root: Node, label: string): Node[] {
  const matching = root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function');
  return [...new Map(matching.map(node => [node.props.onPress, node])).values()];
}

type Member = {
  uid: string;
  displayName: string;
  avatarUri?: string;
  role: 'HOST' | 'MEMBER';
  status: 'ACTIVE' | 'EARLY_EXIT' | 'REMOVED';
  penaltyScore: number;
  liftCount: number;
  violationDurationSeconds: number;
  joinedAt: string | null;
  syncAcknowledgedAtUtcMs: number | null;
};

function member(overrides: Partial<Member> & Pick<Member, 'uid' | 'displayName'>): Member {
  return {
    role: 'MEMBER', status: 'ACTIVE', penaltyScore: 0, liftCount: 0,
    violationDurationSeconds: 0, joinedAt: null, syncAcknowledgedAtUtcMs: null,
    ...overrides,
  };
}

const defaultMembers = [
  member({ uid: 'host', displayName: 'Bin Ne', role: 'HOST', penaltyScore: 0 }),
  member({ uid: 'member', displayName: 'Hehe', penaltyScore: 122, liftCount: 4, violationDurationSeconds: 83 }),
];

function renderSummary(options: {
  actorUid?: string;
  members?: Member[];
  status?: 'PENDING' | 'FINALIZED';
  finalizationReason?: 'ALL_SYNCED' | 'HOST_OVERRIDE' | null;
  pendingMemberCount?: number | null;
  isOnline?: boolean;
  isSyncing?: boolean;
  isFinalizingOverride?: boolean;
  errorMessage?: string;
  overrideErrorMessage?: string;
  onSyncAndAcknowledge?: jest.Mock;
  onFinalizeWithOverride?: jest.Mock;
} = {}): Rendered {
  const members = options.members ?? defaultMembers;
  const actorUid = options.actorUid ?? 'member';
  return renderer.create(<GroupSummaryScreen
    snapshot={{
      roomId: 'room-id', hostUid: 'host', status: 'COMPLETED', participantCount: members.length,
      startedAtUtcMs: 10_000, hostHeartbeatAtUtcMs: null, endedAtUtcMs: 100_000,
      reconciliationStatus: options.status ?? 'PENDING',
      pendingMemberCount: options.pendingMemberCount === undefined ? 2 : options.pendingMemberCount,
      finalizationReason: options.finalizationReason ?? null, pin: '12345678', createdAt: null, updatedAt: null,
      members,
    }}
    actorUid={actorUid}
    isOnline={options.isOnline ?? true}
    isSyncing={options.isSyncing ?? false}
    isFinalizingOverride={options.isFinalizingOverride ?? false}
    errorMessage={options.errorMessage}
    overrideErrorMessage={options.overrideErrorMessage}
    onSyncAndAcknowledge={options.onSyncAndAcknowledge ?? jest.fn()}
    onFinalizeWithOverride={options.onFinalizeWithOverride ?? jest.fn()}
    onOpenSettlementDetails={jest.fn()}
    onOpenGroupHistory={jest.fn()}
    billState={{ kind: 'unpublished' }}
    onOpenBillAllocation={jest.fn()}
    onReturnToGroupHome={jest.fn()}
  />);
}

describe('GroupSummaryScreen member synchronization', () => {
  it('places one sync action inside the current member row', async () => {
    let mounted: Rendered | undefined;
    await renderer.act(() => { mounted = renderSummary(); });

    const ownRow = mounted!.root.findByProps({ testID: 'leaderboard-row-member' });
    const syncButton = findButton(ownRow, 'Sync saved session data and confirm')[0];
    expect(syncButton).toBeDefined();
    expect(typeof syncButton.props.style).not.toBe('function');
    expect(styleHasBackground(syncButton.props.style, '#2563EB')).toBe(true);
    expect(findButton(mounted!.root, 'Sync saved session data and confirm')).toHaveLength(1);
    expect(findText(ownRow, 'Waiting to sync')).toHaveLength(0);
    expect(findText(mounted!.root, 'Your final sync')).toHaveLength(0);
    const memberDetails = ownRow.findByProps({ testID: 'member-details-member' });
    expect(findButton(memberDetails, 'Sync saved session data and confirm')).toHaveLength(0);
    expect(findButton(ownRow.findByProps({ testID: 'member-action-member' }), 'Sync saved session data and confirm')).toHaveLength(1);
    const rankBadge = ownRow.findByProps({ testID: 'rank-badge-member' });
    expect(styleHasValue(rankBadge.props.style, 'right', -2)).toBe(true);
    expect(styleHasValue(rankBadge.props.style, 'bottom', -2)).toBe(true);

    await renderer.act(async () => mounted?.unmount());
  });

  it('shows a truthful waiting status for peers and a synced status from acknowledgment data', async () => {
    let mounted: Rendered | undefined;
    await renderer.act(() => {
      mounted = renderSummary({ members: [
        member({ uid: 'host', displayName: 'Bin Ne', role: 'HOST', syncAcknowledgedAtUtcMs: null }),
        member({ uid: 'member', displayName: 'Hehe', syncAcknowledgedAtUtcMs: 1_000 }),
      ], actorUid: 'observer' });
    });

    expect(findText(mounted!.root, 'Waiting to sync')).toHaveLength(1);
    expect(findText(mounted!.root, 'Synced')).toHaveLength(1);
    expect(findText(mounted!.root, 'Syncing…')).toHaveLength(0);
    const waitingLabel = findText(mounted!.root, 'Waiting to sync')[0];
    expect(styleHasValue(waitingLabel.props.style, 'color', '#9A5800')).toBe(true);

    await renderer.act(async () => mounted?.unmount());
  });

  it('hides the sync action for the current member after their acknowledgment is observed', async () => {
    let mounted: Rendered | undefined;
    await renderer.act(() => {
      mounted = renderSummary({ members: defaultMembers.map(item => item.uid === 'member'
        ? { ...item, syncAcknowledgedAtUtcMs: 1_000 }
        : item) });
    });

    const ownRow = mounted!.root.findByProps({ testID: 'leaderboard-row-member' });
    expect(findText(ownRow, 'Synced')).toHaveLength(1);
    expect(findButton(ownRow, 'Sync saved session data and confirm')).toHaveLength(0);

    await renderer.act(async () => mounted?.unmount());
  });

  it('keeps an early-exit member in the completed leaderboard with their sync action', async () => {
    let mounted: Rendered | undefined;
    await renderer.act(() => {
      mounted = renderSummary({ actorUid: 'early', members: [
        member({ uid: 'early', displayName: 'Early Member', status: 'EARLY_EXIT', penaltyScore: 18 }),
        member({ uid: 'active', displayName: 'Active Member', penaltyScore: 4 }),
      ] });
    });

    const earlyRow = mounted!.root.findByProps({ testID: 'leaderboard-row-early' });
    expect(findButton(earlyRow, 'Sync saved session data and confirm')).toHaveLength(1);

    await renderer.act(async () => mounted?.unmount());
  });

  it('keeps the current member action disabled while offline and shows the local syncing state', async () => {
    let mounted: Rendered | undefined;
    await renderer.act(() => { mounted = renderSummary({ isOnline: false }); });
    expect(findButton(mounted!.root, 'Sync saved session data and confirm')[0].props.disabled).toBe(true);
    expect(findText(mounted!.root, 'Connect to the internet to sync and confirm.')).toHaveLength(1);
    await renderer.act(async () => mounted?.unmount());

    await renderer.act(() => { mounted = renderSummary({ isSyncing: true }); });
    expect(findText(mounted!.root, 'Syncing…')).toHaveLength(1);
    expect(findButton(mounted!.root, 'Sync saved session data and confirm')[0].props.disabled).toBe(true);
    await renderer.act(async () => mounted?.unmount());
  });

  it('shows acknowledgment errors in the current member row without dropping their score', async () => {
    let mounted: Rendered | undefined;
    await renderer.act(() => { mounted = renderSummary({ errorMessage: 'Some saved session data is still waiting to sync. Reconnect and retry.' }); });

    const ownRow = mounted!.root.findByProps({ testID: 'leaderboard-row-member' });
    expect(findText(mounted!.root, 'Some saved session data is still waiting to sync. Reconnect and retry.')).toHaveLength(1);
    expect(mounted!.root.findByProps({ testID: 'sync-error-panel-member' })).toBeDefined();
    expect(findText(ownRow, '122 pts')).toHaveLength(1);

    await renderer.act(async () => mounted?.unmount());
  });

  it('uses initials when an avatar is absent and falls back after image loading fails', async () => {
    let mounted: Rendered | undefined;
    await renderer.act(() => { mounted = renderSummary({ members: [
      member({ uid: 'host', displayName: 'Bin Ne', role: 'HOST' }),
      member({ uid: 'member', displayName: 'Hehe', avatarUri: 'https://example.invalid/avatar.jpg' }),
    ] }); });

    expect(findText(mounted!.root, 'BN')).toHaveLength(1);
    const image = mounted!.root.findAll(node => node.type === 'AvatarImage')[0];
    expect(image).toBeDefined();
    await renderer.act(() => { (image.props.onError as () => void)(); });
    expect(findText(mounted!.root, 'HE')).toHaveLength(1);

    await renderer.act(async () => mounted?.unmount());
  });
});

describe('GroupSummaryScreen Host finalization', () => {
  it('renders the separate Host override action only when authoritative count matches the pending roster', async () => {
    let mounted: Rendered | undefined;
    await renderer.act(() => { mounted = renderSummary({ actorUid: 'host' }); });
    const finalizeButton = findButton(mounted!.root, 'Finalize scores without waiting for pending members')[0];
    expect(finalizeButton).toBeDefined();
    expect(typeof finalizeButton.props.style).not.toBe('function');
    expect(styleHasBackground(finalizeButton.props.style, '#FEF2F2')).toBe(true);
    expect(findText(mounted!.root, 'Hehe')).toHaveLength(1);
    await renderer.act(async () => mounted?.unmount());

    await renderer.act(() => { mounted = renderSummary({ actorUid: 'host', pendingMemberCount: null }); });
    expect(findButton(mounted!.root, 'Finalize scores without waiting for pending members')).toHaveLength(0);
    await renderer.act(async () => mounted?.unmount());

    await renderer.act(() => { mounted = renderSummary({ actorUid: 'host', pendingMemberCount: 1 }); });
    expect(findButton(mounted!.root, 'Finalize scores without waiting for pending members')).toHaveLength(0);
    await renderer.act(async () => mounted?.unmount());

    await renderer.act(() => { mounted = renderSummary({ actorUid: 'host', pendingMemberCount: 0 }); });
    expect(findText(mounted!.root, 'The pending count and member list are updating. Wait for the latest room snapshot before finalizing.')).toHaveLength(1);
    expect(findButton(mounted!.root, 'Finalize scores without waiting for pending members')).toHaveLength(0);
    await renderer.act(async () => mounted?.unmount());

    await renderer.act(() => { mounted = renderSummary({ actorUid: 'member' }); });
    expect(findButton(mounted!.root, 'Finalize scores without waiting for pending members')).toHaveLength(0);
    await renderer.act(async () => mounted?.unmount());
  });

  it('retains the existing warning confirmation before finalizing early', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    let mounted: Rendered | undefined;
    const onFinalizeWithOverride = jest.fn();
    await renderer.act(() => { mounted = renderSummary({ actorUid: 'host', onFinalizeWithOverride }); });

    await renderer.act(() => {
      (findButton(mounted!.root, 'Finalize scores without waiting for pending members')[0].props.onPress as () => void)();
    });
    expect(alert).toHaveBeenCalledWith(
      'Finalize without waiting?',
      'Some Members have not synced. Late violations will not affect payment.',
      expect.any(Array),
    );
    expect(onFinalizeWithOverride).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as { text?: string; onPress?: () => void }[];
    await renderer.act(() => buttons.find(button => button.text === 'Finalize scores')?.onPress?.());
    expect(onFinalizeWithOverride).toHaveBeenCalledWith(['host', 'member']);

    alert.mockRestore();
    await renderer.act(async () => mounted?.unmount());
  });

  it('excludes removed members from the sync count and Host override target list', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    let mounted: Rendered | undefined;
    const onFinalizeWithOverride = jest.fn();
    await renderer.act(() => {
      mounted = renderSummary({
        actorUid: 'host',
        members: [
          member({ uid: 'host', displayName: 'Host', role: 'HOST' }),
          member({ uid: 'member', displayName: 'Member' }),
          member({ uid: 'removed', displayName: 'Removed', status: 'REMOVED' }),
        ],
        onFinalizeWithOverride,
      });
    });
    expect(findText(mounted!.root, 'Member sync · 2')).toHaveLength(1);
    expect(mounted!.root.findAll(node => node.props.testID === 'leaderboard-row-removed')).toHaveLength(0);
    expect(findText(mounted!.root, 'Removed')).toHaveLength(0);

    await renderer.act(() => {
      (findButton(mounted!.root, 'Finalize scores without waiting for pending members')[0].props.onPress as () => void)();
    });
    const buttons = alert.mock.calls[0][2] as { text?: string; onPress?: () => void }[];
    await renderer.act(() => buttons.find(button => button.text === 'Finalize scores')?.onPress?.());
    expect(onFinalizeWithOverride).toHaveBeenCalledWith(['host', 'member']);

    alert.mockRestore();
    await renderer.act(async () => mounted?.unmount());
  });

  it('keeps Host override offline, busy, and error states visible', async () => {
    let mounted: Rendered | undefined;
    await renderer.act(() => {
      mounted = renderSummary({ actorUid: 'host', isOnline: false, overrideErrorMessage: 'Could not finalize the room.' });
    });
    const offlineButton = findButton(mounted!.root, 'Finalize scores without waiting for pending members')[0];
    expect(offlineButton.props.disabled).toBe(true);
    expect(findText(mounted!.root, 'Connect to the internet to finalize scores.')).toHaveLength(1);
    expect(findText(mounted!.root, 'Could not finalize the room.')).toHaveLength(1);
    await renderer.act(async () => mounted?.unmount());

    await renderer.act(() => { mounted = renderSummary({ actorUid: 'host', isFinalizingOverride: true }); });
    expect(findText(mounted!.root, 'Finalizing…')).toHaveLength(1);
    expect(findButton(mounted!.root, 'Finalize scores without waiting for pending members')[0].props.disabled).toBe(true);
    await renderer.act(async () => mounted?.unmount());
  });

  it('distinguishes all-synced completion from Host override completion', async () => {
    let mounted: Rendered | undefined;
    await renderer.act(() => { mounted = renderSummary({
      status: 'FINALIZED', finalizationReason: 'ALL_SYNCED', pendingMemberCount: 0,
      members: defaultMembers.map(item => ({ ...item, syncAcknowledgedAtUtcMs: 1_000 })),
    }); });
    expect(findText(mounted!.root, 'ALL MEMBERS SYNCED')).toHaveLength(1);
    expect(findButton(mounted!.root, 'Finalize scores without waiting for pending members')).toHaveLength(0);
    await renderer.act(async () => mounted?.unmount());

    await renderer.act(() => { mounted = renderSummary({ status: 'FINALIZED', finalizationReason: 'HOST_OVERRIDE' }); });
    expect(findText(mounted!.root, 'Members not synced at finalization')).toHaveLength(1);
    await renderer.act(async () => mounted?.unmount());
  });
});
