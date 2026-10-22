import React from 'react';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { DEFAULT_FEEDBACK_SETTINGS } from '../src/features/settings/settings-repository';

jest.mock('../src/constants/theme', () => ({ Colors: { light: {
  text: 'black', textSecondary: 'gray', primary: 'blue', onPrimary: 'white', border: 'gray', error: 'red',
  authFormSurface: 'white', glassBorder: 'white', glassShadow: 'gray',
} }, Spacing: { three: 16, four: 24 } }));
jest.mock('../src/components/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => children }));

type Node = { props: Record<string, unknown>; findByProps(props: Record<string, unknown>): Node };
type Rendered = { root: Node; unmount(): void };
const renderer = require('react-test-renderer') as {
  create(element: React.ReactElement): Rendered;
  act(task: () => void | Promise<void>): Promise<void>;
};

test('loads defaults and persists each switch under the signed-in account', async () => {
  const repository = {
    getFeedbackSettings: jest.fn(async () => DEFAULT_FEEDBACK_SETTINGS),
    saveFeedbackSettings: jest.fn(async () => undefined),
  };
  const onBack = jest.fn();
  let screen: Rendered | undefined;
  try {
    await renderer.act(async () => {
      screen = renderer.create(<SettingsScreen userId="user-a" repository={repository} onBack={onBack} />);
      await Promise.resolve();
    });

    expect(screen!.root.findByProps({ testID: 'settings-haptics' }).props.value).toBe(true);
    expect(screen!.root.findByProps({ testID: 'settings-sound' }).props.value).toBe(false);
    await renderer.act(async () => {
      (screen!.root.findByProps({ testID: 'settings-sound' }).props.onValueChange as (value: boolean) => void)(true);
      await Promise.resolve();
    });

    expect(repository.saveFeedbackSettings).toHaveBeenCalledWith('user-a', { hapticsEnabled: true, soundEnabled: true });
    expect(screen!.root.findByProps({ accessibilityLabel: 'Back' })).toBeDefined();
  } finally {
    await renderer.act(() => screen?.unmount());
  }
});

test('reverts a switch when SQLite does not confirm the save', async () => {
  const repository = {
    getFeedbackSettings: jest.fn(async () => DEFAULT_FEEDBACK_SETTINGS),
    saveFeedbackSettings: jest.fn(async () => { throw new Error('database locked'); }),
  };
  let screen: Rendered | undefined;
  try {
    await renderer.act(async () => {
      screen = renderer.create(<SettingsScreen userId="user-a" repository={repository} onBack={jest.fn()} />);
      await Promise.resolve();
    });
    await renderer.act(async () => {
      (screen!.root.findByProps({ testID: 'settings-haptics' }).props.onValueChange as (value: boolean) => void)(false);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen!.root.findByProps({ testID: 'settings-haptics' }).props.value).toBe(true);
    expect(screen!.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
  } finally {
    await renderer.act(() => screen?.unmount());
  }
});
