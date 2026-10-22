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
