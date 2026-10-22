import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Network from 'expo-network';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../constants/theme';
import { GlassCard } from '../components/GlassCard';
import type { RegistrationProfile } from '../features/auth/auth-controller';
import type { ProfileRepository } from '../features/profile/profile-repository';
import { ProfileEditError, validateProfileDisplayName } from '../features/profile/profile-repository';
import { canSubmitProfileSave } from '../features/profile/profile-save-state';

type Props = {
  profile: RegistrationProfile;
  repository: ProfileRepository;
  onProfileUpdated: (profile: RegistrationProfile) => void;
  onSignOut: () => Promise<{ kind: 'signed-out' } | { kind: 'failed'; message: string }>;
  onBack: () => void;
};

function saveError(error: unknown): string {
  if (!(error instanceof ProfileEditError)) return 'Could not save your name. Check your connection and try again.';
  if (error.code === 'invalid-argument') return 'Enter a name from 1 to 40 characters.';
  if (error.code === 'permission-denied') return 'Firebase denied this profile update. Check that the current Firestore Rules are deployed.';
  if (error.code === 'unauthenticated') return 'Your sign-in changed. Sign in again before saving.';
  if (error.code === 'local-cache-failed') return 'Your name was saved online, but this device could not refresh its local copy. Retry to refresh it.';
  return 'Could not confirm the save. Reconnect and try again.';
}

export function ProfileScreen({ profile, repository, onProfileUpdated, onSignOut, onBack }: Props) {
  const colors = Colors.light;
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(profile.displayName);
  const [savedName, setSavedName] = useState(profile.displayName);
  const [nameError, setNameError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [needsLocalRepair, setNeedsLocalRepair] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [listeningError, setListeningError] = useState(false);
  const mounted = useRef(true);
  const savedNameRef = useRef(savedName);
  const onProfileUpdatedRef = useRef(onProfileUpdated);
  const dirty = name.trim() !== savedName;
  const canSave = canSubmitProfileSave({ dirty, needsLocalRepair, saving, online });
  savedNameRef.current = savedName;
  onProfileUpdatedRef.current = onProfileUpdated;

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const updateNetwork = (state: Awaited<ReturnType<typeof Network.getNetworkStateAsync>>) => {
      if (active) setOnline(state.isConnected === true && state.isInternetReachable !== false);
    };
    void Network.getNetworkStateAsync().then(updateNetwork).catch(() => { if (active) setOnline(false); });
    const network = Network.addNetworkStateListener(updateNetwork);
    return () => { active = false; mounted.current = false; network.remove(); };
  }, []);

  useEffect(() => repository.listen(profile.uid, (canonical, fromCache) => {
    if (!mounted.current) return;
    const previouslySavedName = savedNameRef.current;
    savedNameRef.current = canonical.displayName;
    setSavedName(canonical.displayName);
    // Snapshot từ thiết bị khác cập nhật tên khi form chưa bị sửa, nhưng không ghi đè bản nháp.
    setName(current => current.trim() === previouslySavedName ? canonical.displayName : current);
    setListeningError(false);
    if (!fromCache) onProfileUpdatedRef.current(canonical);
  }, () => { if (mounted.current) setListeningError(true); }), [repository, profile.uid]);

  const save = useCallback(async () => {
    const validation = validateProfileDisplayName(name);
    if (!validation.value) {
      setNameError(validation.error === 'required' ? 'Enter your name.' : 'Use 40 characters or fewer.');
      setMessage(undefined);
      return;
    }
    if (!online) {
      setNameError(undefined);
      setMessage('You are offline. Your name is not saved yet; reconnect and try again.');
      return;
    }
    setSaving(true); setNameError(undefined); setMessage(undefined);
    try {
      const canonical = await repository.updateDisplayName(profile.uid, validation.value);
      if (!mounted.current) return;
      savedNameRef.current = canonical.displayName;
      setName(canonical.displayName); setSavedName(canonical.displayName);
      setNeedsLocalRepair(false);
      onProfileUpdated(canonical);
      setMessage('Profile saved.');
    } catch (error) {
      if (mounted.current) {
        if (error instanceof ProfileEditError && error.code === 'local-cache-failed') setNeedsLocalRepair(true);
        setMessage(saveError(error));
      }
    } finally { if (mounted.current) setSaving(false); }
  }, [name, online, profile.uid, repository, onProfileUpdated]);

  const confirmSignOut = () => Alert.alert('Sign out?', 'You can sign in again with this account or use another one.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => {
      void (async () => {
        try {
          const result = await onSignOut();
          if (result.kind === 'failed') Alert.alert('Sign out failed', result.message);
        } catch {
          Alert.alert('Sign out failed', 'We could not sign you out. Please try again.');
        }
      })();
    } },
  ]);

  return <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.authBackdrop, paddingBottom: Math.max(insets.bottom, 8) }]}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Pressable accessibilityRole="button" accessibilityLabel="Return to the main screen" onPress={onBack} hitSlop={8} style={styles.back}>
        <Text style={[styles.backText, { color: colors.primary }]}>‹  Back to DontLift</Text>
      </Pressable>

      <View style={styles.intro}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Your profile</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Manage the name people see in your rooms.</Text>
      </View>

      <GlassCard className="" style={styles.card}>
        <View style={styles.identityRow}>
          <View style={[styles.avatar, { backgroundColor: colors.backgroundSelected }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{profile.displayName.trim().slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={[styles.identityName, { color: colors.text }]} numberOfLines={1}>{profile.displayName}</Text>
            <Text style={[styles.identityCaption, { color: colors.textSecondary }]}>DontLift account</Text>
          </View>
          <View style={[styles.planPill, { backgroundColor: colors.backgroundSelected }]}>
            <Text style={[styles.planText, { color: colors.primary }]}>{profile.isPremium ? 'PRO' : 'FREE'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Display name</Text>
        <Text style={[styles.helper, { color: colors.textSecondary }]}>This name appears to people in your group rooms.</Text>
        <Text accessibilityRole="text" style={[styles.label, { color: colors.text }]}>Name</Text>
        <TextInput testID="profile-display-name" accessibilityLabel="Display name" value={name} onChangeText={value => {
          setName(value); setNameError(undefined); setMessage(undefined);
        }} editable={!saving} maxLength={80} autoCapitalize="words" autoCorrect={false} returnKeyType="done"
          onSubmitEditing={() => { void save(); }} style={[styles.input, { backgroundColor: colors.inputSurface, borderColor: nameError ? colors.error : colors.border, color: colors.text }]}
          accessibilityState={{ disabled: saving }} />
        <View style={styles.inputFooter}>
          {nameError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{nameError}</Text> : <View />}
          <Text style={[styles.counter, { color: colors.textSecondary }]}>{Array.from(name.trim()).length}/40</Text>
        </View>

        <Text accessibilityRole="text" style={[styles.label, styles.emailLabel, { color: colors.text }]}>Email</Text>
        <View accessibilityLabel={`Email, read only: ${profile.email}`} style={[styles.readOnly, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <Text selectable style={[styles.readOnlyText, { color: colors.textSecondary }]}>{profile.email}</Text>
          <Text style={[styles.readOnlyTag, { color: colors.textSecondary }]}>Read only</Text>
        </View>
        <Text style={[styles.privacy, { color: colors.textSecondary }]}>Email and account plan are managed by your account and cannot be changed here.</Text>

        {message ? <Text accessibilityRole={message === 'Profile saved.' ? 'text' : 'alert'} style={[styles.message,
          { color: message === 'Profile saved.' ? colors.primary : colors.error }]}>{message}</Text> : null}
        {listeningError ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.error }]}>Live profile updates are unavailable. Check your connection and retry.</Text> : null}
        {!online && !message ? <Text style={[styles.message, { color: colors.textSecondary }]}>Offline. Changes stay on this screen until you save online.</Text> : null}

        <Pressable testID="profile-save" accessibilityRole="button"
          accessibilityLabel={needsLocalRepair && !dirty ? 'Retry local profile update' : 'Save profile name'}
          accessibilityState={{ disabled: !canSave }} disabled={!canSave} onPress={() => { void save(); }}
          style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary,
            opacity: !canSave ? 0.48 : pressed ? 0.82 : 1 }]}>
          {saving ? <ActivityIndicator color={colors.onPrimary} /> : null}
          <Text style={[styles.saveText, { color: colors.onPrimary }]}>{saving ? 'Saving…' : needsLocalRepair && !dirty ? 'Retry local update' : 'Save changes'}</Text>
        </Pressable>
      </GlassCard>

      <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={confirmSignOut} style={styles.signOut}>
        <Text style={[styles.signOutText, { color: colors.error }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, content: { padding: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.three },
  back: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 4 },
  backText: { fontSize: 15, fontWeight: '700' }, intro: { gap: 6, marginBottom: 2 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { fontSize: 15, lineHeight: 22 }, card: { gap: 14, borderRadius: 24, padding: 20 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800' }, identityCopy: { flex: 1, gap: 3 }, identityName: { fontSize: 17, fontWeight: '700' },
  identityCaption: { fontSize: 13 }, planPill: { minHeight: 30, borderRadius: 15, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  planText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.7 }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.light.border, marginVertical: 3 },
  sectionTitle: { fontSize: 19, fontWeight: '700' }, helper: { fontSize: 14, lineHeight: 20, marginTop: -8 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: -7 }, input: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontSize: 16 },
  inputFooter: { minHeight: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: -9 },
  error: { fontSize: 13, lineHeight: 18 }, counter: { fontSize: 12, lineHeight: 18, fontVariant: ['tabular-nums'] },
  emailLabel: { marginTop: 2 }, readOnly: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, flexDirection: 'row', gap: 8, alignItems: 'center' },
  readOnlyText: { flex: 1, fontSize: 15 }, readOnlyTag: { fontSize: 11, fontWeight: '700' },
  privacy: { fontSize: 13, lineHeight: 19, marginTop: -6 }, message: { fontSize: 14, lineHeight: 20 },
  saveButton: { minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 20, marginTop: 2 },
  saveText: { fontSize: 15, fontWeight: '700' }, signOut: { minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 16 },
  signOutText: { fontSize: 14, fontWeight: '700' },
});
