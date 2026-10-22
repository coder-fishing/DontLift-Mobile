import React from 'react';
import { AppState } from 'react-native';
import { VietQRSettlementScreen } from '../src/screens/VietQRSettlementScreen';

jest.mock('expo-image', () => ({ Image: 'PaymentQrImage' }));
jest.mock('../src/components/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../src/constants/theme', () => ({ Colors: { light: {
  text: '#000000', textSecondary: '#60646C', primary: '#004AC6', onPrimary: '#FFFFFF',
  qrBackground: '#FFFFFF', qrForeground: '#000000', border: '#C3C6D7',
} } }));

type Node = {
  props: Record<string, unknown>;
  findByProps(props: Record<string, unknown>): Node;
  findAllByProps(props: Record<string, unknown>): Node[];
  findAllByType(type: string): Node[];
};
type Rendered = { root: Node; update(element: React.ReactElement): void; unmount(): void };
const renderer = require('react-test-renderer') as {
  create(element: React.ReactElement): Rendered;
  act(task: () => void | Promise<void>): Promise<void>;
};
function fixture(): React.ComponentProps<typeof VietQRSettlementScreen> {
  return {
    roomId: 'room', roomPin: '12345678', actorUid: 'member', isOnline: true,
    member: { uid: 'member', displayName: 'Minh', status: 'ACTIVE' },
    billState: { kind: 'published', bill: {
      version: 1, roomId: 'room', requestId: 'default', calculationVersion: 1,
      totalBillVnd: 1_000, sumShareVnd: 1_000, shares: [{ uid: 'member', shareVnd: 1_000 }],
    } },
    detailsState: { kind: 'ready', details: {
      version: 1, roomId: 'room', bankId: '970436', accountNumber: '001234567',
      accountName: 'HOST', updatedAtUtcMs: 900, expiresAtUtcMs: 10_000,
    } },
    onRefresh: jest.fn(), onBack: jest.fn(),
  };
}

describe('VietQR payment screen', () => {
  let mounted: Rendered | undefined;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000);
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  });
  afterEach(async () => {
    await renderer.act(() => mounted?.unmount());
    mounted = undefined;
    jest.useRealTimers();
  });

  test('retries a failed QR image and exposes the loaded code', async () => {
    await renderer.act(() => { mounted = renderer.create(<VietQRSettlementScreen {...fixture()} />); });
    await renderer.act(() => { (mounted!.root.findAllByType('PaymentQrImage')[0].props.onError as () => void)(); });
    const retry = mounted!.root.findByProps({ accessibilityLabel: 'Retry loading the VietQR image' });
    await renderer.act(() => { (retry.props.onPress as () => void)(); });
    const image = mounted!.root.findAllByType('PaymentQrImage')[0];
    expect(image.props.accessible).toBe(false);
    await renderer.act(() => { (image.props.onLoad as () => void)(); });
    expect(mounted!.root.findAllByType('PaymentQrImage')[0].props.accessible).toBe(true);
  });

  test('removes expired or cached QR instead of keeping the earlier image', async () => {
    const props = fixture();
    await renderer.act(() => { mounted = renderer.create(<VietQRSettlementScreen {...props} />); });
    expect(mounted!.root.findAllByType('PaymentQrImage')).toHaveLength(1);
    await renderer.act(() => { jest.advanceTimersByTime(9_000); });
    expect(mounted!.root.findAllByType('PaymentQrImage')).toHaveLength(0);
    await renderer.act(() => {
      mounted!.update(<VietQRSettlementScreen {...props} billState={{ kind: 'cached', bill: null }} />);
    });
    expect(mounted!.root.findAllByType('PaymentQrImage')).toHaveLength(0);
  });

  test('replaces the QR image and resets loading when the bill revision changes', async () => {
    const props = fixture();
    await renderer.act(() => { mounted = renderer.create(<VietQRSettlementScreen {...props} />); });
    await renderer.act(() => { (mounted!.root.findAllByType('PaymentQrImage')[0].props.onLoad as () => void)(); });
    if (props.billState.kind !== 'published') throw new Error();
    const bill = { ...props.billState.bill, requestId: 'replacement', billRevision: 1 };
    await renderer.act(() => { mounted!.update(<VietQRSettlementScreen {...props} billState={{ kind: 'published', bill }} />); });
    expect(mounted!.root.findAllByType('PaymentQrImage')[0].props.accessible).toBe(false);
  });

  test('times out a stalled image and keeps the back action usable', async () => {
    const props = fixture();
    if (props.detailsState.kind !== 'ready') throw new Error();
    props.detailsState.details.expiresAtUtcMs = 100_000;
    await renderer.act(() => { mounted = renderer.create(<VietQRSettlementScreen {...props} />); });
    await renderer.act(() => { jest.advanceTimersByTime(15_000); });
    expect(mounted!.root.findAllByProps({ accessibilityLabel: 'Retry loading the VietQR image' }).length).toBeGreaterThan(0);
    await renderer.act(() => {
      (mounted!.root.findByProps({ accessibilityLabel: 'Back to bill breakdown' }).props.onPress as () => void)();
    });
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
