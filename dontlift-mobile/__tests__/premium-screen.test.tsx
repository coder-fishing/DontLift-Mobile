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
const order = { version: 1 as const, orderCode: 42, requestId: 'saved-request', packageId: 'MONTH_1', amountVnd: 89000, status: 'PENDING' as const, checkoutUrl: 'https://pay.payos.vn/web/test', qrCode: 'test-qr-code', premiumExpiresAtUtcMs: null };
function api() { return { packages: jest.fn().mockResolvedValue([{ id: 'MONTH_1', amountVnd: 89000, paidMonths: 1, grantedMonths: 1 }]), current: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(order), get: jest.fn() }; }

afterEach(() => jest.clearAllMocks());
test('shows payOS QR in app and keeps pending payment identity until server confirms', async () => {
  const service = api();
  service.current.mockResolvedValue({ ...order, status: 'CREATING', checkoutUrl: null, qrCode: null });
  let screen: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { screen = renderer.create(<PremiumScreen uid="a" api={service} />); });
  await renderer.act(async () => { await screen.root.findByProps({ accessibilityLabel: 'Continue saved Premium checkout' }).props.onPress(); });
  expect(service.create).toHaveBeenCalledWith('saved-request', 'MONTH_1');
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('premium-checkout:a', JSON.stringify({ requestId: 'saved-request', packageId: 'MONTH_1' }));
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
  for (const price of ['89.000đ', '178.000đ', '356.000đ', '623.000đ']) expect(JSON.stringify(screen.toJSON())).toContain(price);
  expect(screen.root.findByProps({ accessibilityLabel: 'Purchase selected Premium package' }).props.disabled).toBe(true);
  expect(service.create).not.toHaveBeenCalled();
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
