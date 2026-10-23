import type * as SQLite from 'expo-sqlite';
import { getLocalDatabase } from '../local/database';
import type { RegistrationProfile, RegistrationProfilePort } from './auth-controller';
import { premiumIsActive } from '../premium/premium-entitlement';

export async function upsertLocalProfile(
  database: SQLite.SQLiteDatabase,
  profile: RegistrationProfile,
): Promise<void> {
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO local_profiles (uid, email, display_name, created_at_utc_ms, premium_expires_at_utc_ms)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(uid) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         created_at_utc_ms = excluded.created_at_utc_ms,
         premium_expires_at_utc_ms = excluded.premium_expires_at_utc_ms`,
      profile.uid,
      profile.email,
      profile.displayName,
      profile.createdAtUtcMs,
      profile.premiumExpiresAtUtcMs ?? null,
    );
  });
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
  }>(
    `SELECT uid, email, display_name, created_at_utc_ms, premium_expires_at_utc_ms
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
