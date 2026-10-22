import React from 'react';
import { Alert } from 'react-native';
import { ProfileScreen } from '../src/screens/ProfileScreen';

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('../src/constants/theme', () => ({ Colors: { light: {
  authBackdrop: 'white', text: 'black', textSecondary: 'gray', primary: 'blue', onPrimary: 'white', error: 'red',
  border: 'gray', backgroundSelected: 'lightblue', inputSurface: 'white', backgroundElement: 'lightgray',
} }, Spacing: { three: 16, four: 24 } }));
jest.mock('../src/components/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../src/features/profile/profile-repository', () => ({
  ProfileEditError: class ProfileEditError extends Error {},
  validateProfileDisplayName: (input: string) => ({ value: input.trim() }),
}));

type Node = { props: Record<string, unknown>; findByProps(props: Record<string, unknown>): Node };
type Rendered = { root: Node; unmount(): void };
const renderer = require('react-test-renderer') as {
  create(element: React.ReactElement): Rendered;
  act(task: () => void | Promise<void>): Promise<void>;
};

test('shows why the account remains signed in when sign-out fails', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const onSignOut = jest.fn().mockResolvedValue({ kind: 'failed', message: 'Please try again.' });
  let screen: Rendered | undefined;
  try {
    await renderer.act(async () => {
      screen = renderer.create(<ProfileScreen
        profile={{ uid: 'user-a', email: 'a@example.test', displayName: 'A', isPremium: false, createdAtUtcMs: 0 }}
        repository={{ listen: jest.fn(() => jest.fn()) } as never}
        onProfileUpdated={jest.fn()} onSignOut={onSignOut} onBack={jest.fn()}
      />);
      await Promise.resolve();
    });
    await renderer.act(() => {
      (screen!.root.findByProps({ accessibilityLabel: 'Sign out' }).props.onPress as () => void)();
    });
    const confirmationButtons = alert.mock.calls[0][2] as Array<{ text?: string; onPress?: () => void }>;
    await renderer.act(async () => confirmationButtons.find(button => button.text === 'Sign out')?.onPress?.());

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenLastCalledWith('Sign out failed', 'Please try again.');
  } finally {
    await renderer.act(() => screen?.unmount());
    alert.mockRestore();
  }
});
