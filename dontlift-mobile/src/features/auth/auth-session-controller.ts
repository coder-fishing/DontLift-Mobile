import type { RegistrationProfile, RegistrationUser } from './auth-controller';

export type AuthSessionState =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'authenticated'; profile: RegistrationProfile; source: 'server' | 'cache' }
  | { kind: 'profile-recovery'; reason: 'missing-profile' | 'profile-unavailable'; user: RegistrationUser };

export type AuthSessionResult =
  | { kind: 'authenticated'; profile: RegistrationProfile; source: 'server' | 'cache' }
  | { kind: 'profile-recovery'; reason: 'missing-profile' | 'profile-unavailable'; user: RegistrationUser }
  | { kind: 'failed'; message: string };

export interface AuthSessionAuthPort {
  getCurrentUser(): RegistrationUser | null;
  signIn(email: string, password: string): Promise<RegistrationUser>;
  signOut(): Promise<void>;
}

export interface AuthSessionProfilePort {
  get(uid: string): Promise<RegistrationProfile | null>;
  upsert(profile: RegistrationProfile): Promise<void>;
}

export interface AuthSessionRemoteProfilePort {
  get(uid: string): Promise<RegistrationProfile | null>;
}

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
const CONNECTION_ERROR_MESSAGE = 'Internet connection required to log in.';
const PROFILE_UNAVAILABLE_MESSAGE = 'We could not load your profile. Check your connection and try again.';
const SIGN_OUT_FAILED_MESSAGE = 'We could not sign you out. Please try again.';

function normalizedErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error) || typeof error.code !== 'string') {
    return undefined;
  }
  return error.code.replace(/^auth\//, '');
}

function isProfileForUser(profile: RegistrationProfile | null, uid: string): profile is RegistrationProfile {
  return Boolean(
    profile
      && profile.uid === uid
      && profile.email.trim()
      && profile.displayName.trim()
      && Number.isFinite(profile.createdAtUtcMs),
  );
}

export function createAuthSessionController(
  auth: AuthSessionAuthPort,
  profiles: AuthSessionProfilePort,
  remoteProfiles: AuthSessionRemoteProfilePort,
) {
  let state: AuthSessionState = { kind: 'loading' };
  let operation = 0;
  const listeners = new Set<(next: AuthSessionState) => void>();

  function publish(next: AuthSessionState) {
    state = next;
    for (const listener of listeners) listener(next);
  }

  function isCurrent(expectedOperation: number, user: RegistrationUser): boolean {
    return operation === expectedOperation && auth.getCurrentUser()?.uid === user.uid;
  }

  async function loadServerProfile(user: RegistrationUser, expectedOperation: number): Promise<AuthSessionResult> {
    let profile: RegistrationProfile | null;
    try {
      profile = await remoteProfiles.get(user.uid);
    } catch {
      if (!isCurrent(expectedOperation, user)) return { kind: 'failed', message: PROFILE_UNAVAILABLE_MESSAGE };
      try {
        const cached = await profiles.get(user.uid);
        if (isCurrent(expectedOperation, user) && isProfileForUser(cached, user.uid)) {
          const result: AuthSessionResult = { kind: 'authenticated', profile: cached, source: 'cache' };
          publish(result);
          return result;
        }
      } catch {
        // Fall through to profile recovery when neither server nor local profile is available.
      }
      const result: AuthSessionResult = { kind: 'profile-recovery', reason: 'profile-unavailable', user };
      publish(result);
      return result;
    }

    if (!isCurrent(expectedOperation, user)) return { kind: 'failed', message: PROFILE_UNAVAILABLE_MESSAGE };
    if (!isProfileForUser(profile, user.uid)) {
      const result: AuthSessionResult = { kind: 'profile-recovery', reason: 'missing-profile', user };
      publish(result);
      return result;
    }

    try {
      await profiles.upsert(profile);
    } catch {
      const result: AuthSessionResult = { kind: 'profile-recovery', reason: 'profile-unavailable', user };
      if (isCurrent(expectedOperation, user)) publish(result);
      return result;
    }
    if (!isCurrent(expectedOperation, user)) return { kind: 'failed', message: PROFILE_UNAVAILABLE_MESSAGE };
    const result: AuthSessionResult = { kind: 'authenticated', profile, source: 'server' };
    publish(result);
    return result;
  }

  return {
    getState: () => state,
    subscribe(listener: (next: AuthSessionState) => void) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    async restoreSession(user: RegistrationUser | null): Promise<void> {
      if (user?.uid !== (auth.getCurrentUser()?.uid ?? null)) return;
      const expectedOperation = operation;
      if (!user) {
        publish({ kind: 'signed-out' });
        return;
      }
      if ((state.kind === 'authenticated' && state.profile.uid !== user.uid)
        || (state.kind === 'profile-recovery' && state.user.uid !== user.uid)) {
        publish({ kind: 'loading' });
      }

      try {
        const cached = await profiles.get(user.uid);
        if (!isCurrent(expectedOperation, user)) return;
        if (isProfileForUser(cached, user.uid)) {
          publish({ kind: 'authenticated', profile: cached, source: 'cache' });
          return;
        }
      } catch {
        // A failed cache read must not authorize access; try the owner-only server read.
      }

      await loadServerProfile(user, expectedOperation);
    },
    async signIn(email: string, password: string): Promise<AuthSessionResult> {
      const expectedOperation = ++operation;
      try {
        const user = await auth.signIn(email.trim(), password);
        if (!isCurrent(expectedOperation, user)) return { kind: 'failed', message: PROFILE_UNAVAILABLE_MESSAGE };
        return await loadServerProfile(user, expectedOperation);
      } catch (error) {
        if (operation !== expectedOperation) return { kind: 'failed', message: PROFILE_UNAVAILABLE_MESSAGE };
        if (!auth.getCurrentUser()) publish({ kind: 'signed-out' });
        const code = normalizedErrorCode(error);
        if (code === 'network-request-failed' || code === 'unavailable' || code === 'timeout') {
          return { kind: 'failed', message: CONNECTION_ERROR_MESSAGE };
        }
        if (code === 'invalid-email' || code === 'user-disabled' || code === 'user-not-found'
          || code === 'wrong-password' || code === 'invalid-credential') {
          return { kind: 'failed', message: INVALID_CREDENTIALS_MESSAGE };
        }
        return { kind: 'failed', message: INVALID_CREDENTIALS_MESSAGE };
      }
    },
    async refreshProfile(): Promise<AuthSessionResult> {
      const user = auth.getCurrentUser();
      if (!user) {
        publish({ kind: 'signed-out' });
        return { kind: 'failed', message: INVALID_CREDENTIALS_MESSAGE };
      }
      return loadServerProfile(user, ++operation);
    },
    async signOut(): Promise<{ kind: 'signed-out' } | { kind: 'failed'; message: string }> {
      const expectedOperation = ++operation;
      try {
        await auth.signOut();
        if (operation === expectedOperation && !auth.getCurrentUser()) publish({ kind: 'signed-out' });
        return { kind: 'signed-out' };
      } catch {
        const user = auth.getCurrentUser();
        if (user) await this.restoreSession(user);
        return { kind: 'failed', message: SIGN_OUT_FAILED_MESSAGE };
      }
    },
    dispose() {
      operation += 1;
      listeners.clear();
    },
  };
}
