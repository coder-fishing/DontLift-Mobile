import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { createFirebaseAuthSessionController, getConfiguredFirebaseRuntime } from './firebase-adapters';
import type { AuthSessionResult, AuthSessionState } from './auth-session-controller';
import type { RegistrationUser } from './auth-controller';

interface AuthSessionContextValue {
  state: AuthSessionState;
  signIn(email: string, password: string): Promise<AuthSessionResult>;
  refreshProfile(): Promise<AuthSessionResult>;
  signOut(): Promise<{ kind: 'signed-out' } | { kind: 'failed'; message: string }>;
}

const unavailableMessage = 'Account services are unavailable. Check your connection and try again.';
const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function toRegistrationUser(user: { uid: string; email: string | null; displayName: string | null } | null): RegistrationUser | null {
  return user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null;
}

export function AuthSessionProvider({ children }: React.PropsWithChildren) {
  const [state, setState] = useState<AuthSessionState>({ kind: 'loading' });
  const [controller, setController] = useState<ReturnType<typeof createFirebaseAuthSessionController> | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setState({ kind: 'unavailable', message: unavailableMessage });
      return;
    }

    try {
      const runtime = getConfiguredFirebaseRuntime(Platform.OS, __DEV__);
      const activeController = createFirebaseAuthSessionController(runtime);
      setController(activeController);
      const authSdk = require('@react-native-firebase/auth') as typeof import('@react-native-firebase/auth');
      const unsubscribeState = activeController.subscribe(setState);
      const unsubscribeAuth = authSdk.onAuthStateChanged(runtime.auth, (user) => {
        void activeController.restoreSession(toRegistrationUser(user));
      });

      return () => {
        unsubscribeAuth();
        unsubscribeState();
        activeController.dispose();
      };
    } catch {
      setState({ kind: 'unavailable', message: unavailableMessage });
      return undefined;
    }
  }, []);

  const value = useMemo<AuthSessionContextValue>(() => ({
    state,
    signIn: (email, password) => controller
      ? controller.signIn(email, password)
      : Promise.resolve({ kind: 'failed', message: unavailableMessage }),
    refreshProfile: () => controller
      ? controller.refreshProfile()
      : Promise.resolve({ kind: 'failed', message: unavailableMessage }),
    signOut: () => controller
      ? controller.signOut()
      : Promise.resolve({ kind: 'failed', message: unavailableMessage }),
  }), [controller, state]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const value = useContext(AuthSessionContext);
  if (!value) throw new Error('useAuthSession must be used inside AuthSessionProvider.');
  return value;
}
