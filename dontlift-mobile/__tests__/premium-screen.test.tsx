import React from 'react';
import { PremiumScreen } from '../src/screens/PremiumScreen';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn().mockResolvedValue({ type: 'dismiss' }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001' }));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined), removeItem: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/constants/theme', () => ({ Colors: { light: { text: 'black', primary: 'blue', onPrimary: 'white' } } }));
jest.mock('../src/components/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => children }));
const renderer = require('react-test-renderer');
const packageCatalog = [
  { id: 'MONTH_1', amountVnd: 30000, paidMonths: 1, grantedMonths: 1 },
  { id: 'MONTH_3', amountVnd: 79000, paidMonths: 3, grantedMonths: 4 },
  { id: 'MONTH_6', amountVnd: 149000, paidMonths: 6, grantedMonths: 8 },
  { id: 'MONTH_12', amountVnd: 249000, paidMonths: 12, grantedMonths: 16 },
];
const order = { version: 1 as const, orderCode: 42, requestId: 'saved-request', packageId: 'MONTH_1', amountVnd: 30000, status: 'PENDING' as const, checkoutUrl: 'https://pay.payos.vn/web/test', qrCode: 'test-qr-code', premiumExpiresAtUtcMs: null };
function api() { return { packages: jest.fn().mockResolvedValue(packageCatalog), current: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(order), cancelCurrent: jest.fn().mockResolvedValue(null), get: jest.fn().mockImplementation(async (orderCode: number) => ({ ...order, orderCode })) }; }

afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });
test('shows payOS QR in app and keeps pending payment identity until server confirms', async () => {
  const service = api();
  service.current.mockResolvedValue({ ...order, status: 'CREATING', checkoutUrl: null, qrCode: null });
  let screen: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { screen = renderer.create(<PremiumScreen uid="a" api={service} />); });
  await renderer.act(async () => { await screen.root.findByProps({ accessibilityLabel: 'Continue saved Premium checkout' }).props.onPress(); });
  expect(service.create).toHaveBeenCalledWith('saved-request', 'MONTH_1');
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('premium-checkout:a', JSON.stringify({ requestId: 'saved-request', packageId: 'MONTH_1', orderCode: 42 }));
  expect(screen.root.findByProps({ accessibilityLabel: 'Premium payment QR code' })).toBeTruthy();
  expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  await renderer.act(async () => { await screen.root.findByProps({ accessibilityLabel: 'Open payOS checkout' }).props.onPress(); });
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(order.checkoutUrl);
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  await renderer.act(async () => { screen.unmount(); });
});
test('failed create keeps a retry action accessible', async () => {
  const service = api();
  service.create.mockRejectedValue(new Error('Connection lost'));
  let screen: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { screen = renderer.create(<PremiumScreen uid="a" api={service} />); });
  await renderer.act(async () => { await screen.root.findByProps({ accessibilityLabel: 'Purchase selected Premium package' }).props.onPress(); });
  expect(screen.root.findByProps({ accessibilityLabel: 'Continue saved Premium checkout' }).props.disabled).toBe(false);
  await renderer.act(async () => { screen.unmount(); });
});

test('unconfigured backend shows package preview without enabling purchase', async () => {
  const service = api();
  service.packages.mockRejectedValue(new Error('Checkout is not available yet'));
  let screen: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { screen = renderer.create(<PremiumScreen uid="a" api={service} />); });
  for (const price of ['30.000đ', '79.000đ', '149.000đ', '249.000đ']) expect(JSON.stringify(screen.toJSON())).toContain(price);
  expect(screen.root.findByProps({ accessibilityLabel: 'Purchase selected Premium package' }).props.disabled).toBe(true);
  expect(service.create).not.toHaveBeenCalled();
  await renderer.act(async () => { screen.unmount(); });
});

test('renders the four approved offers and selects Best Value by default', async () => {
  const service = api();
  let screen: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { screen = renderer.create(<PremiumScreen uid="a" api={service} />); });
  const output = JSON.stringify(screen.toJSON());
  for (const text of ['1 month', 'Basic access', '3 months', '+1 month free', 'Use Premium for 4 months', '6 months', '+2 months free', 'Use Premium for 8 months', '12 months', '+4 months free', 'Use Premium for 16 months', 'BEST VALUE']) {
    expect(output).toContain(text);
  }
  const selectedRadio = screen.root.findAllByProps({ accessibilityRole: 'radio' }).find(
    (item: { props: { accessibilityState?: { checked?: boolean } }; key?: string }) => item.props.accessibilityState?.checked,
  );
  expect(selectedRadio?.key).toBe('MONTH_12');
  await renderer.act(async () => { screen.unmount(); });
});

test('checkout uses selected package identity without sending the displayed price', async () => {
  const service = api();
  let screen: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { screen = renderer.create(<PremiumScreen uid="a" api={service} />); });
  await renderer.act(async () => { await screen.root.findByProps({ accessibilityLabel: 'Purchase selected Premium package' }).props.onPress(); });
  expect(service.create).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', 'MONTH_12');
  await renderer.act(async () => { screen.unmount(); });
});

test('debounces package switching to the latest tap and shows a skeleton instead of the old QR', async () => {
  jest.useFakeTimers();
  const service = api();
  service.current.mockResolvedValue({ ...order, status: 'PENDING' });
  service.cancelCurrent.mockResolvedValue({ ...order, status: 'CANCELLED', qrCode: null });
  service.create.mockImplementation(async (requestId: string, packageId: string) => ({ ...order, requestId, packageId, qrCode: 'replacement-qr', amountVnd: 149000 }));
  let screen: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { screen = renderer.create(<PremiumScreen uid="a" api={service} />); });

  const select = async (packageId: string) => renderer.act(async () => {
    const option = screen.root.findAllByProps({ accessibilityRole: 'radio' }).find((node: { key?: string }) => node.key === packageId);
    option.props.onPress();
  });
  await select('MONTH_3');
  expect(screen.root.findByProps({ accessibilityLabel: 'Preparing new payment QR' })).toBeTruthy();
  expect(screen.root.findAllByProps({ accessibilityLabel: 'Premium payment QR code' })).toHaveLength(0);
  await renderer.act(async () => { await jest.advanceTimersByTimeAsync(200); });
  await select('MONTH_6');
  await renderer.act(async () => { await jest.advanceTimersByTimeAsync(399); });
  expect(service.cancelCurrent).not.toHaveBeenCalled();
  await renderer.act(async () => { await jest.advanceTimersByTimeAsync(1); });
  expect(service.cancelCurrent).toHaveBeenCalledTimes(1);
  expect(service.create).toHaveBeenCalledWith(expect.any(String), 'MONTH_6');
  expect(screen.root.findByProps({ accessibilityLabel: 'Premium payment QR code' })).toBeTruthy();
  await renderer.act(async () => { screen.unmount(); });
});

test('selecting the active package before debounce restores its QR without cancelling it', async () => {
  jest.useFakeTimers();
  const service = api();
  service.current.mockResolvedValue({ ...order, status: 'PENDING' });
  let screen: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { screen = renderer.create(<PremiumScreen uid="a" api={service} />); });
  const select = async (packageId: string) => renderer.act(async () => {
    const option = screen.root.findAllByProps({ accessibilityRole: 'radio' }).find((node: { key?: string }) => node.key === packageId);
    option.props.onPress();
  });
  await select('MONTH_3');
  expect(screen.root.findByProps({ accessibilityLabel: 'Preparing new payment QR' })).toBeTruthy();
  await select('MONTH_1');
  await renderer.act(async () => { await jest.advanceTimersByTimeAsync(400); });
  expect(service.cancelCurrent).not.toHaveBeenCalled();
  expect(screen.root.findByProps({ accessibilityLabel: 'Premium payment QR code' })).toBeTruthy();
  await renderer.act(async () => { screen.unmount(); });
});

test('does not create a replacement QR when cancellation cannot be confirmed', async () => {
  jest.useFakeTimers();
  const service = api();
  service.current.mockResolvedValue({ ...order, status: 'PENDING' });
  service.cancelCurrent.mockRejectedValue(new Error('Connection lost'));
  service.get.mockResolvedValue({ ...order, status: 'PENDING' });
  let screen: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { screen = renderer.create(<PremiumScreen uid="a" api={service} />); });
  await renderer.act(async () => {
    const option = screen.root.findAllByProps({ accessibilityRole: 'radio' }).find((node: { key?: string }) => node.key === 'MONTH_3');
    option.props.onPress();
  });
  await renderer.act(async () => { await jest.advanceTimersByTimeAsync(400); });
  expect(service.get).toHaveBeenCalledWith(42, true);
  expect(service.create).not.toHaveBeenCalled();
  expect(screen.root.findByProps({ accessibilityLabel: 'Retry package switch' })).toBeTruthy();
  expect(screen.root.findAllByProps({ accessibilityLabel: 'Premium payment QR code' })).toHaveLength(0);
  await renderer.act(async () => { screen.unmount(); });
});

test('keeps a payment that completed during package switching and creates no second order', async () => {
  jest.useFakeTimers();
  const service = api();
  service.current.mockResolvedValue({ ...order, status: 'PENDING' });
  service.cancelCurrent.mockResolvedValue({ ...order, status: 'PAID', qrCode: null });
  let screen: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { screen = renderer.create(<PremiumScreen uid="a" api={service} />); });
  await renderer.act(async () => {
    const option = screen.root.findAllByProps({ accessibilityRole: 'radio' }).find((node: { key?: string }) => node.key === 'MONTH_3');
    option.props.onPress();
  });
  await renderer.act(async () => { await jest.advanceTimersByTimeAsync(400); });
  expect(service.cancelCurrent).toHaveBeenCalledTimes(1);
  expect(service.create).not.toHaveBeenCalled();
  expect(JSON.stringify(screen.toJSON())).toContain('Payment confirmed');
  await renderer.act(async () => { screen.unmount(); });
});

test('offline purchase does not issue a checkout command', async () => {
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });
  const service = api();
  let screen: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { screen = renderer.create(<PremiumScreen uid="a" api={service} />); });
  await renderer.act(async () => { await screen.root.findByProps({ accessibilityLabel: 'Purchase selected Premium package' }).props.onPress(); });
  expect(service.create).not.toHaveBeenCalled();
  await renderer.act(async () => { screen.unmount(); });
});
