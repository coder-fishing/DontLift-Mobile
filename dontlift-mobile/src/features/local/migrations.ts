import type * as SQLite from 'expo-sqlite';

type LocalMigration = {
  version: number;
  migrate: (database: SQLite.SQLiteDatabase) => Promise<void>;
};

const migrations: LocalMigration[] = [
  {
    version: 1,
    migrate: (database) => database.execAsync(`
      CREATE TABLE local_profiles (
        uid TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at_utc_ms INTEGER NOT NULL
      );
    `),
  },
];

const latestSchemaVersion = migrations.at(-1)?.version ?? 0;

export async function migrateLocalDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  const initial = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = initial?.user_version ?? 0;

  if (!Number.isInteger(currentVersion) || currentVersion < 0 || currentVersion > latestSchemaVersion) {
    throw new Error('Unsupported local database schema version.');
  }

  for (const migration of migrations) {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      const latest = await transaction.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      const transactionVersion = latest?.user_version ?? 0;
      if (transactionVersion >= migration.version) return;

      if (transactionVersion !== migration.version - 1) {
        throw new Error('Local database migrations must be applied in order.');
      }

      await migration.migrate(transaction);
      // Schema and version are committed together; a failed migration rolls both back.
      await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
