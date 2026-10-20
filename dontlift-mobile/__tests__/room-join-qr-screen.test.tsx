import React from 'react';
import { JoinRoomScreen } from '../src/screens/JoinRoomScreen';

let mockPermission: { granted: boolean; canAskAgain: boolean } | null = null;
const mockRequestPermission = jest.fn<Promise<{ granted: boolean; canAskAgain: boolean }>, []>();

jest.mock('expo-camera', () => ({
  CameraView: (props: Record<string, unknown>) => {
    const react = require('react') as typeof React;
    return react.createElement('CameraView', props);
  },
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
}));
jest.mock('../src/constants/theme', () => ({ Colors: { light: {
  text: '#000', textSecondary: '#60646C', primary: '#004AC6', border: '#C3C6D7',
  inputSurface: '#fff', glassSurface: '#fff', glassBorder: '#eee', error: '#B42318',
} } }));

type Node = { props: Record<string, unknown>; findByProps(props: Record<string, unknown>): Node };
type Rendered = { root: Node; unmount(): void };
const renderer = require('react-test-renderer') as {
  create(element: React.ReactElement): Rendered;
  act(task: () => void | Promise<void>): Promise<void>;
};
let mounted: Rendered | undefined;

beforeEach(() => {
  mockPermission = null;
  mockRequestPermission.mockReset();
});
afterEach(async () => { if (mounted) await renderer.act(() => mounted?.unmount()); mounted = undefined; });

test('asks for camera permission only after the user opens the scanner', async () => {
  mockRequestPermission.mockResolvedValue({ granted: true, canAskAgain: true });
  await renderer.act(() => { mounted = renderer.create(<JoinRoomScreen result={null} isJoining={false} onJoin={jest.fn()} onCancel={jest.fn()} />); });

  expect(mockRequestPermission).not.toHaveBeenCalled();
  await renderer.act(async () => {
    (mounted!.root.findByProps({ title: 'Quét mã QR' }).props.onPress as () => Promise<void>)();
  });
  expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  expect(mounted!.root.findByProps({ testID: 'room-invite-camera' })).toBeDefined();
});

test('does not mount the scanner when permission is denied and keeps manual PIN entry available', async () => {
  mockRequestPermission.mockResolvedValue({ granted: false, canAskAgain: false });
  await renderer.act(() => { mounted = renderer.create(<JoinRoomScreen result={null} isJoining={false} onJoin={jest.fn()} onCancel={jest.fn()} />); });
  await renderer.act(async () => {
    (mounted!.root.findByProps({ title: 'Quét mã QR' }).props.onPress as () => Promise<void>)();
  });

  expect(mounted!.root.findByProps({ accessibilityLabel: 'Mã PIN phòng' })).toBeDefined();
  expect(() => mounted!.root.findByProps({ testID: 'room-invite-camera' })).toThrow();
  expect(mounted!.root.findByProps({ title: 'Mở cài đặt quyền camera' })).toBeDefined();
  expect(JSON.stringify((mounted as Rendered & { toJSON(): unknown }).toJSON())).toContain('Bạn vẫn có thể nhập PIN');
});

test('joins a valid scan once and rejects invalid QR content without exposing it', async () => {
  mockPermission = { granted: true, canAskAgain: true };
  const onJoin = jest.fn();
  await renderer.act(() => { mounted = renderer.create(<JoinRoomScreen result={null} isJoining={false} onJoin={onJoin} onCancel={jest.fn()} />); });
  await renderer.act(async () => {
    (mounted!.root.findByProps({ title: 'Quét mã QR' }).props.onPress as () => Promise<void>)();
  });
  const camera = mounted!.root.findByProps({ testID: 'room-invite-camera' });
  const onBarcodeScanned = camera.props.onBarcodeScanned as (result: { data: string; type: string }) => void;
  await renderer.act(() => {
    onBarcodeScanned({ data: 'dontliftmobile://room/00000042', type: 'qr' });
    onBarcodeScanned({ data: 'dontliftmobile://room/00000042', type: 'qr' });
  });
  expect(onJoin).toHaveBeenCalledTimes(1);
  expect(onJoin).toHaveBeenCalledWith('00000042');
  expect(() => mounted!.root.findByProps({ testID: 'room-invite-camera' })).toThrow();
});

test('closes the scanner for an invalid invitation without showing scanned contents', async () => {
  mockPermission = { granted: true, canAskAgain: true };
  const onJoin = jest.fn();
  await renderer.act(() => { mounted = renderer.create(<JoinRoomScreen result={null} isJoining={false} onJoin={onJoin} onCancel={jest.fn()} />); });
  await renderer.act(async () => {
    (mounted!.root.findByProps({ title: 'Quét mã QR' }).props.onPress as () => Promise<void>)();
  });
  const onBarcodeScanned = mounted!.root.findByProps({ testID: 'room-invite-camera' }).props.onBarcodeScanned as (result: { data: string; type: string }) => void;
  await renderer.act(() => { onBarcodeScanned({ data: 'bank-secret-qr-content', type: 'qr' }); });

  expect(onJoin).not.toHaveBeenCalled();
  expect(() => mounted!.root.findByProps({ testID: 'room-invite-camera' })).toThrow();
  const tree = JSON.stringify((mounted as Rendered & { toJSON(): unknown }).toJSON());
  expect(tree).toContain('không phải lời mời vào phòng hợp lệ');
  expect(tree).not.toContain('bank-secret-qr-content');
});
