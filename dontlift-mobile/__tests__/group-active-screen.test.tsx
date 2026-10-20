import React from 'react';
import { Alert } from 'react-native';
import { GroupActiveScreen } from '../src/screens/GroupActiveScreen';

jest.mock('../src/components/GlassCard', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../src/constants/theme', () => ({ Colors: { light: {
  text: '#000000', textSecondary: '#60646C', primary: '#004AC6', onPrimary: '#FFFFFF', error: '#B42318', border: '#E6E6E6',
} } }));

type Node = { props: Record<string, unknown>; findByProps(props: Record<string, unknown>): Node };
type Rendered = { root: Node; unmount(): void };
const renderer = require('react-test-renderer') as {
  create(element: React.ReactElement): Rendered;
  act(task: () => void | Promise<void>): Promise<void>;
};

const snapshot = {
  roomId: 'room-id', hostUid: 'host-id', status: 'ACTIVE', participantCount: 2,
  startedAtUtcMs: 10_000, pin: '12345678', createdAt: null, updatedAt: null,
  members: [
    { uid: 'host-id', displayName: 'Host', role: 'HOST', status: 'ACTIVE', penaltyScore: 0, liftCount: 0, violationDurationSeconds: 0, joinedAt: null },
    { uid: 'member-id', displayName: 'Member', role: 'MEMBER', status: 'ACTIVE', penaltyScore: 0, liftCount: 0, violationDurationSeconds: 0, joinedAt: null },
  ],
} as never;

test('asks for confirmation before submitting an early-exit request', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const onRequestEarlyExit = jest.fn();
  let mounted: Rendered | undefined;
  await renderer.act(() => {
    mounted = renderer.create(<GroupActiveScreen
      snapshot={snapshot}
      elapsedSeconds={10}
      detection={{ orientation: 'UPRIGHT', violationsCount: 0, violationDurationSeconds: 0, isGraceActive: false, graceSeconds: 0, persistenceError: null } as never}
      isOnline
      actorUid="member-id"
      openEarlyExitRequests={[]}
      isRequestingEarlyExit={false}
      decidingEarlyExitRequestId={null}
      onRequestEarlyExit={onRequestEarlyExit}
      onDecideEarlyExit={jest.fn()}
    />);
  });

  await renderer.act(() => {
    (mounted!.root.findByProps({ accessibilityLabel: 'Request early exit' }).props.onPress as () => void)();
  });
  expect(onRequestEarlyExit).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith(
    'Request early exit?',
    'Your score will freeze at current time.',
    expect.arrayContaining([
      expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
      expect.objectContaining({ text: 'Request' }),
    ]),
  );

  const buttons = alert.mock.calls[0][2] as Array<{ text?: string; onPress?: () => void }>;
  await renderer.act(() => buttons.find(button => button.text === 'Cancel')?.onPress?.());
  expect(onRequestEarlyExit).not.toHaveBeenCalled();
  await renderer.act(() => buttons.find(button => button.text === 'Request')?.onPress?.());
  expect(onRequestEarlyExit).toHaveBeenCalledTimes(1);

  await renderer.act(async () => mounted?.unmount());
  alert.mockRestore();
});
