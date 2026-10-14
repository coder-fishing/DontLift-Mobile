import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { Colors } from '../constants/theme';
import {
  createFirebaseRegistrationController,
  getConfiguredFirebaseRuntime,
} from '../features/auth/firebase-adapters';
import type {
  RegistrationField,
  RegistrationFieldErrors,
} from '../features/auth/auth-validation';
import type { RegistrationResult } from '../features/auth/auth-controller';

interface LoginScreenProps {
  onAuthenticated: () => void;
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

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const controller = useRef<RegistrationController | null>(null);
  const onAuthenticatedRef = useRef(onAuthenticated);
  onAuthenticatedRef.current = onAuthenticated;
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const showResult = useCallback((result: RegistrationResult) => {
    setFieldErrors(result.kind === 'invalid' ? result.fieldErrors : {});
    if (result.kind === 'completed') {
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
    let active = true;

    try {
      const runtime = getConfiguredFirebaseRuntime(Platform.OS, __DEV__);
      const registrationController = createFirebaseRegistrationController(runtime);
      controller.current = registrationController;
      const unsubscribe = registrationController.onAuthStateChanged((user) => {
        if (!active || !user) return;
        setIsRecovering(true);
        setAuthMode('signup');
        setDisplayName((current) => user.displayName || current);
        void registrationController.resumeProfileCompletion().then((result) => {
          if (active) showResult(result);
        });
      });

      return () => {
        active = false;
        unsubscribe();
      };
    } catch {
      setFormError('Account services are unavailable. Check your connection and try again.');
      return () => {
        active = false;
      };
    }
  }, [showResult]);

  const handleSubmit = async () => {
    setFieldErrors({});
    setFormError('');
    if (authMode === 'signin') {
      setFormError('Sign-in is not available yet. Choose Create Account to register.');
      return;
    }

    setIsSubmitting(true);
    try {
      const activeController = controller.current ?? createFirebaseRegistrationController(
        getConfiguredFirebaseRuntime(Platform.OS, __DEV__),
      );
      controller.current = activeController;
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

  return (
    <View style={styles.container}>
      <View style={styles.heroSection}>
        <View style={[styles.iconCircle, { backgroundColor: colors.backgroundSelected }]}>
          <Text style={[styles.heroIcon, { color: colors.primary }]} accessibilityElementsHidden>
            ◈
          </Text>
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Welcome to DontLift</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Put your phone down and make room for focused work.
        </Text>
      </View>

      {!isRecovering && (
        <View
          accessibilityRole="tablist"
          style={[styles.tabPillContainer, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: authMode === 'signin' }}
            onPress={() => {
              setAuthMode('signin');
              setFormError('');
            }}
            style={[styles.authTab, authMode === 'signin' && { backgroundColor: colors.background }]}
          >
            <Text style={[styles.authTabText, { color: authMode === 'signin' ? colors.primary : colors.textSecondary }]}>
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
            style={[styles.authTab, authMode === 'signup' && { backgroundColor: colors.background }]}
          >
            <Text style={[styles.authTabText, { color: authMode === 'signup' ? colors.primary : colors.textSecondary }]}>
              Create Account
            </Text>
          </Pressable>
        </View>
      )}

      <GlassCard style={styles.formCard}>
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
              onChangeText={(value) => {
                setDisplayName(value);
                setFieldErrors({ ...fieldErrors, displayName: undefined });
              }}
              placeholder="Your name"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="next"
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: fieldErrors.displayName ? colors.error : colors.border, color: colors.text }]}
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
              onChangeText={(value) => {
                setEmail(value);
                setFieldErrors({ ...fieldErrors, email: undefined });
              }}
              placeholder="name@example.com"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="next"
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: fieldErrors.email ? colors.error : colors.border, color: colors.text }]}
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
              onChangeText={(value) => {
                setPassword(value);
                setFieldErrors({ ...fieldErrors, password: undefined });
              }}
              placeholder="Enter your password"
              placeholderTextColor={colors.textSecondary}
              returnKeyType={authMode === 'signup' ? 'next' : 'done'}
              secureTextEntry
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: fieldErrors.password ? colors.error : colors.border, color: colors.text }]}
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
              onChangeText={(value) => {
                setPasswordConfirmation(value);
                setFieldErrors({ ...fieldErrors, passwordConfirmation: undefined });
              }}
              placeholder="Re-enter your password"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
              secureTextEntry
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: fieldErrors.passwordConfirmation ? colors.error : colors.border, color: colors.text }]}
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

        <PrimaryButton
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting || authMode === 'signin', busy: isSubmitting }}
          disabled={isSubmitting || authMode === 'signin'}
          onPress={handleSubmit}
          style={{ marginTop: 8, backgroundColor: colors.primary }}
          icon={isSubmitting ? <ActivityIndicator color={colors.onPrimary} /> : undefined}
          title={isSubmitting ? 'Please wait…' : isRecovering ? 'Retry setup' : 'Create Account & Begin'}
        />
        {authMode === 'signin' && (
          <Text style={[styles.signInNote, { color: colors.textSecondary }]}>
            Returning account access is not available yet.
          </Text>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  heroSection: { alignItems: 'center', paddingVertical: 10 },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroIcon: { fontSize: 28, fontWeight: '700' },
  heroTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  heroSubtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
  tabPillContainer: { flexDirection: 'row', borderRadius: 999, padding: 4, borderWidth: 1 },
  authTab: { flex: 1, minHeight: 48, paddingVertical: 10, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  authTabText: { fontSize: 14, fontWeight: '700' },
  formCard: { padding: 20, gap: 14 },
  recoveryTitle: { fontSize: 18, fontWeight: '700' },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 14, fontWeight: '700' },
  textInput: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  fieldError: { fontSize: 13, lineHeight: 18 },
  formError: { fontSize: 14, lineHeight: 20 },
  signInNote: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
