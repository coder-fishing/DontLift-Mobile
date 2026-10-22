import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import { GlassCard } from '../components/GlassCard';
import type { FeedbackSettings, SettingsRepository } from '../features/settings/settings-repository';
import { DEFAULT_FEEDBACK_SETTINGS } from '../features/settings/settings-repository';

type Props = {
  userId: string;
  repository: SettingsRepository;
  onBack: () => void;
};

export function SettingsScreen({ userId, repository, onBack }: Props) {
  const colors = Colors.light;
  const [settings, setSettings] = useState<FeedbackSettings>(DEFAULT_FEEDBACK_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [errorKind, setErrorKind] = useState<'load' | 'save'>();
  const [saved, setSaved] = useState(false);

  const loadPreferences = useCallback(() => repository.getFeedbackSettings(userId), [repository, userId]);

  useEffect(() => {
    let active = true;
    void loadPreferences().then(value => {
      if (active) setSettings(value);
    }).catch(() => {
      if (active) {
        setError('Settings could not be loaded from this device. Try again.');
        setErrorKind('load');
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadPreferences]);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => back.remove();
  }, [onBack]);

  const updateSetting = async (name: keyof FeedbackSettings, value: boolean) => {
    if (saving) return;
    const previous = settings;
    const next = { ...settings, [name]: value };
    setSettings(next);
    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      await repository.saveFeedbackSettings(userId, next);
      setSaved(true);
    } catch {
      setSettings(previous);
      setError('Could not save on this device. Your previous setting is still active.');
      setErrorKind('save');
    } finally {
      setSaving(false);
    }
  };

  const settingRow = (name: keyof FeedbackSettings, title: string, description: string, testID: string) => (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>{description}</Text>
      </View>
      <Switch
        testID={testID}
        accessibilityRole="switch"
        accessibilityLabel={title}
        accessibilityHint={`Turn ${title.toLowerCase()} ${settings[name] ? 'off' : 'on'}`}
        accessibilityState={{ checked: settings[name], disabled: loading || saving }}
        value={settings[name]}
        disabled={loading || saving}
        onValueChange={value => { void updateSetting(name, value); }}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.onPrimary}
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={8} style={styles.back}>
        <Text style={[styles.backText, { color: colors.primary }]}>‹  Back</Text>
      </Pressable>

      <View style={styles.intro}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Feedback</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Choose how DontLift responds when a lift is confirmed.</Text>
      </View>

      <GlassCard className="" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>During a session</Text>
        {loading ? (
          <View accessibilityRole="progressbar" style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>Loading settings…</Text>
          </View>
        ) : errorKind === 'load' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Retry loading settings" onPress={() => {
            setLoading(true);
            setError(undefined);
            setErrorKind(undefined);
            void loadPreferences().then(value => setSettings(value)).catch(() => {
              setError('Settings could not be loaded from this device. Try again.');
              setErrorKind('load');
            }).finally(() => setLoading(false));
          }} style={styles.retry}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        ) : (
          <>
            {settingRow('hapticsEnabled', 'Vibration', 'A brief vibration after a confirmed lift.', 'settings-haptics')}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            {settingRow('soundEnabled', 'Sound', 'A short beep after a confirmed lift. Off by default.', 'settings-sound')}
          </>
        )}
        {saving ? <Text accessibilityRole="text" style={[styles.statusText, { color: colors.textSecondary }]}>Saving on this device…</Text> : null}
        {saved && !saving ? <Text accessibilityRole="text" style={[styles.statusText, { color: colors.primary }]}>Saved on this device.</Text> : null}
        {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
      </GlassCard>

      <Text style={[styles.privacy, { color: colors.textSecondary }]}>These preferences are stored on this device for this account. They do not affect session time or scoring.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.three },
  back: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 4 },
  backText: { fontSize: 15, fontWeight: '700' },
  intro: { gap: 6 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  card: { gap: 16, borderRadius: 24, padding: 20 },
  sectionTitle: { fontSize: 19, fontWeight: '700' },
  settingRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingCopy: { flex: 1, gap: 4 },
  settingTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  settingDescription: { fontSize: 13, lineHeight: 19 },
  divider: { height: StyleSheet.hairlineWidth },
  loading: { minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: 10 },
  statusText: { fontSize: 13, lineHeight: 19 },
  error: { fontSize: 14, lineHeight: 20 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
  retryText: { fontSize: 15, fontWeight: '700' },
  privacy: { fontSize: 13, lineHeight: 19, paddingHorizontal: 4 },
});
