import React from 'react';
import { Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BillAllocationScreen } from '../src/screens/BillAllocationScreen';
import type { PublishedBill } from '../src/features/settlement/bill-repository';

jest.mock('../src/components/GlassCard', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../src/constants/theme', () => ({ Colors: { light: {
  text: '#000000', textSecondary: '#60646C', primary: '#004AC6', onPrimary: '#FFFFFF',
  error: '#B42318', border: '#E6E6E6', backgroundSelected: '#EFF6FF', inputSurface: '#FFFFFF',
  backgroundElement: '#F2F4F7', success: '#059669', authFormSurface: '#FFFFFF', glassBorder: '#FFFFFF', glassShadow: '#000000',
} } }));

type Node = {
  props: Record<string, unknown>;
  findByProps(props: Record<string, unknown>): Node;
  findAllByProps(props: Record<string, unknown>): Node[];
  findAllByType(type: unknown): Node[];
};
type Rendered = { root: Node; toJSON(): unknown; update(element: React.ReactElement): void; unmount(): void };
const renderer = require('react-test-renderer') as {
  create(element: React.ReactElement): Rendered;
  act(task: () => void | Promise<void>): Promise<void>;
};
const bill: PublishedBill = {
  version: 1, requestId: 'request', roomId: 'room', totalBillVnd: 1_000,
  calculationVersion: 1, shares: [{ uid: 'member', shareVnd: 1_000 }], sumShareVnd: 1_000,
};

test.each(['published', 'cached', 'error'] as const)('Pay share navigation requires a current published bill (%s)', async kind => {
  const onPayShare = jest.fn();
  let mounted: Rendered | undefined;
  try {
    await renderer.act(() => {
      mounted = renderer.create(<BillAllocationScreen
        roomId="room" mode="member" actorUid="member" onPayShare={onPayShare}
        members={[{ uid: 'member', displayName: 'Member', penaltyScore: 0 }]}
        state={{ kind, bill }} isOnline isPublishing={false}
        onPublish={jest.fn()} onRetry={jest.fn()} onRetryPublish={jest.fn()} onBack={jest.fn()}
      />);
    });
    const button = mounted!.root.findByProps({ accessibilityLabel: 'View VietQR for your published share' });
    expect(button.props.disabled).toBe(kind !== 'published');
    if (kind === 'published') {
      await renderer.act(() => { (button.props.onPress as () => void)(); });
      expect(onPayShare).toHaveBeenCalledTimes(1);
    }
  } finally {
    await renderer.act(async () => mounted?.unmount());
  }
});

test('AI scan entry point offers receipt capture and photo selection to a Premium Host', async () => {
  let mounted: Rendered | undefined;
  try {
    await renderer.act(() => {
      mounted = renderer.create(<BillAllocationScreen
        roomId="room" mode="host"
        members={[{ uid: 'host', displayName: 'Host', penaltyScore: 0 }]}
        state={{ kind: 'unpublished', bill: null }} isOnline isPublishing={false}
        onPublish={jest.fn()} onRetry={jest.fn()} onRetryPublish={jest.fn()} onBack={jest.fn()}
      />);
    });

    expect(mounted!.root.findByProps({ accessibilityLabel: 'Take receipt photo' })).toBeTruthy();
    expect(mounted!.root.findByProps({ accessibilityLabel: 'Choose receipt photo' })).toBeTruthy();
    expect(mounted!.root.findAllByProps({ children: 'AI bill scan' }).length).toBeGreaterThan(0);
    expect(mounted!.root.findAllByProps({ children: 'Room score' }).length).toBeGreaterThan(0);
    expect(mounted!.root.findAllByProps({ children: 'Custom %' }).length).toBeGreaterThan(0);
  } finally {
    await renderer.act(async () => mounted?.unmount());
  }
});

test('member does not see receipt scan and non-Premium Host can open Premium', async () => {
  let member: Rendered | undefined;
  let host: Rendered | undefined;
  const onOpenPremium = jest.fn();
  try {
    await renderer.act(() => { member = renderer.create(<BillAllocationScreen roomId="room" mode="member"
      members={[{ uid: 'member', displayName: 'Member', penaltyScore: 0 }]} state={{ kind: 'unpublished', bill: null }}
      isOnline isPublishing={false} onPublish={jest.fn()} onRetry={jest.fn()} onRetryPublish={jest.fn()} onBack={jest.fn()} />); });
    expect(member!.root.findAllByProps({ accessibilityLabel: 'Take receipt photo' })).toHaveLength(0);
    await renderer.act(() => { host = renderer.create(<BillAllocationScreen roomId="room" mode="host" isPremium={false} onOpenPremium={onOpenPremium}
      members={[{ uid: 'host', displayName: 'Host', penaltyScore: 0 }]} state={{ kind: 'unpublished', bill: null }}
      isOnline isPublishing={false} onPublish={jest.fn()} onRetry={jest.fn()} onRetryPublish={jest.fn()} onBack={jest.fn()} />); });
    await renderer.act(() => { (host!.root.findByProps({ accessibilityLabel: 'View Premium' }).props.onPress as () => void)(); });
    expect(onOpenPremium).toHaveBeenCalledTimes(1);
  } finally {
    await renderer.act(async () => { member?.unmount(); host?.unmount(); });
  }
});

test('picker cancellation does not call the scan API', async () => {
  const onScanReceipt = jest.fn();
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: true, assets: null });
  let mounted: Rendered | undefined;
  try {
    await renderer.act(() => { mounted = renderer.create(<BillAllocationScreen roomId="room" mode="host" isPremium
      onScanReceipt={onScanReceipt} members={[{ uid: 'host', displayName: 'Host', penaltyScore: 0 }]}
      state={{ kind: 'unpublished', bill: null }} isOnline isPublishing={false}
      onPublish={jest.fn()} onRetry={jest.fn()} onRetryPublish={jest.fn()} onBack={jest.fn()} />); });
    await renderer.act(async () => { (mounted!.root.findByProps({ accessibilityLabel: 'Choose receipt photo' }).props.onPress as () => void)(); });
    expect(onScanReceipt).not.toHaveBeenCalled();
  } finally { await renderer.act(async () => mounted?.unmount()); }
});

test('unsupported photo format shows an actionable message without uploading', async () => {
  const onScanReceipt = jest.fn();
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///receipt.heic', mimeType: 'image/heic' } as ImagePicker.ImagePickerAsset] });
  let mounted: Rendered | undefined;
  try {
    await renderer.act(() => { mounted = renderer.create(<BillAllocationScreen roomId="room" mode="host" isPremium
      onScanReceipt={onScanReceipt} members={[{ uid: 'host', displayName: 'Host', penaltyScore: 0 }]}
      state={{ kind: 'unpublished', bill: null }} isOnline isPublishing={false}
      onPublish={jest.fn()} onRetry={jest.fn()} onRetryPublish={jest.fn()} onBack={jest.fn()} />); });
    await renderer.act(async () => { (mounted!.root.findByProps({ accessibilityLabel: 'Choose receipt photo' }).props.onPress as () => void)(); });
    expect(onScanReceipt).not.toHaveBeenCalled();
    expect(mounted!.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain('JPEG, PNG, or WebP');
  } finally { await renderer.act(async () => mounted?.unmount()); }
});

test('shows loading state and blocks duplicate scans', async () => {
  let resolveScan!: (result: unknown) => void;
  const onScanReceipt = jest.fn(() => new Promise(resolve => { resolveScan = resolve; }));
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///receipt.png', mimeType: 'image/png' } as ImagePicker.ImagePickerAsset] });
  let mounted: Rendered | undefined;
  try {
    await renderer.act(() => { mounted = renderer.create(<BillAllocationScreen roomId="room" mode="host" isPremium
      onScanReceipt={onScanReceipt as never} members={[{ uid: 'host', displayName: 'Host', penaltyScore: 0 }]}
      state={{ kind: 'unpublished', bill: null }} isOnline isPublishing={false}
      onPublish={jest.fn()} onRetry={jest.fn()} onRetryPublish={jest.fn()} onBack={jest.fn()} />); });
    await renderer.act(async () => { (mounted!.root.findByProps({ accessibilityLabel: 'Choose receipt photo' }).props.onPress as () => void)(); });
    expect(mounted!.root.findByProps({ accessibilityLabel: 'Choose receipt photo' }).props.disabled).toBe(true);
    await renderer.act(async () => { resolveScan({ version: 1, status: 'needs_review', amount: null, suggested_amount: null,
      currency: 'VND', needs_confirmation: true, evidence: null, warnings: [], timings_ms: { total: 1 } }); });
    expect(mounted!.root.findByProps({ accessibilityLabel: 'Dismiss scan result' })).toBeTruthy();
  } finally { await renderer.act(async () => mounted?.unmount()); }
});

test('scan result stays a suggestion until the Host confirms it; rejection preserves the current value', async () => {
  const onScanReceipt = jest.fn().mockResolvedValue({ version: 1, status: 'suggested', amount: 128000, suggested_amount: 128000,
    currency: 'VND', needs_confirmation: true, evidence: { label: 'Total', amount_text: '128,000 VND' }, warnings: [], timings_ms: { total: 1 } });
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///receipt.jpg', mimeType: 'image/jpeg', fileSize: 1000 } as ImagePicker.ImagePickerAsset] });
  let mounted: Rendered | undefined;
  try {
    await renderer.act(() => { mounted = renderer.create(<BillAllocationScreen roomId="room" mode="host" isPremium
      onScanReceipt={onScanReceipt} members={[{ uid: 'host', displayName: 'Host', penaltyScore: 0 }]}
      state={{ kind: 'unpublished', bill: null }} isOnline isPublishing={false}
      onPublish={jest.fn()} onRetry={jest.fn()} onRetryPublish={jest.fn()} onBack={jest.fn()} />); });
    await renderer.act(async () => { (mounted!.root.findByProps({ accessibilityLabel: 'Total bill amount in Vietnamese dong' }).props.onChangeText as (value: string) => void)('45000'); });
    await renderer.act(async () => { (mounted!.root.findByProps({ accessibilityLabel: 'Choose receipt photo' }).props.onPress as () => void)(); });
    expect(onScanReceipt).toHaveBeenCalledWith('room', 'file:///receipt.jpg', 'image/jpeg');
    expect(mounted!.root.findByProps({ accessibilityLabel: 'Total bill amount in Vietnamese dong' }).props.value).toBe('45000');
    expect(mounted!.root.findByProps({ accessibilityLabel: 'Receipt scan suggestion' })).toBeTruthy();
    expect(mounted!.root.findAllByType(Text).some(node => Array.isArray(node.props.children)
      && node.props.children.includes('Evidence: ') && node.props.children.includes('Total: 128,000 VND'))).toBe(true);
    await renderer.act(() => { (mounted!.root.findByProps({ accessibilityLabel: 'Keep current amount' }).props.onPress as () => void)(); });
    expect(mounted!.root.findByProps({ accessibilityLabel: 'Total bill amount in Vietnamese dong' }).props.value).toBe('45000');
    await renderer.act(async () => { (mounted!.root.findByProps({ accessibilityLabel: 'Choose receipt photo' }).props.onPress as () => void)(); });
    await renderer.act(() => { (mounted!.root.findByProps({ accessibilityLabel: 'Use this amount' }).props.onPress as () => void)(); });
    expect(mounted!.root.findByProps({ accessibilityLabel: 'Total bill amount in Vietnamese dong' }).props.value).toBe('128000');
  } finally { await renderer.act(async () => mounted?.unmount()); }
});

test('custom percentage split previews avatars and publishes only when percentages total 100%', async () => {
  const { Alert } = require('react-native') as typeof import('react-native');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const onPublish = jest.fn();
  let mounted: Rendered | undefined;
  try {
    await renderer.act(() => { mounted = renderer.create(<BillAllocationScreen roomId="room" mode="host"
      members={[{ uid: 'host', displayName: 'Host', penaltyScore: 0, avatarUri: 'https://example.com/host.jpg' },
        { uid: 'member', displayName: 'Member', penaltyScore: 0}]}
      state={{ kind: 'unpublished', bill: null }} isOnline isPublishing={false}
      onPublish={onPublish} onRetry={jest.fn()} onRetryPublish={jest.fn()} onBack={jest.fn()} />); });
    await renderer.act(() => { (mounted!.root.findByProps({ accessibilityLabel: 'Total bill amount in Vietnamese dong' }).props.onChangeText as (value: string) => void)('100000'); });
    await renderer.act(() => { (mounted!.root.findByProps({ accessibilityLabel: 'Enter custom percentages' }).props.onPress as () => void)(); });
    const hostPercent = mounted!.root.findByProps({ accessibilityLabel: 'Bill percentage for Host' });
    const memberPercent = mounted!.root.findByProps({ accessibilityLabel: 'Bill percentage for Member' });
    await renderer.act(() => { (hostPercent.props.onChangeText as (value: string) => void)('70'); });
    expect(mounted!.root.findByProps({ accessibilityLabel: 'Publish bill shares once' }).props.disabled).toBe(true);
    await renderer.act(() => { (memberPercent.props.onChangeText as (value: string) => void)('30'); });
    expect(mounted!.root.findAllByProps({ accessibilityLabel: 'Host avatar' }).length).toBeGreaterThan(0);
    const publish = mounted!.root.findByProps({ accessibilityLabel: 'Publish bill shares once' });
    expect(publish.props.disabled).toBe(false);
    expect((publish.props.style as Array<Record<string, unknown>>).some(style => style.backgroundColor === '#2563EB')).toBe(true);
    const customMethod = mounted!.root.findByProps({ accessibilityLabel: 'Enter custom percentages' });
    expect((customMethod.props.style as Array<Record<string, unknown>>).some(style => style.backgroundColor === '#2563EB')).toBe(true);
    expect(mounted!.root.findByProps({ children: 'Custom %' }).props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: '#FFFFFF' })]));
    await renderer.act(() => { (publish.props.onPress as () => void)(); });
    const choices = alert.mock.calls[0][2]!;
    await renderer.act(() => { choices[1].onPress!(); });
    expect(onPublish).toHaveBeenCalledWith(100000, [
      { uid: 'host', type: 'PERCENT_BPS', value: 7000 }, { uid: 'member', type: 'PERCENT_BPS', value: 3000 },
    ]);
  } finally {
    await renderer.act(() => mounted?.unmount());
    alert.mockRestore();
  }
});

test.each([
  { mode: 'host', kind: 'error' },
  { mode: 'member', kind: 'error' },
  { mode: 'host', kind: 'cached' },
  { mode: 'member', kind: 'cached' },
] as const)('shows saved amounts with the current $kind status for a $mode', async ({ mode, kind }) => {
  const onRetry = jest.fn();
  const onPublish = jest.fn();
  let mounted: Rendered | undefined;
  try {
    await renderer.act(() => {
      mounted = renderer.create(<BillAllocationScreen
        roomId="room" mode={mode}
        members={[{ uid: 'member', displayName: 'Member', penaltyScore: 0 }]}
        state={{ kind, bill }} isOnline={kind !== 'cached'} isPublishing={false}
        onPublish={onPublish} onRetry={onRetry} onRetryPublish={jest.fn()} onBack={jest.fn()}
      />);
    });

    expect(mounted!.root.findAllByProps({ children: 'Saved copy' }).length).toBeGreaterThan(0);
    const expectedMessage = kind === 'error' ? 'Could not load the published breakdown.'
      : 'Showing a saved copy. Reconnect to confirm the current published result.';
    expect(mounted!.root.findAllByProps({ children: expectedMessage }).length).toBeGreaterThan(0);
    expect(mounted!.root.findAllByProps({ children: 'Published to this room' })).toHaveLength(0);
    expect(mounted!.root.findAllByProps({ accessibilityLabel: 'Member pays 1.000 Vietnamese dong' }).length).toBeGreaterThan(0);
    expect(mounted!.root.findAllByProps({ accessibilityLabel: 'Publish bill shares once' })).toHaveLength(0);
    if (kind === 'error') {
      await renderer.act(() => {
        (mounted!.root.findByProps({ accessibilityLabel: 'Retry loading room bill' }).props.onPress as () => void)();
      });
      expect(onRetry).toHaveBeenCalledTimes(1);
    }
    expect(onPublish).not.toHaveBeenCalled();
  } finally {
    await renderer.act(async () => mounted?.unmount());
  }
});

test('Host confirmation waits for modal approval and captures publication identity', async () => {
  const { Alert } = require('react-native') as typeof import('react-native');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const onMarkPaid = jest.fn();
  let mounted: Rendered | undefined;
  try {
    await renderer.act(() => { mounted = renderer.create(<BillAllocationScreen roomId="room" mode="host"
      members={[{ uid: 'member', displayName: 'Member', penaltyScore: 0 }]} state={{ kind: 'published', bill }}
      isOnline isPublishing={false} onPublish={jest.fn()} onRetry={jest.fn()} onRetryPublish={jest.fn()} onBack={jest.fn()} onMarkPaid={onMarkPaid} />); });
    await renderer.act(() => { (mounted!.root.findByProps({ accessibilityLabel: 'Mark Member as paid' }).props.onPress as () => void)(); });
    expect(onMarkPaid).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2]!;
    expect(buttons[0].style).toBe('cancel');
    await renderer.act(() => { buttons[1].onPress!(); });
    expect(onMarkPaid).toHaveBeenCalledWith('member', 'request', 0);
  } finally { await renderer.act(() => mounted?.unmount()); alert.mockRestore(); }
});

test('pending payment retry stays accessible without the editor', async () => {
  const retry = jest.fn();
  let mounted: Rendered | undefined;
  try {
    await renderer.act(() => { mounted = renderer.create(<BillAllocationScreen roomId="room" mode="host"
      members={[{ uid: 'member', displayName: 'Member', penaltyScore: 0 }]} state={{ kind: 'published', bill }}
      isOnline isPublishing={false} onPublish={jest.fn()} onRetry={jest.fn()} onRetryPublish={jest.fn()} onBack={jest.fn()}
      pendingPaymentMemberUid="member" onRetryPayment={retry} />); });
    const button = mounted!.root.findByProps({ accessibilityLabel: 'Retry the saved payment confirmation' });
    expect(button.props.disabled).toBe(false);
    await renderer.act(() => { (button.props.onPress as () => void)(); });
    expect(retry).toHaveBeenCalledTimes(1);
  } finally { await renderer.act(() => mounted?.unmount()); }
});

test('a live first payment restores remaining payment actions while Host is editing', async () => {
  const initial: PublishedBill = { ...bill, billPaidCount: 0, shares: [
    { uid: 'host', shareVnd: 500 }, { uid: 'member', shareVnd: 500 },
  ] };
  const props = { roomId: 'room', mode: 'host' as const, actorUid: 'member',
    members: [{ uid: 'host', displayName: 'Host', penaltyScore: 0 }, { uid: 'member', displayName: 'Member', penaltyScore: 0 }],
    isOnline: true, isPublishing: false, onPublish: jest.fn(), onRetry: jest.fn(),
    onRetryPublish: jest.fn(), onBack: jest.fn(), onMarkPaid: jest.fn(), onPayShare: jest.fn() };
  let mounted: Rendered | undefined;
  try {
    await renderer.act(() => { mounted = renderer.create(<BillAllocationScreen {...props} state={{ kind: 'published', bill: initial }} />); });
    await renderer.act(() => { (mounted!.root.findByProps({ accessibilityLabel: 'Adjust bill shares before first payment' }).props.onPress as () => void)(); });
    expect(mounted!.root.findAllByProps({ accessibilityLabel: 'Cancel editing bill shares' }).length).toBeGreaterThan(0);
    expect(mounted!.root.findAllByProps({ accessibilityLabel: 'Mark Member as paid' })).toHaveLength(0);
    const paid: PublishedBill = { ...initial, billPaidCount: 1, shares: [
      { ...initial.shares[0], paymentStatus: 'MARKED_AS_PAID', paidAtUtcMs: 1234 }, initial.shares[1],
    ] };
    await renderer.act(() => { mounted!.update(<BillAllocationScreen {...props} state={{ kind: 'published', bill: paid }} />); });
    expect(mounted!.root.findAllByProps({ accessibilityLabel: 'Cancel editing bill shares' })).toHaveLength(0);
    expect(mounted!.root.findAllByProps({ accessibilityLabel: 'Publish replacement bill shares' })).toHaveLength(0);
    expect(mounted!.root.findByProps({ accessibilityLabel: 'Mark Member as paid' }).props.disabled).toBe(false);
    expect(mounted!.root.findByProps({ accessibilityLabel: 'View VietQR for your published share' }).props.disabled).toBe(false);
  } finally { await renderer.act(() => mounted?.unmount()); }
});
