import React from 'react';
import { GroupLobbyScreen } from '../src/screens/GroupLobbyScreen';

jest.mock('../src/constants/theme', () => ({ Colors: { light: {
  primary: '#004AC6', glassSurface: '#FFFFFF', glassBorder: '#E6E6E6', error: '#B42318',
  qrBackground: '#FFFFFF', text: '#000000', textSecondary: '#60646C',
} } }));

type Node = { props: Record<string, unknown>; findByProps(props: Record<string, unknown>): Node };
type Rendered = { root: Node; unmount(): void };
const renderer = require('react-test-renderer') as {
  create(element: React.ReactElement): Rendered;
  act(task: () => void | Promise<void>): Promise<void>;
};

test('shows a cancel-and-join action only while room creation is pending', async () => {
  const onCancelCreate = jest.fn();
  const props = {
    room: null,
    errorMessage: undefined,
    onCreateRoom: jest.fn(),
    onJoinRoom: jest.fn(),
    onCancelCreate,
  };
  let mounted: Rendered | undefined;

  await renderer.act(() => {
    mounted = renderer.create(<GroupLobbyScreen {...props} isCreating />);
  });
  await renderer.act(() => {
    (mounted!.root.findByProps({ title: 'Hủy tạo, chuyển sang tham gia' }).props.onPress as () => void)();
  });
  expect(onCancelCreate).toHaveBeenCalledTimes(1);
  await renderer.act(async () => mounted?.unmount());

  await renderer.act(() => {
    mounted = renderer.create(<GroupLobbyScreen {...props} isCreating={false} />);
  });
  expect(() => mounted!.root.findByProps({ title: 'Hủy tạo, chuyển sang tham gia' })).toThrow();
  await renderer.act(async () => mounted?.unmount());
});

test('lets the host open Join Room after creation without deleting the waiting room', async () => {
  const onJoinRoom = jest.fn();
  let mounted: Rendered | undefined;
  await renderer.act(() => {
    mounted = renderer.create(<GroupLobbyScreen
      room={{
        roomId: 'room-1', pin: '00123456', invitation: 'dontliftmobile://room/00123456',
        hostUid: 'host-1', hostDisplayName: 'Host', createdAt: null, localCacheSaved: true,
      }}
      isCreating={false}
      onCreateRoom={jest.fn()}
      onJoinRoom={onJoinRoom}
      onCancelCreate={jest.fn()}
    />);
  });

  await renderer.act(() => {
    (mounted!.root.findByProps({ title: 'Tham gia phòng khác' }).props.onPress as () => void)();
  });
  expect(onJoinRoom).toHaveBeenCalledTimes(1);
  await renderer.act(async () => mounted?.unmount());
});
