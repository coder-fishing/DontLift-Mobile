import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { Colors } from '../constants/theme';
import {
  createFirebaseRegistrationController,
  getConfiguredFirebaseRuntime,
} from '../features/auth/firebase-adapters';
import type {
  RegistrationField,
  RegistrationFieldErrors,
} from '../features/auth/auth-validation';
import type { RegistrationProfile, RegistrationResult, RegistrationUser } from '../features/auth/auth-controller';
import type { AuthSessionResult } from '../features/auth/auth-session-controller';

interface LoginScreenProps {
  onAuthenticated: () => void;
  onSignIn: (email: string, password: string) => Promise<AuthSessionResult>;
  recoveryUser?: RegistrationUser;
  authenticatedProfile?: RegistrationProfile;
  onSignOut?: () => Promise<{ kind: 'signed-out' } | { kind: 'failed'; message: string }>;
  canSignOut?: boolean;
  formError?: string;
}

type RegistrationController = ReturnType<typeof createFirebaseRegistrationController>;

function FieldError({ message, color }: { message?: string; color: string }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={[styles.fieldError, { color }]}>
      {message}
    </Text>
  );
}

export function LoginScreen({ onAuthenticated, onSignIn, recoveryUser, authenticatedProfile, onSignOut, canSignOut, formError: initialFormError }: LoginScreenProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const controller = useRef<RegistrationController | null>(null);
  const onAuthenticatedRef = useRef(onAuthenticated);
  const recoveryAttemptedUid = useRef<string | null>(null);
  const didCompleteProfile = useRef(false);
  onAuthenticatedRef.current = onAuthenticated;
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [formError, setFormError] = useState(initialFormError ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecovering, setIsRecovering] = useState(Boolean(recoveryUser));
  const [focusedField, setFocusedField] = useState<RegistrationField | null>(null);

  const showResult = useCallback((result: RegistrationResult) => {
    setFieldErrors(result.kind === 'invalid' ? result.fieldErrors : {});
    if (result.kind === 'completed') {
      didCompleteProfile.current = true;
      setFormError('');
      onAuthenticatedRef.current();
      return;
    }
    if (result.kind === 'pending') {
      setIsRecovering(true);
      setAuthMode('signup');
      setFormError(result.message);
      return;
    }
    if (result.kind === 'needs-name') {
      setIsRecovering(true);
      setAuthMode('signup');
      setFormError('Enter your name to finish setting up this account.');
      return;
    }
    if (result.kind === 'failed') setFormError(result.message);
    if (result.kind === 'signed-out') setIsRecovering(false);
  }, []);

  useEffect(() => {
    try {
      const runtime = getConfiguredFirebaseRuntime(Platform.OS, __DEV__);
      const registrationController = createFirebaseRegistrationController(runtime);
      controller.current = registrationController;
    } catch {
      setFormError('Account services are unavailable. Check your connection and try again.');
      return undefined;
    }
  }, [showResult]);

  useEffect(() => {
    setFormError(initialFormError ?? '');
  }, [initialFormError]);

  useEffect(() => {
    if (!recoveryUser) {
      recoveryAttemptedUid.current = null;
      return;
    }
    if (didCompleteProfile.current || recoveryAttemptedUid.current === recoveryUser.uid) return;
    setIsRecovering(true);
    setAuthMode('signup');
    setDisplayName((current) => recoveryUser.displayName || current);
    if (isSubmitting) return;

    const activeController = controller.current;
    if (activeController) {
      recoveryAttemptedUid.current = recoveryUser.uid;
      void activeController.resumeProfileCompletion().then(showResult);
    }
  }, [isSubmitting, recoveryUser?.uid, recoveryUser?.displayName, showResult]);

  const handleSubmit = async () => {
    setFieldErrors({});
    setFormError('');
    if (authMode === 'signin') {
      const errors: RegistrationFieldErrors = {};
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
      if (!password) errors.password = 'Enter a password.';
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const activeController = controller.current ?? createFirebaseRegistrationController(
        getConfiguredFirebaseRuntime(Platform.OS, __DEV__),
      );
      controller.current = activeController;
      if (authMode === 'signin') {
        const result = await onSignIn(email, password);
        if (result.kind === 'failed') setFormError(result.message);
        if (result.kind === 'profile-recovery') setFormError('Your account is signed in, but its profile needs to be restored.');
        return;
      }

      const result = isRecovering
        ? await activeController.resumeProfileCompletion(displayName)
        : await activeController.register({
          displayName,
          email,
          password,
          passwordConfirmation,
        });
      showResult(result);
    } catch {
      setFormError('Account services are unavailable. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const setFieldError = (field: RegistrationField, message?: string) => fieldErrors[field] ? (
    <FieldError message={message ?? fieldErrors[field]} color={colors.error} />
  ) : null;
  const inputStyle = (field: RegistrationField) => [
    styles.textInput,
    {
      backgroundColor: colors.inputSurface,
      borderColor: fieldErrors[field]
        ? colors.error
        : focusedField === field ? colors.authAccent : colors.glassBorder,
      color: colors.text,
    },
  ];

  const requestSignOut = () => {
    if (!onSignOut || isSubmitting) return;

    Alert.alert('Sign out?', 'You can sign back in with the same account or use another one.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setIsSubmitting(true);
          void (async () => {
            try {
              const result = await onSignOut();
              if (result.kind === 'failed') {
                if (authenticatedProfile) Alert.alert('Sign out failed', result.message);
                else setFormError(result.message);
                setIsSubmitting(false);
                return;
              }
              recoveryAttemptedUid.current = recoveryUser?.uid ?? null;
              setIsRecovering(false);
              setAuthMode('signin');
              setDisplayName('');
              setPassword('');
              setPasswordConfirmation('');
              setFormError('');
              setIsSubmitting(false);
            } catch {
              const message = 'We could not sign you out. Please try again.';
              if (authenticatedProfile) Alert.alert('Sign out failed', message);
              else setFormError(message);
              setIsSubmitting(false);
            }
          })();
        },
      },
    ]);
  };

  if (authenticatedProfile) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={[styles.formGlass, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder, shadowColor: colors.glassShadow }]}>
          <View style={styles.formCard}>
            <Text accessibilityRole="header" style={[styles.accountTitle, { color: colors.text }]}>Your account</Text>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Name</Text>
            <Text
              testID="account-display-name"
              accessibilityLabel={`Account name: ${authenticatedProfile.displayName}`}
              style={[styles.accountValue, { color: colors.text }]}
            >
              {authenticatedProfile.displayName}
            </Text>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email</Text>
            <Text style={[styles.accountValue, { color: colors.text }]}>{authenticatedProfile.email}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={requestSignOut}
              style={({ pressed }) => [styles.signOutButton, { backgroundColor: colors.backgroundSelected }, pressed && styles.pressed]}
            >
              <Text style={[styles.signOutText, { color: colors.text }]}>Sign Out</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
      <View style={styles.heroSection}>
        <View style={[styles.iconCircle, { backgroundColor: colors.glassSurface, borderColor: colors.glassBorder, shadowColor: colors.authAccent }]}>
          <Text style={[styles.heroIcon, { color: colors.authAccent }]} accessibilityElementsHidden>DL</Text>
        </View>
        <Text style={[styles.heroEyebrow, { color: colors.authAccent }]}>FOCUS STARTS HERE</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Welcome to DontLift</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Put your phone down and make room for focused work.
        </Text>
      </View>

      {!isRecovering && (
        <View
          accessibilityRole="tablist"
          style={[styles.tabPillContainer, { backgroundColor: colors.glassSurface, borderColor: colors.glassBorder }]}
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: authMode === 'signin' }}
            onPress={() => {
              setAuthMode('signin');
              setFormError('');
            }}
            style={({ pressed }) => [styles.authTab, authMode === 'signin' && { backgroundColor: colors.backgroundSelected }, pressed && styles.pressed]}
          >
            <Text style={[styles.authTabText, { color: authMode === 'signin' ? colors.authAccent : colors.textSecondary }]}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: authMode === 'signup' }}
            onPress={() => {
              setAuthMode('signup');
              setFormError('');
            }}
            style={({ pressed }) => [styles.authTab, authMode === 'signup' && { backgroundColor: colors.backgroundSelected }, pressed && styles.pressed]}
          >
            <Text style={[styles.authTabText, { color: authMode === 'signup' ? colors.authAccent : colors.textSecondary }]}>
              Create Account
            </Text>
          </Pressable>
        </View>
      )}

      <View
        style={[styles.formGlass, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder, shadowColor: colors.glassShadow }]}
      >
        <View style={styles.formCard}>
        {isRecovering && (
          <Text style={[styles.recoveryTitle, { color: colors.text }]}>Finish account setup</Text>
        )}

        {authMode === 'signup' && (
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Name</Text>
            <TextInput
              accessibilityLabel="Name"
              accessibilityHint="Enter a name from 1 to 40 characters"
              autoComplete="name"
              autoCapitalize="words"
              editable={!isSubmitting}
              onBlur={() => setFocusedField(null)}
              onFocus={() => setFocusedField('displayName')}
              onChangeText={(value) => {
                setDisplayName(value);
                setFieldErrors({ ...fieldErrors, displayName: undefined });
              }}
              placeholder="Your name"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="next"
              style={inputStyle('displayName')}
              value={displayName}
            />
            <FieldError message={fieldErrors.displayName} color={colors.error} />
          </View>
        )}

        {!isRecovering && (
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Email Address</Text>
            <TextInput
              accessibilityLabel="Email address"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              keyboardType="email-address"
              onBlur={() => setFocusedField(null)}
              onFocus={() => setFocusedField('email')}
              onChangeText={(value) => {
                setEmail(value);
                setFieldErrors({ ...fieldErrors, email: undefined });
              }}
              placeholder="name@example.com"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="next"
              style={inputStyle('email')}
              textContentType="emailAddress"
              value={email}
            />
            {setFieldError('email')}
          </View>
        )}

        {!isRecovering && (
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Password</Text>
            <TextInput
              accessibilityLabel="Password"
              autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
              autoCapitalize="none"
              editable={!isSubmitting}
              onBlur={() => setFocusedField(null)}
              onFocus={() => setFocusedField('password')}
              onChangeText={(value) => {
                setPassword(value);
                setFieldErrors({ ...fieldErrors, password: undefined });
              }}
              placeholder="Enter your password"
              placeholderTextColor={colors.textSecondary}
              returnKeyType={authMode === 'signup' ? 'next' : 'done'}
              secureTextEntry
              style={inputStyle('password')}
              textContentType={authMode === 'signup' ? 'newPassword' : 'password'}
              value={password}
            />
            {setFieldError('password')}
          </View>
        )}

        {authMode === 'signup' && !isRecovering && (
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Confirm Password</Text>
            <TextInput
              accessibilityLabel="Confirm password"
              autoComplete="new-password"
              autoCapitalize="none"
              editable={!isSubmitting}
              onBlur={() => setFocusedField(null)}
              onFocus={() => setFocusedField('passwordConfirmation')}
              onChangeText={(value) => {
                setPasswordConfirmation(value);
                setFieldErrors({ ...fieldErrors, passwordConfirmation: undefined });
              }}
              placeholder="Re-enter your password"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
              secureTextEntry
              style={inputStyle('passwordConfirmation')}
              textContentType="newPassword"
              value={passwordConfirmation}
            />
            {setFieldError('passwordConfirmation')}
          </View>
        )}

        {!!formError && (
          <Text accessibilityRole="alert" style={[styles.formError, { color: colors.error }]}>
            {formError}
          </Text>
        )}

        <View
          style={[
            styles.submitButtonFrame,
            { backgroundColor: colors.primary, shadowColor: colors.primary },
            isSubmitting && styles.submitButtonDisabled,
          ]}
        >
          <Pressable
            accessibilityLabel={isRecovering ? 'Retry profile setup' : authMode === 'signin' ? 'Sign in' : 'Create account and begin'}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
          >
            {isSubmitting ? <ActivityIndicator color={colors.onPrimary} /> : null}
            <Text style={[styles.submitButtonText, { color: colors.onPrimary }]}>
              {isSubmitting ? 'Please wait…' : isRecovering ? 'Retry setup' : authMode === 'signin' ? 'Sign In' : 'Create Account & Begin'}
            </Text>
          </Pressable>
        </View>

        {canSignOut && onSignOut && (
          <Pressable
            accessibilityLabel="Sign out and use another account"
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
            disabled={isSubmitting}
            onPress={requestSignOut}
            style={({ pressed }) => [styles.signOutButton, { backgroundColor: colors.backgroundSelected }, pressed && styles.pressed]}
          >
            <Text style={[styles.signOutText, { color: colors.text }]}>Sign out and use another account</Text>
          </Pressable>
        )}
        </View>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, paddingVertical: 12 },
  content: { gap: 16 },
  heroSection: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  heroIcon: { fontSize: 18, fontWeight: '900', letterSpacing: -0.8 },
  heroEyebrow: { fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  heroTitle: { fontSize: 24, lineHeight: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 6, paddingHorizontal: 12, maxWidth: 320 },
  tabPillContainer: { flexDirection: 'row', borderRadius: 999, padding: 4, borderWidth: 1, gap: 4 },
  authTab: { flex: 1, minHeight: 48, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  authTabText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.78 },
  formGlass: { borderWidth: 1, borderRadius: 28, overflow: 'hidden', padding: 1, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.14, shadowRadius: 30, elevation: 8 },
  formCard: { padding: 19, gap: 15 },
  recoveryTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  accountTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  accountValue: { fontSize: 16, lineHeight: 22, fontWeight: '600', marginTop: -8 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 14, fontWeight: '700' },
  textInput: { minHeight: 52, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, fontSize: 16 },
  submitButtonFrame: { minHeight: 54, borderRadius: 18, marginTop: 3, overflow: 'hidden', justifyContent: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
  submitButton: { flex: 1, minHeight: 54, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  submitButtonDisabled: { opacity: 0.52, elevation: 0, shadowOpacity: 0 },
  submitButtonText: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  signOutButton: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  signOutText: { fontSize: 15, fontWeight: '800' },
  fieldError: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  formError: { fontSize: 14, lineHeight: 20 },
  signInNote: { fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 6 },
});
