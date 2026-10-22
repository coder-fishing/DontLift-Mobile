import type { Auth } from 'firebase/auth';
import { doc, onSnapshot, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';
import type { RegistrationProfile } from '../auth/auth-controller';
import { readRegistrationProfile } from '../auth/firebase-profile';
import { getLocalDatabase } from '../local/database';
import { upsertLocalProfile } from '../auth/local-profile-repository';
import type * as SQLite from 'expo-sqlite';

export type ProfileNameValidation = { value: string; error?: undefined } | { value?: undefined; error: 'required' | 'too-long' };
export function validateProfileDisplayName(input: string): ProfileNameValidation {
  const value = input.trim();
  if (!value) return { error: 'required' };
  if (Array.from(value).length > 40) return { error: 'too-long' };
  return { value };
}

export class ProfileEditError extends Error {
  constructor(readonly code: 'unauthenticated' | 'invalid-argument' | 'not-found' | 'permission-denied' | 'unavailable' | 'local-cache-failed') {
    super(code);
    this.name = 'ProfileEditError';
  }
}

function mapError(error: unknown): ProfileEditError {
  const raw = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code.replace(/^firestore\//, '') : '';
  if (raw === 'unauthenticated' || raw === 'permission-denied' || raw === 'not-found' || raw === 'invalid-argument') {
    return new ProfileEditError(raw);
  }
  return new ProfileEditError('unavailable');
}

export function createProfileRepository(dependencies: {
  firestore: Firestore;
  auth: Auth;
  database?: Promise<SQLite.SQLiteDatabase>;
  persistLocal?: (profile: RegistrationProfile) => Promise<void>;
}) {
  const persistLocal = dependencies.persistLocal ?? (async (profile: RegistrationProfile) => {
    await upsertLocalProfile(await (dependencies.database ?? getLocalDatabase()), profile);
  });

  return {
    listen(uid: string, onProfile: (profile: RegistrationProfile, fromCache: boolean) => void,
      onError: (error: ProfileEditError) => void): () => void {
      if (dependencies.auth.currentUser?.uid !== uid) {
        onError(new ProfileEditError('unauthenticated'));
        return () => undefined;
      }
      return onSnapshot(doc(dependencies.firestore, 'users', uid), snapshot => {
        if (dependencies.auth.currentUser?.uid !== uid) return;
        if (!snapshot.exists()) { onError(new ProfileEditError('not-found')); return; }
        try {
          const profile = readRegistrationProfile(uid, snapshot.data());
          if (!snapshot.metadata.fromCache) {
            void persistLocal(profile).catch(() => undefined);
          }
          onProfile(profile, snapshot.metadata.fromCache);
        }
        catch { onError(new ProfileEditError('invalid-argument')); }
      }, error => onError(mapError(error)));
    },
    async updateDisplayName(uid: string, input: string): Promise<RegistrationProfile> {
      if (dependencies.auth.currentUser?.uid !== uid) throw new ProfileEditError('unauthenticated');
      const validation = validateProfileDisplayName(input);
      if (!validation.value) throw new ProfileEditError('invalid-argument');
      const reference = doc(dependencies.firestore, 'users', uid);
      let canonical: RegistrationProfile;
      try {
        // Transaction cần kết nối server; lúc offline SDK không xếp tên vào hàng đợi để ghi muộn.
        canonical = await runTransaction(dependencies.firestore, async transaction => {
          if (dependencies.auth.currentUser?.uid !== uid) throw new ProfileEditError('unauthenticated');
          const saved = await transaction.get(reference);
          if (!saved.exists()) throw new ProfileEditError('not-found');
          const previous = readRegistrationProfile(uid, saved.data());
          // Retry sau lỗi cache chỉ đồng bộ lại SQLite, không gửi update rỗng bị Rules từ chối.
          if (previous.displayName === validation.value) return previous;
          // Email và entitlement chỉ đọc; Rules cũng chỉ cho đổi tên cùng timestamp server.
          transaction.update(reference, { displayName: validation.value, updatedAt: serverTimestamp() });
          return { ...previous, displayName: validation.value };
        });
      } catch (error) {
        if (error instanceof ProfileEditError) throw error;
        throw mapError(error);
      }
      if (dependencies.auth.currentUser?.uid !== uid) throw new ProfileEditError('unauthenticated');
      try { await persistLocal(canonical); }
      catch { throw new ProfileEditError('local-cache-failed'); }
      return canonical;
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
