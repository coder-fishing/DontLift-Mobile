type NativeStatement = {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
  run: (...params: unknown[]) => unknown;
};

type NativeDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => NativeStatement;
  close: () => void;
};

type TestFileSystem = {
  mkdtempSync: (prefix: string) => string;
  rmSync: (path: string, options: { recursive: boolean; force: boolean }) => void;
};

type TestPath = { join: (...parts: string[]) => string };

type TestOs = { tmpdir: () => string };

const fileSystem = require('fs') as TestFileSystem;
const path = require('path') as TestPath;
const operatingSystem = require('os') as TestOs;

type TestDatabase = {
  execAsync: (sql: string) => Promise<void>;
  getFirstAsync: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
  runAsync: (sql: string, ...params: unknown[]) => Promise<unknown>;
  withExclusiveTransactionAsync: (task: (transaction: TestDatabase) => Promise<void>) => Promise<void>;
  closeAsync: () => Promise<void>;
};

type SQLiteHarness = {
  path: string;
  directory: string;
  failOnProfileMigration: boolean;
  databases: TestDatabase[];
  open: () => TestDatabase;
};

let harness: SQLiteHarness | undefined;

function createSQLiteHarness(databaseFile: string): SQLiteHarness {
  const fixture: SQLiteHarness = {
    path: databaseFile,
    directory: path.join(databaseFile, '..'),
    failOnProfileMigration: false,
    databases: [],
    open: () => {
      const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => NativeDatabase };
      const database = new DatabaseSync(databaseFile);
      const wrapper: TestDatabase = {
        async execAsync(sql: string) {
          if (fixture.failOnProfileMigration && /CREATE TABLE (?:IF NOT EXISTS )?local_profiles/.test(sql)) {
            throw new Error('Injected profile migration failure');
          }
          database.exec(sql);
        },
        async getFirstAsync<T>(sql: string, ...params: unknown[]) {
          return (database.prepare(sql).get(...params) as T | undefined) ?? null;
        },
        async getAllAsync<T>(sql: string, ...params: unknown[]) {
          return database.prepare(sql).all(...params) as T[];
        },
        async runAsync(sql: string, ...params: unknown[]) {
          return database.prepare(sql).run(...params);
        },
        async withExclusiveTransactionAsync(task) {
          database.exec('BEGIN EXCLUSIVE');
          try {
            await task(wrapper);
            database.exec('COMMIT');
          } catch (error) {
            database.exec('ROLLBACK');
            throw error;
          }
        },
        async closeAsync() {
          if (closed) return;
          closed = true;
          database.close();
        },
      };
      let closed = false;
      fixture.databases.push(wrapper);
      return wrapper;
    },
  };
  return fixture;
}

async function loadDatabaseModule() {
  jest.resetModules();
  jest.doMock('expo-sqlite', () => ({
    openDatabaseAsync: async () => {
      if (!harness) throw new Error('SQLite test harness was not initialized.');
      return harness.open();
    },
  }));
  return require('../src/features/local/database') as typeof import('../src/features/local/database');
}

beforeEach(() => {
  const testDirectory = fileSystem.mkdtempSync(path.join(operatingSystem.tmpdir(), 'dontlift-local-database-'));
  harness = createSQLiteHarness(path.join(testDirectory, 'test.db'));
});

afterEach(async () => {
  if (harness) {
    await Promise.all(harness.databases.map((database) => database.closeAsync()));
    fileSystem.rmSync(harness.directory, { recursive: true, force: true });
  }
  jest.dontMock('expo-sqlite');
});

describe('local database initialization', () => {
  test('creates the profile schema and records its migration version on a fresh database', async () => {
    const { getLocalDatabase } = await loadDatabaseModule();
    const database = await getLocalDatabase();

    const profileTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'local_profiles'",
    );
    const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(local_profiles)');

    expect(profileTable?.name).toBe('local_profiles');
    expect(version?.user_version).toBe(1);
    expect(columns?.map(({ name }) => name)).toEqual([
      'uid',
      'email',
      'display_name',
      'created_at_utc_ms',
    ]);
  });

  test('reopening preserves the profile and does not rerun an applied migration', async () => {
    const firstModule = await loadDatabaseModule();
    const firstDatabase = await firstModule.getLocalDatabase();
    await firstDatabase.runAsync(
      'INSERT INTO local_profiles (uid, email, display_name, created_at_utc_ms) VALUES (?, ?, ?, ?)',
      'owner-1',
      'owner@example.test',
      'Owner',
      1,
    );
    await firstDatabase.closeAsync();

    const secondModule = await loadDatabaseModule();
    const reopened = await secondModule.getLocalDatabase();
    const profile = await reopened.getFirstAsync<{ uid: string; display_name: string }>(
      'SELECT uid, display_name FROM local_profiles WHERE uid = ?',
      'owner-1',
    );
    const version = await reopened.getFirstAsync<{ user_version: number }>('PRAGMA user_version');

    expect(profile).toEqual({ uid: 'owner-1', display_name: 'Owner' });
    expect(version?.user_version).toBe(1);
    await reopened.closeAsync();
  });

  test('a migration failure rolls back schema and version and rejects readiness', async () => {
    const currentHarness = harness;
    if (!currentHarness) throw new Error('SQLite test harness was not initialized.');
    currentHarness.failOnProfileMigration = true;
    const { getLocalDatabase } = await loadDatabaseModule();

    await expect(getLocalDatabase()).rejects.toThrow('Injected profile migration failure');
    currentHarness.failOnProfileMigration = false;
    const verificationConnection = currentHarness.open();
    const profileTable = await verificationConnection.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'local_profiles'",
    );
    const version = await verificationConnection.getFirstAsync<{ user_version: number }>('PRAGMA user_version');

    expect(profileTable).toBeNull();
    expect(version?.user_version).toBe(0);
    await verificationConnection.closeAsync();
  });
});

test('adopts an existing profile table with a missing schema version without deleting rows', async () => {
  const existing = harness?.open();
  if (!existing) throw new Error('Missing test database');
  await existing.execAsync('CREATE TABLE local_profiles (uid TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, display_name TEXT NOT NULL, created_at_utc_ms INTEGER NOT NULL)');
  await existing.runAsync('INSERT INTO local_profiles VALUES (?, ?, ?, ?)', 'legacy-owner', 'legacy@example.test', 'Legacy Name', 123);
  await existing.closeAsync();
  const { getLocalDatabase } = await loadDatabaseModule();
  const database = await getLocalDatabase();
  expect(await database.getFirstAsync('SELECT uid, display_name FROM local_profiles')).toEqual({ uid: 'legacy-owner', display_name: 'Legacy Name' });
  expect(await database.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 1 });
});

test('rejects an incompatible existing profile table without marking it migrated or dropping data', async () => {
  const existing = harness?.open();
  if (!existing) throw new Error('Missing test database');
  await existing.execAsync("CREATE TABLE local_profiles (uid TEXT PRIMARY KEY NOT NULL, display_name TEXT NOT NULL); INSERT INTO local_profiles VALUES ('owner', 'Keep this row')");
  await existing.closeAsync();
  const { getLocalDatabase } = await loadDatabaseModule();
  await expect(getLocalDatabase()).rejects.toThrow('Incompatible local schema');
  const check = harness!.open();
  expect(await check.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 0 });
  expect(await check.getFirstAsync('SELECT display_name FROM local_profiles')).toEqual({ display_name: 'Keep this row' });
});
