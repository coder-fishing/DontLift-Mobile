import { createAuthSessionController } from '../src/features/auth/auth-session-controller';
import type { RegistrationProfile, RegistrationUser } from '../src/features/auth/auth-controller';
import type { AuthSessionState } from '../src/features/auth/auth-session-controller';

const profile = (uid: string, displayName = `User ${uid}`): RegistrationProfile => ({
  uid,
  email: `${uid}@example.com`,
  displayName,
  isPremium: false,
  createdAtUtcMs: 1_700_000_000_000,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setup() {
  let currentUser: RegistrationUser | null = null;
  let signInError: unknown;
  const localProfiles = new Map<string, RegistrationProfile>();
  const remoteProfiles = new Map<string, RegistrationProfile>();
  const stateChanges: AuthSessionState[] = [];
  const remoteReads: string[] = [];
  const auth = {
    getCurrentUser: () => currentUser,
    async signIn(email: string) {
      if (signInError) throw signInError;
      currentUser = { uid: email.split('@')[0], email, displayName: null };
      return currentUser;
    },
    async signOut() { currentUser = null; },
  };
  const profiles = {
    async get(uid: string) { return localProfiles.get(uid) ?? null; },
    async upsert(value: RegistrationProfile) { localProfiles.set(value.uid, value); },
  };
  const remote = {
    async get(uid: string) {
      remoteReads.push(uid);
      return remoteProfiles.get(uid) ?? null;
    },
  };
  const controller = createAuthSessionController(auth, profiles, remote);
  controller.subscribe((state) => stateChanges.push(state));

  return {
    controller,
    auth,
    localProfiles,
    remoteProfiles,
    remoteReads,
    stateChanges,
    setCurrentUser(user: RegistrationUser | null) { currentUser = user; },
    setSignInError(error: unknown) { signInError = error; },
  };
}

describe('login and auth session controller', () => {
  it('uses a generic error for invalid credentials and stays signed out', async () => {
    const state = setup();
    state.setSignInError({ code: 'auth/invalid-credential' });

    const result = await state.controller.signIn('unknown@example.com', 'wrong-password');

    expect(result).toEqual({ kind: 'failed', message: 'Invalid email or password.' });
    expect(state.controller.getState()).toEqual({ kind: 'signed-out' });
  });

  it('shows the offline login message for a network failure', async () => {
    const state = setup();
    state.setSignInError({ code: 'auth/network-request-failed' });

    await expect(state.controller.signIn('lift@example.com', 'password123')).resolves.toEqual({
      kind: 'failed',
      message: 'Internet connection required to log in.',
    });
  });

  it('loads and caches the canonical profile before exposing an authenticated state', async () => {
    const state = setup();
    state.remoteProfiles.set('lift', profile('lift', 'Pham Nhuoc Trieu'));

    const result = await state.controller.signIn('lift@example.com', 'password123');

    expect(result).toEqual({ kind: 'authenticated', profile: profile('lift', 'Pham Nhuoc Trieu'), source: 'server' });
    expect(state.localProfiles.get('lift')).toEqual(profile('lift', 'Pham Nhuoc Trieu'));
    expect(state.controller.getState()).toEqual(result);
    expect(state.remoteReads).toEqual(['lift']);
  });

  it('restores the matching local profile without requiring a network read', async () => {
    const state = setup();
    const cached = profile('cached-user');
    state.localProfiles.set(cached.uid, cached);
    state.setCurrentUser({ uid: cached.uid, email: cached.email, displayName: cached.displayName });

    await state.controller.restoreSession(state.auth.getCurrentUser());

    expect(state.controller.getState()).toEqual({ kind: 'authenticated', profile: cached, source: 'cache' });
    expect(state.remoteReads).toEqual([]);
  });

  it('clears user A from the session before restoring user B profile', async () => {
    const state = setup();
    const first = profile('user-a', 'User A');
    const second = profile('user-b', 'User B');
    state.localProfiles.set(first.uid, first);
    state.localProfiles.set(second.uid, second);
    state.setCurrentUser({ uid: first.uid, email: first.email, displayName: first.displayName });
    await state.controller.restoreSession(state.auth.getCurrentUser());

    state.setCurrentUser({ uid: second.uid, email: second.email, displayName: second.displayName });
    const restoringSecondUser = state.controller.restoreSession(state.auth.getCurrentUser());

    expect(state.controller.getState()).toEqual({ kind: 'loading' });
    await restoringSecondUser;
    expect(state.controller.getState()).toEqual({ kind: 'authenticated', profile: second, source: 'cache' });
    expect(state.remoteReads).toEqual([]);
  });

  it('sends an authenticated user without a profile to recovery without creating another account', async () => {
    const state = setup();
    state.remoteProfiles.delete('lift');

    const result = await state.controller.signIn('lift@example.com', 'password123');

    expect(result).toEqual({ kind: 'profile-recovery', reason: 'missing-profile', user: { uid: 'lift', email: 'lift@example.com', displayName: null } });
    expect(state.controller.getState()).toEqual(result);
  });

  it('ignores an older restore failure after a different user logs in', async () => {
    const state = setup();
    const restoreRead = deferred<RegistrationProfile | null>();
    const restoreStarted = deferred<void>();
    // Replace only the remote read promise for user A; user B remains immediately available.
    const staleController = createAuthSessionController(state.auth, {
      async get(uid: string) { return state.localProfiles.get(uid) ?? null; },
      upsert: (value: RegistrationProfile) => { state.localProfiles.set(value.uid, value); return Promise.resolve(); },
    }, {
      get(uid: string) {
        if (uid === 'user-a') {
          restoreStarted.resolve();
          return restoreRead.promise;
        }
        return Promise.resolve(profile(uid));
      },
    });
    state.setCurrentUser({ uid: 'user-a', email: 'user-a@example.com', displayName: null });
    const restoring = staleController.restoreSession(state.auth.getCurrentUser());
    await restoreStarted.promise;
    const signingIn = staleController.signIn('user-b@example.com', 'password123');

    await expect(signingIn).resolves.toMatchObject({ kind: 'authenticated', profile: { uid: 'user-b' } });
    restoreRead.reject(new Error('old restore failed'));
    await restoring;

    expect(staleController.getState()).toMatchObject({ kind: 'authenticated', profile: { uid: 'user-b' } });
  });

  it('does not restore a profile after sign-out wins a pending restore', async () => {
    const state = setup();
    const remoteRead = deferred<RegistrationProfile | null>();
    const controller = createAuthSessionController(state.auth, {
      async get(uid: string) { return state.localProfiles.get(uid) ?? null; },
      upsert: (value: RegistrationProfile) => { state.localProfiles.set(value.uid, value); return Promise.resolve(); },
    }, { get: () => remoteRead.promise });
    state.setCurrentUser({ uid: 'lift', email: 'lift@example.com', displayName: null });
    const restoring = controller.restoreSession(state.auth.getCurrentUser());

    await controller.signOut();
    remoteRead.resolve(profile('lift'));
    await restoring;

    expect(controller.getState()).toEqual({ kind: 'signed-out' });
  });
});
