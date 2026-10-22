import React from 'react';
import { BillAllocationScreen } from '../src/screens/BillAllocationScreen';
import type { PublishedBill } from '../src/features/settlement/bill-repository';

jest.mock('../src/components/GlassCard', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../src/constants/theme', () => ({ Colors: { light: {
  text: '#000000', textSecondary: '#60646C', primary: '#004AC6', onPrimary: '#FFFFFF',
  error: '#B42318', border: '#E6E6E6',
} } }));

type Node = {
  props: Record<string, unknown>;
  findByProps(props: Record<string, unknown>): Node;
  findAllByProps(props: Record<string, unknown>): Node[];
};
type Rendered = { root: Node; unmount(): void };
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
