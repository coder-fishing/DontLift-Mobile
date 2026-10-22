import { runTransaction, onSnapshot } from 'firebase/firestore';
import { createProfileRepository, validateProfileDisplayName } from '../src/features/profile/profile-repository';
import { canSubmitProfileSave } from '../src/features/profile/profile-save-state';

jest.mock('firebase/firestore', () => ({
  doc: (_firestore: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  onSnapshot: jest.fn(), runTransaction: jest.fn(), serverTimestamp: () => 'SERVER_TIME',
}));

const firestore = {} as never;
const auth = { currentUser: { uid: 'user-a' } } as never;
const profile = { uid: 'user-a', email: 'a@example.test', displayName: 'Before', isPremium: true, createdAtUtcMs: 1234 };

describe('profile editing', () => {
  beforeEach(() => jest.clearAllMocks());

  it('trims names and validates 1–40 Unicode code points', () => {
    expect(validateProfileDisplayName('  Minh Anh  ')).toEqual({ value: 'Minh Anh' });
    expect(validateProfileDisplayName('   ').error).toBe('required');
    expect(validateProfileDisplayName('a'.repeat(41)).error).toBe('too-long');
    expect(validateProfileDisplayName('ế'.repeat(40))).toEqual({ value: 'ế'.repeat(40) });
    expect(validateProfileDisplayName('😀'.repeat(40))).toEqual({ value: '😀'.repeat(40) });
  });

  it('updates only the signed-in profile name and returns the canonical profile', async () => {
    const update = jest.fn();
    jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({
      get: async () => ({ exists: () => true, data: () => ({
        displayName: 'Before', email: 'a@example.test', isPremium: true, createdAt: { toMillis: () => 1234 },
      }) }), update,
    } as never));
    const persistLocal = jest.fn().mockResolvedValue(undefined);
    const repository = createProfileRepository({ firestore, auth, persistLocal });

    await expect(repository.updateDisplayName('user-a', '  After  ')).resolves.toEqual({ ...profile, displayName: 'After' });
    expect(update).toHaveBeenCalledWith({ path: 'users/user-a' }, { displayName: 'After', updatedAt: 'SERVER_TIME' });
    expect(persistLocal).toHaveBeenCalledWith({ ...profile, displayName: 'After' });
  });

  it('repairs the local projection without rewriting an already committed name', async () => {
    const update = jest.fn();
    jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({
      get: async () => ({ exists: () => true, data: () => ({
        displayName: 'After', email: profile.email, isPremium: true, createdAt: { toMillis: () => 1234 },
      }) }), update,
    } as never));
    const persistLocal = jest.fn().mockResolvedValue(undefined);
    const repository = createProfileRepository({ firestore, auth, persistLocal });

    await expect(repository.updateDisplayName('user-a', 'After')).resolves.toEqual({ ...profile, displayName: 'After' });
    expect(update).not.toHaveBeenCalled();
    expect(persistLocal).toHaveBeenCalledWith({ ...profile, displayName: 'After' });
  });

  it('does not start a transaction for an invalid name or a different account', async () => {
    const repository = createProfileRepository({ firestore, auth, persistLocal: jest.fn() });
    await expect(repository.updateDisplayName('user-a', '  ')).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(repository.updateDisplayName('user-b', 'Other')).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('subscribes to and projects the canonical server profile', () => {
    const unsubscribe = jest.fn();
    jest.mocked(onSnapshot).mockReturnValue(unsubscribe);
    const onProfile = jest.fn();
    const persistLocal = jest.fn().mockResolvedValue(undefined);
    const repository = createProfileRepository({ firestore, auth, persistLocal });
    expect(repository.listen('user-a', onProfile, jest.fn())).toBe(unsubscribe);
    expect(onSnapshot).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-a' }),
      { includeMetadataChanges: true }, expect.any(Function), expect.any(Function));

    const onSnapshotProfile = jest.mocked(onSnapshot).mock.calls[0][2] as unknown as (snapshot: unknown) => void;
    const cachedSnapshot = {
      exists: () => true,
      data: () => ({ displayName: 'Canonical', email: profile.email, isPremium: true, createdAt: { toMillis: () => 1234 } }),
      metadata: { fromCache: true },
    };
    onSnapshotProfile(cachedSnapshot);
    onSnapshotProfile({ ...cachedSnapshot, metadata: { fromCache: false } });
    expect(onProfile).toHaveBeenCalledWith({ ...profile, displayName: 'Canonical' }, false);
    expect(persistLocal).toHaveBeenCalledWith({ ...profile, displayName: 'Canonical' });
  });

  it('ignores a profile snapshot after the authenticated account changes', () => {
    jest.mocked(onSnapshot).mockReturnValue(jest.fn());
    const onProfile = jest.fn();
    const repository = createProfileRepository({ firestore, auth, persistLocal: jest.fn() });
    repository.listen('user-a', onProfile, jest.fn());
    const onSnapshotProfile = jest.mocked(onSnapshot).mock.calls[0][2] as unknown as (snapshot: unknown) => void;
    (auth as unknown as { currentUser: { uid: string } }).currentUser.uid = 'user-b';
    onSnapshotProfile({
      exists: () => true,
      data: () => ({ displayName: 'Private', email: profile.email, isPremium: false, createdAt: { toMillis: () => 1234 } }),
      metadata: { fromCache: false },
    });
    expect(onProfile).not.toHaveBeenCalled();
    (auth as unknown as { currentUser: { uid: string } }).currentUser.uid = 'user-a';
  });

  it('allows an online retry when only the local profile projection needs repair', () => {
    expect(canSubmitProfileSave({ dirty: false, needsLocalRepair: true, saving: false, online: true })).toBe(true);
    expect(canSubmitProfileSave({ dirty: false, needsLocalRepair: true, saving: false, online: false })).toBe(false);
    expect(canSubmitProfileSave({ dirty: false, needsLocalRepair: false, saving: false, online: true })).toBe(false);
  });
});
