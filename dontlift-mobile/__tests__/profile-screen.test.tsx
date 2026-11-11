import React from 'react';
import { Alert } from 'react-native';
import { ProfileScreen } from '../src/screens/ProfileScreen';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
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

test('treats photo-library cancellation as a no-op', async () => {
  const picker = require('expo-image-picker') as { launchImageLibraryAsync: jest.Mock };
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
  const updateAvatar = jest.fn();
  let screen: Rendered | undefined;
  await renderer.act(async () => {
    screen = renderer.create(<ProfileScreen
      profile={{ uid: 'user-a', email: 'a@example.test', displayName: 'A', isPremium: false, createdAtUtcMs: 0 }}
      repository={{ listen: jest.fn(() => jest.fn()), updateAvatar } as never}
      onProfileUpdated={jest.fn()} onSignOut={jest.fn()} onBack={jest.fn()}
    />);
    await Promise.resolve();
  });
  await renderer.act(async () => {
    await (screen!.root.findByProps({ accessibilityLabel: 'Add profile photo' }).props.onPress as () => Promise<void>)();
  });
  expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }));
  expect(updateAvatar).not.toHaveBeenCalled();
  await renderer.act(() => screen?.unmount());
});

test('uploads a selected image and updates the canonical profile', async () => {
  const picker = require('expo-image-picker') as { launchImageLibraryAsync: jest.Mock };
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///avatar.png', mimeType: 'image/png', fileSize: 1024 }] });
  const canonical = { uid: 'user-a', email: 'a@example.test', displayName: 'A', isPremium: false, createdAtUtcMs: 0,
    avatarUri: 'https://res.cloudinary.com/demo/avatar.png', avatarPublicId: 'avatars/user-a/a' };
  const updateAvatar = jest.fn().mockResolvedValue({ profile: canonical, cleanupPending: false });
  const onProfileUpdated = jest.fn();
  let screen: Rendered | undefined;
  await renderer.act(async () => {
    screen = renderer.create(<ProfileScreen
      profile={{ uid: 'user-a', email: 'a@example.test', displayName: 'A', isPremium: false, createdAtUtcMs: 0 }}
      repository={{ listen: jest.fn(() => jest.fn()), updateAvatar } as never}
      onProfileUpdated={onProfileUpdated} onSignOut={jest.fn()} onBack={jest.fn()}
    />);
    await Promise.resolve();
  });
  await renderer.act(async () => {
    await (screen!.root.findByProps({ accessibilityLabel: 'Add profile photo' }).props.onPress as () => Promise<void>)();
  });
  expect(updateAvatar).toHaveBeenCalledWith('user-a', 'file:///avatar.png', 'image/png');
  expect(onProfileUpdated).toHaveBeenCalledWith(canonical);
  await renderer.act(() => screen?.unmount());
});

test('confirms photo removal and publishes the canonical profile', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const removed = { uid: 'user-a', email: 'a@example.test', displayName: 'A B', isPremium: false, createdAtUtcMs: 0 };
  const removeAvatar = jest.fn().mockResolvedValue({ profile: removed, cleanupPending: false });
  const onProfileUpdated = jest.fn();
  let screen: Rendered | undefined;
  await renderer.act(async () => {
    screen = renderer.create(<ProfileScreen
      profile={{ ...removed, avatarUri: 'https://res.cloudinary.com/demo/avatar.jpg', avatarPublicId: 'avatars/user-a/a' }}
      repository={{ listen: jest.fn(() => jest.fn()), removeAvatar } as never}
      onProfileUpdated={onProfileUpdated} onSignOut={jest.fn()} onBack={jest.fn()}
    />);
    await Promise.resolve();
  });
  await renderer.act(() => {
    (screen!.root.findByProps({ accessibilityLabel: 'Remove profile photo' }).props.onPress as () => void)();
  });
  const buttons = alert.mock.calls[0][2] as Array<{ text?: string; onPress?: () => void }>;
  await renderer.act(async () => buttons.find(button => button.text === 'Remove photo')?.onPress?.());
  expect(removeAvatar).toHaveBeenCalledWith('user-a');
  expect(onProfileUpdated).toHaveBeenCalledWith(removed);
  expect(alert).toHaveBeenCalledWith('Remove profile photo?', expect.any(String), expect.any(Array));
  alert.mockRestore();
  await renderer.act(() => screen?.unmount());
});

test('uses name initials without a photo and keeps the canonical avatar when replacement fails', async () => {
  const updateAvatar = jest.fn().mockRejectedValue(new Error('Upload failed. Retry.'));
  const onProfileUpdated = jest.fn();
  const uri = 'https://res.cloudinary.com/demo/current.jpg';
  let screen: Rendered | undefined;
  await renderer.act(async () => {
    screen = renderer.create(<ProfileScreen
      profile={{ uid: 'user-a', email: 'a@example.test', displayName: 'Alice Beta', isPremium: false, createdAtUtcMs: 0 }}
      repository={{ listen: jest.fn(() => jest.fn()), updateAvatar } as never}
      onProfileUpdated={onProfileUpdated} onSignOut={jest.fn()} onBack={jest.fn()}
    />);
    await Promise.resolve();
  });
  expect(screen!.root.findAllByProps({ children: 'AB' }).length).toBeGreaterThan(0);
  await renderer.act(async () => {
    screen!.update(<ProfileScreen
      profile={{ uid: 'user-a', email: 'a@example.test', displayName: 'Alice Beta', isPremium: false, createdAtUtcMs: 0, avatarUri: uri }}
      repository={{ listen: jest.fn(() => jest.fn()), updateAvatar } as never}
      onProfileUpdated={onProfileUpdated} onSignOut={jest.fn()} onBack={jest.fn()}
    />);
  });
  await renderer.act(async () => {
    (screen!.root.findByProps({ accessibilityLabel: 'Change profile photo' }).props.onPress as () => void)();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  expect(onProfileUpdated).not.toHaveBeenCalled();
  expect(screen!.root.findAllByProps({ children: 'Upload failed. Retry.' }).length).toBeGreaterThan(0);
  await renderer.act(() => screen?.unmount());
});
