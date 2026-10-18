import type * as SQLite from 'expo-sqlite';

type LocalMigration = {
  version: number;
  migrate: (database: SQLite.SQLiteDatabase) => Promise<void>;
};


type ExpectedColumn = { type: 'TEXT' | 'INTEGER'; notnull: number; pk: number };

async function validateExistingSchema(
  database: SQLite.SQLiteDatabase,
  table: 'local_profiles',
  expected: Record<string, ExpectedColumn>,
): Promise<void> {
  const columns = await database.getAllAsync<{ name: string; type: string; notnull: number; pk: number }>(
    'PRAGMA table_info(' + table + ')',
  );
  if (columns.length !== Object.keys(expected).length || columns.some((column) => {
    const target = expected[column.name];
    return !target || column.type.toUpperCase() !== target.type
      || column.notnull !== target.notnull || column.pk !== target.pk;
  })) {
    throw new Error('Incompatible local schema for ' + table + '. Existing data was preserved.');
  }
}

const migrations: LocalMigration[] = [
  {
    version: 1,
    migrate: async (database) => {
      // Schema cũ có thể đã tồn tại dù user_version chưa ghi; nhận lại schema hợp lệ thay vì xóa dữ liệu.
      await database.execAsync(`
      CREATE TABLE IF NOT EXISTS local_profiles (
        uid TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at_utc_ms INTEGER NOT NULL
      );
    `);
      await validateExistingSchema(database, 'local_profiles', {
        uid: { type: 'TEXT', notnull: 1, pk: 1 },
        email: { type: 'TEXT', notnull: 1, pk: 0 },
        display_name: { type: 'TEXT', notnull: 1, pk: 0 },
        created_at_utc_ms: { type: 'INTEGER', notnull: 1, pk: 0 },
      });
    },
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
