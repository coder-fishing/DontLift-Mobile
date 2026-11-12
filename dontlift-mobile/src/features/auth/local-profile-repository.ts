import type * as SQLite from 'expo-sqlite';
import { getLocalDatabase } from '../local/database';
import type { RegistrationProfile, RegistrationProfilePort } from './auth-controller';
import { premiumIsActive } from '../premium/premium-entitlement';

const profileWrites = new WeakMap<SQLite.SQLiteDatabase, Promise<void>>();

function databaseIsBusy(error: unknown): boolean {
  return error instanceof Error && /database is locked|database is busy|SQLITE_BUSY|SQLITE_LOCKED/i.test(error.message);
}

export async function upsertLocalProfile(
  database: SQLite.SQLiteDatabase,
  profile: RegistrationProfile,
): Promise<void> {
  const previous = profileWrites.get(database) ?? Promise.resolve();
  const write = previous.catch(() => undefined).then(async () => {
    // A single UPSERT is already atomic. An exclusive transaction opens another
    // connection and can contend with the profile listeners and other writers.
    for (let attempt = 0; ; attempt += 1) {
      try {
        await database.runAsync(
      `INSERT INTO local_profiles (uid, email, display_name, created_at_utc_ms, premium_expires_at_utc_ms, avatar_uri, avatar_public_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(uid) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         created_at_utc_ms = excluded.created_at_utc_ms,
         premium_expires_at_utc_ms = excluded.premium_expires_at_utc_ms,
         avatar_uri = excluded.avatar_uri,
         avatar_public_id = excluded.avatar_public_id`,
      profile.uid,
      profile.email,
      profile.displayName,
      profile.createdAtUtcMs,
      profile.premiumExpiresAtUtcMs ?? null,
      profile.avatarUri ?? null,
      profile.avatarPublicId ?? null,
        );
        return;
      } catch (error) {
        if (!databaseIsBusy(error) || attempt >= 4) throw error;
        await new Promise(resolve => setTimeout(resolve, 40 * 2 ** attempt));
      }
    }
  });
  profileWrites.set(database, write);
  try { await write; }
  finally { if (profileWrites.get(database) === write) profileWrites.delete(database); }
}

export function createLocalProfileRepository(): RegistrationProfilePort {
  return {
    async upsert(profile) {
      const database = await getLocalDatabase();
      await upsertLocalProfile(database, profile);
    },
  };
}

export async function getLocalProfile(
  database: SQLite.SQLiteDatabase,
  uid: string,
): Promise<RegistrationProfile | null> {
  const row = await database.getFirstAsync<{
    uid: string;
    email: string;
    display_name: string;
    created_at_utc_ms: number;
    premium_expires_at_utc_ms: number | null;
    avatar_uri: string | null;
    avatar_public_id: string | null;
  }>(
    `SELECT uid, email, display_name, created_at_utc_ms, premium_expires_at_utc_ms, avatar_uri, avatar_public_id
     FROM local_profiles WHERE uid = ?`,
    uid,
  );

  if (!row) return null;
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name,
    isPremium: premiumIsActive(row.premium_expires_at_utc_ms),
    premiumExpiresAtUtcMs: row.premium_expires_at_utc_ms,
    avatarUri: row.avatar_uri,
    avatarPublicId: row.avatar_public_id,
    createdAtUtcMs: row.created_at_utc_ms,
  };
}

export function createAuthSessionProfileRepository(): RegistrationProfilePort & {
  get(uid: string): Promise<RegistrationProfile | null>;
} {
  return {
    async get(uid) {
      const database = await getLocalDatabase();
      return getLocalProfile(database, uid);
    },
    async upsert(profile) {
      const database = await getLocalDatabase();
      await upsertLocalProfile(database, profile);
    },
  };
}
