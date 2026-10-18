import { createAuthController } from '../src/features/auth/auth-controller';
import type {
  RegistrationAuthPort,
  RegistrationProfile,
  RegistrationProfilePort,
  RegistrationResponse,
  RegistrationUser,
} from '../src/features/auth/auth-controller';

const profile: RegistrationProfile = {
  uid: 'user-1',
  email: 'lift@example.com',
  displayName: 'Lift Friend',
  isPremium: false,
  createdAtUtcMs: 1_700_000_000_000,
};

function setup() {
  let currentUser: RegistrationUser | null = null;
  let failBootstrap = false;
  let failUpsert = false;
  let failCreateAccount = false;
  const events: string[] = [];
  const failureStages: string[] = [];
  const requests: Array<{ version: 1; requestId: string; displayName: string }> = [];
  const auth: RegistrationAuthPort = {
    getCurrentUser: () => currentUser,
    onAuthStateChanged: () => () => undefined,
    async createAccount(email) {
      events.push('create');
      if (failCreateAccount) throw { code: 'auth/email-already-in-use' };
      currentUser = { uid: 'user-1', email, displayName: null };
      return currentUser;
    },
    async setDisplayName(user, displayName) {
      events.push('set-name');
      currentUser = { ...user, displayName };
    },
    async completeProfile(request): Promise<RegistrationResponse> {
      events.push('bootstrap');
      requests.push(request);
      if (failBootstrap) throw new Error('Firestore unavailable');
      return { version: 1, requestId: request.requestId, profile };
    },
  };
  const profiles: RegistrationProfilePort = {
    async upsert(value) {
      events.push('upsert');
      if (failUpsert) throw new Error('SQLite unavailable');
      if (value.uid !== profile.uid) throw new Error('Unexpected profile');
    },
  };

  return {
    controller: createAuthController(auth, profiles, () => '00000000-0000-4000-8000-000000000001', (stage) => failureStages.push(stage)),
    failureStages,
    events,
    requests,
    setFailBootstrap(value: boolean) { failBootstrap = value; },
    setFailUpsert(value: boolean) { failUpsert = value; },
    setFailCreateAccount(value: boolean) { failCreateAccount = value; },
    setCurrentUser(user: RegistrationUser | null) { currentUser = user; },
  };
}

const validInput = {
  displayName: '  Lift Friend  ',
  email: 'lift@example.com',
  password: 'secret-password',
  passwordConfirmation: 'secret-password',
};

describe('registration profile controller', () => {
  it('rejects mismatched confirmation before creating an Auth account', async () => {
    const { controller, events } = setup();
    const result = await controller.register({ ...validInput, passwordConfirmation: 'different-password' });

    expect(result.kind).toBe('invalid');
    expect(events).toEqual([]);
  });

  it('returns a generic failure when the email is already registered', async () => {
    const state = setup();
    state.setFailCreateAccount(true);
    const result = await state.controller.register(validInput);

    expect(result).toEqual({
      kind: 'failed',
      message: 'We could not create your account. Check your details and try again.',
    });
  });

  it('creates Auth identity, bootstraps canonical profile, then persists local projection', async () => {
    const { controller, events } = setup();
    const result = await controller.register(validInput);

    expect(result).toEqual({ kind: 'completed', profile });
    expect(events).toEqual(['create', 'set-name', 'bootstrap', 'upsert']);
  });

  it('retries profile completion with the same request and does not create another account', async () => {
    const state = setup();
    state.setFailBootstrap(true);
    const first = await state.controller.register(validInput);
    state.setFailBootstrap(false);
    const second = await state.controller.resumeProfileCompletion();

    expect(first.kind).toBe('pending');
    expect(second).toEqual({ kind: 'completed', profile });
    expect(state.requests).toHaveLength(2);
    expect(state.requests[1]).toEqual(state.requests[0]);
    expect(state.events.filter((event) => event === 'create')).toHaveLength(1);
  });

  it('recovers from local SQLite failure without creating another account', async () => {
    const state = setup();
    state.setFailUpsert(true);
    const first = await state.controller.register(validInput);
    state.setFailUpsert(false);
    const second = await state.controller.resumeProfileCompletion();

    expect(first.kind).toBe('pending');
    expect(second).toEqual({ kind: 'completed', profile });
    expect(state.requests[1]).toEqual(state.requests[0]);
    expect(state.events.filter((event) => event === 'create')).toHaveLength(1);
  });

  it('asks for the name when a restored Auth session has no display name', async () => {
    const state = setup();
    state.setCurrentUser({ uid: 'user-1', email: 'lift@example.com', displayName: null });
    const result = await state.controller.resumeProfileCompletion();

    expect(result).toEqual({ kind: 'needs-name' });
    expect(state.events).toEqual([]);
  });
});


test('identifies remote profile failure separately from local persistence failure', async () => {
  const remote = setup();
  remote.setFailBootstrap(true);
  await remote.controller.register(validInput);
  expect(remote.failureStages).toEqual(['firestore-profile']);
  const local = setup();
  local.setFailUpsert(true);
  await local.controller.register(validInput);
  expect(local.failureStages).toEqual(['local-profile']);
});
