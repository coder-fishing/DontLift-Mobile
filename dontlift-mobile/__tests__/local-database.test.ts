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
  failOnSessionsMigration: boolean;
  failOnSessionInsert: boolean;
  failOnViolationInsert: boolean;
  databases: TestDatabase[];
  open: () => TestDatabase;
};

let harness: SQLiteHarness | undefined;

function createSQLiteHarness(databaseFile: string): SQLiteHarness {
  const fixture: SQLiteHarness = {
    path: databaseFile,
    directory: path.join(databaseFile, '..'),
    failOnProfileMigration: false,
    failOnSessionsMigration: false,
    failOnSessionInsert: false,
    failOnViolationInsert: false,
    databases: [],
    open: () => {
      const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => NativeDatabase };
      const database = new DatabaseSync(databaseFile);
      const wrapper: TestDatabase = {
        async execAsync(sql: string) {
          if (fixture.failOnProfileMigration && /CREATE TABLE (?:IF NOT EXISTS )?local_profiles/.test(sql)) {
            throw new Error('Injected profile migration failure');
          }
          if (fixture.failOnSessionsMigration && /CREATE TABLE (?:IF NOT EXISTS )?sessions/.test(sql)) {
            throw new Error('Injected sessions migration failure');
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
          if (fixture.failOnSessionInsert && sql.includes('INSERT INTO sessions')) {
            throw new Error('Injected session insert failure');
          }
          if (fixture.failOnViolationInsert && sql.includes('INSERT INTO violation_logs')) {
            throw new Error('Injected local violation insert failure');
          }
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
  test('creates profile, Solo session, violation and outbox schemas on a fresh database', async () => {
    const { getLocalDatabase } = await loadDatabaseModule();
    const database = await getLocalDatabase();

    const profileTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'local_profiles'",
    );
    const sessionsTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sessions'",
    );
    const violationsTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'violation_logs'",
    );
    const outboxTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sync_outbox'",
    );
    const roomsTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rooms'",
    );
    const roomMembersTable = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'room_members'",
    );
    const sessionColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(sessions)');
    const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(local_profiles)');

    expect(profileTable?.name).toBe('local_profiles');
    expect(sessionsTable?.name).toBe('sessions');
    expect(violationsTable?.name).toBe('violation_logs');
    expect(outboxTable?.name).toBe('sync_outbox');
    expect(roomsTable?.name).toBe('rooms');
    expect(roomMembersTable?.name).toBe('room_members');
    expect(sessionColumns.map(({ name }) => name)).toContain('user_id');
    expect(sessionColumns.map(({ name }) => name)).toContain('duration_seconds');
    expect(version?.user_version).toBe(13);
    expect(columns?.map(({ name }) => name)).toEqual([
      'uid',
      'email',
      'display_name',
      'created_at_utc_ms',
      'premium_expires_at_utc_ms',
    ]);
  });

  test('upgrades a version 2 database and preserves existing profile and session data', async () => {
    const { getLocalDatabase } = await loadDatabaseModule();
    const database = await getLocalDatabase();
    await database.runAsync(
      `INSERT INTO local_profiles (uid, email, display_name, created_at_utc_ms) VALUES (?, ?, ?, ?)`,
      'owner-1', 'owner@example.test', 'Owner', 1,
    );
    await database.runAsync(
      `INSERT INTO sessions (id, user_id, mode, status, duration_seconds, started_at)
       VALUES (?, ?, 'STOPWATCH', 'ACTIVE', 0, ?)`,
      'session-1', 'owner-1', '2026-10-18T01:02:03.000Z',
    );
    await database.execAsync('DROP TABLE sync_outbox; DROP TABLE violation_logs; PRAGMA user_version = 2;');
    await database.closeAsync();

    const reopened = await (await loadDatabaseModule()).getLocalDatabase();
    expect(await reopened.getFirstAsync('SELECT uid, display_name FROM local_profiles WHERE uid = ?', 'owner-1'))
      .toEqual({ uid: 'owner-1', display_name: 'Owner' });
    expect(await reopened.getFirstAsync('SELECT id, user_id FROM sessions WHERE id = ?', 'session-1'))
      .toEqual({ id: 'session-1', user_id: 'owner-1' });
    expect(await reopened.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 13 });
    expect(await reopened.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sync_outbox'"))
      .toEqual({ name: 'sync_outbox' });
    await reopened.closeAsync();
  });

  test('records and closes a Solo violation locally without adding a cloud event', async () => {
    const { getLocalDatabase } = await loadDatabaseModule();
    const database = await getLocalDatabase();
    const { recordViolationStart, endViolation } = require('../src/features/solo/violation-repository') as typeof import('../src/features/solo/violation-repository');
    const startedAtUtcMs = Date.parse('2026-10-18T01:00:00.000Z');
    const record = await recordViolationStart(database, {
      sessionId: 'session-1', userId: 'owner-1', startedAtUtcMs, confirmedAtUtcMs: startedAtUtcMs + 3_000,
    }, { createId: () => 'violation-1', now: () => startedAtUtcMs + 3_000 });

    expect(record).toMatchObject({ eventId: 'violation-1', endedAtUtcMs: null, durationSeconds: 3 });
    expect(await database.getFirstAsync('SELECT event_id, session_id, duration_seconds FROM violation_logs'))
      .toEqual({ event_id: 'violation-1', session_id: 'session-1', duration_seconds: 3 });
    expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM sync_outbox'))
      .toEqual({ count: 0 });

    const endedAtUtcMs = startedAtUtcMs + 7_250;
    expect(await endViolation(database, { eventId: 'violation-1', endedAtUtcMs })).toBe(true);
    expect(await endViolation(database, { eventId: 'violation-1', endedAtUtcMs: endedAtUtcMs + 5_000 })).toBe(false);
    const updatedViolation = await database.getFirstAsync('SELECT ended_at, duration_seconds FROM violation_logs');
    expect(updatedViolation).toEqual({ ended_at: new Date(endedAtUtcMs).toISOString(), duration_seconds: 7 });
    expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM sync_outbox'))
      .toEqual({ count: 0 });
    await database.closeAsync();
  });

  test('keeps local violation state empty when its SQLite insert fails', async () => {
    const currentHarness = harness;
    if (!currentHarness) throw new Error('SQLite test harness was not initialized.');
    const database = await (await loadDatabaseModule()).getLocalDatabase();
    const { recordViolationStart } = require('../src/features/solo/violation-repository') as typeof import('../src/features/solo/violation-repository');
    currentHarness.failOnViolationInsert = true;

    await expect(recordViolationStart(database, {
      sessionId: 'session-1',
      userId: 'owner-1',
      startedAtUtcMs: 10_000,
      confirmedAtUtcMs: 13_000,
    }, { createId: () => 'violation-failed', now: () => 13_000 })).rejects.toThrow('Injected local violation insert failure');
    expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM violation_logs')).toEqual({ count: 0 });
    expect(await database.getFirstAsync('SELECT COUNT(*) AS count FROM sync_outbox')).toEqual({ count: 0 });
    await database.closeAsync();
  });

  test('starts or resumes one ACTIVE Solo session per owner UID', async () => {
    const { getLocalDatabase } = await loadDatabaseModule();
    const database = await getLocalDatabase();
    const { startOrResumeLocalSession } = require('../src/features/solo/local-session-repository') as typeof import('../src/features/solo/local-session-repository');
    const startedAt = new Date('2026-10-18T01:02:03.000Z');

    const first = await startOrResumeLocalSession(database, {
      userId: 'owner-1',
      mode: 'COUNTDOWN',
      durationSeconds: 1500,
    }, { createId: () => 'session-1', now: () => startedAt });
    await database.closeAsync();

    const reopenedModule = await loadDatabaseModule();
    const reopened = await reopenedModule.getLocalDatabase();
    const resumed = await startOrResumeLocalSession(reopened, {
      userId: 'owner-1',
      mode: 'STOPWATCH',
      durationSeconds: 0,
    }, { createId: () => 'should-not-be-used', now: () => new Date() });
    const anotherUser = await startOrResumeLocalSession(reopened, {
      userId: 'owner-2',
      mode: 'STOPWATCH',
      durationSeconds: 0,
    }, { createId: () => 'session-2', now: () => startedAt });
    await expect(reopened.runAsync(
      `INSERT INTO sessions (id, user_id, mode, status, duration_seconds, started_at)
       VALUES ('duplicate', 'owner-1', 'STOPWATCH', 'ACTIVE', 0, ?)`,
      startedAt.toISOString(),
    )).rejects.toThrow();
    const rows = await reopened.getAllAsync<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM sessions ORDER BY id',
    );

    expect(first).toEqual({
      session: {
        id: 'session-1',
        userId: 'owner-1',
        mode: 'COUNTDOWN',
        durationSeconds: 1500,
        startedAt: startedAt.toISOString(),
      },
      resumed: false,
    });
    expect(resumed).toEqual({ ...first, resumed: true });
    expect(anotherUser.session.userId).toBe('owner-2');
    expect(rows).toEqual([
      { id: 'session-1', user_id: 'owner-1' },
      { id: 'session-2', user_id: 'owner-2' },
    ]);
    await reopened.closeAsync();
  });

  test('cancels only the active session owned by the UID and permits a new mode', async () => {
    const { getLocalDatabase } = await loadDatabaseModule();
    const database = await getLocalDatabase();
    const { startOrResumeLocalSession, cancelActiveLocalSession } = require('../src/features/solo/local-session-repository') as typeof import('../src/features/solo/local-session-repository');
    const first = await startOrResumeLocalSession(database, { userId: 'owner-1', mode: 'COUNTDOWN', durationSeconds: 1500 }, { createId: () => 'session-old', now: () => new Date('2026-10-18T01:02:03.000Z') });
    const wrongOwner = await cancelActiveLocalSession(database, { userId: 'owner-2', sessionId: first.session.id });
    expect(wrongOwner).toBe(false);
    expect(await database.getFirstAsync("SELECT status FROM sessions WHERE id = 'session-old'")).toEqual({ status: 'ACTIVE' });
    const cancelled = await cancelActiveLocalSession(database, { userId: 'owner-1', sessionId: first.session.id });
    expect(cancelled).toBe(true);
    expect(await database.getFirstAsync("SELECT status, completed_at FROM sessions WHERE id = 'session-old'")).toMatchObject({ status: 'CANCELLED' });
    const next = await startOrResumeLocalSession(database, { userId: 'owner-1', mode: 'STOPWATCH', durationSeconds: 0 }, { createId: () => 'session-new', now: () => new Date('2026-10-18T01:10:00.000Z') });
    expect(next).toMatchObject({ resumed: false, session: { id: 'session-new', mode: 'STOPWATCH', userId: 'owner-1' } });
    expect(await database.getFirstAsync("SELECT COUNT(*) AS count FROM sessions WHERE user_id = 'owner-1' AND status = 'ACTIVE'")).toEqual({ count: 1 });
    await database.closeAsync();
  });

  test('does not return a started session when the local insert fails', async () => {
    const currentHarness = harness;
    if (!currentHarness) throw new Error('SQLite test harness was not initialized.');
    const { getLocalDatabase } = await loadDatabaseModule();
    const database = await getLocalDatabase();
    const { startOrResumeLocalSession } = require('../src/features/solo/local-session-repository') as typeof import('../src/features/solo/local-session-repository');
    currentHarness.failOnSessionInsert = true;

    await expect(startOrResumeLocalSession(database, {
      userId: 'owner-1',
      mode: 'COUNTDOWN',
      durationSeconds: 1500,
    }, { createId: () => 'session-failed', now: () => new Date('2026-10-18T01:02:03.000Z') }))
      .rejects.toThrow('Injected session insert failure');

    currentHarness.failOnSessionInsert = false;
    const rows = await database.getAllAsync<{ id: string }>('SELECT id FROM sessions');
    expect(rows).toEqual([]);
    await database.closeAsync();
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
    expect(version?.user_version).toBe(13);
    await reopened.closeAsync();
  });

  test('upgrades a version 1 profile database without losing its profile', async () => {
    const existing = harness?.open();
    if (!existing) throw new Error('SQLite test harness was not initialized.');
    await existing.execAsync(
      'CREATE TABLE local_profiles (uid TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, display_name TEXT NOT NULL, created_at_utc_ms INTEGER NOT NULL); PRAGMA user_version = 1;',
    );
    await existing.runAsync(
      'INSERT INTO local_profiles (uid, email, display_name, created_at_utc_ms) VALUES (?, ?, ?, ?)',
      'owner-1',
      'owner@example.test',
      'Owner',
      1,
    );
    await existing.closeAsync();

    const { getLocalDatabase } = await loadDatabaseModule();
    const upgraded = await getLocalDatabase();
    const profile = await upgraded.getFirstAsync<{ uid: string; display_name: string }>(
      'SELECT uid, display_name FROM local_profiles WHERE uid = ?',
      'owner-1',
    );
    const sessionsTable = await upgraded.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sessions'",
    );
    const version = await upgraded.getFirstAsync<{ user_version: number }>('PRAGMA user_version');

    expect(profile).toEqual({ uid: 'owner-1', display_name: 'Owner' });
    expect(sessionsTable?.name).toBe('sessions');
    expect(version?.user_version).toBe(13);
    await upgraded.closeAsync();
  });

  test('PIN length migration preserves a cached legacy room and membership', async () => {
    const existing = harness?.open();
    if (!existing) throw new Error('SQLite test harness was not initialized.');
    await existing.execAsync(`
      CREATE TABLE rooms (
        room_id TEXT PRIMARY KEY NOT NULL, host_uid TEXT NOT NULL,
        pin TEXT NOT NULL CHECK(length(pin) = 4 AND pin NOT GLOB '*[^0-9]*'),
        status TEXT NOT NULL CHECK(status IN ('CREATED', 'WAITING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ABORTED')),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE room_members (
        room_id TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
        uid TEXT NOT NULL, display_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('HOST', 'MEMBER')),
        status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'EARLY_EXIT', 'LEFT')),
        joined_at TEXT NOT NULL, PRIMARY KEY(room_id, uid)
      );
      CREATE INDEX idx_room_members_owner_status ON room_members(uid, status, room_id);
      CREATE TABLE local_profiles (uid TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL,
        display_name TEXT NOT NULL, created_at_utc_ms INTEGER NOT NULL);
      PRAGMA user_version = 7;
    `);
    await existing.runAsync(
      `INSERT INTO rooms (room_id, host_uid, pin, status, created_at, updated_at) VALUES (?, ?, ?, 'WAITING', ?, ?)`,
      'legacy-room', 'legacy-host', '0042', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z',
    );
    await existing.runAsync(
      `INSERT INTO room_members (room_id, uid, display_name, role, status, joined_at) VALUES (?, ?, ?, 'HOST', 'ACTIVE', ?)`,
      'legacy-room', 'legacy-host', 'Host', '2026-10-01T00:00:00.000Z',
    );
    await existing.closeAsync();

    const { getLocalDatabase } = await loadDatabaseModule();
    const upgraded = await getLocalDatabase();
    expect(await upgraded.getFirstAsync('SELECT room_id, pin FROM rooms WHERE room_id = ?', 'legacy-room'))
      .toEqual({ room_id: 'legacy-room', pin: '0042' });
    expect(await upgraded.getFirstAsync('SELECT room_id, uid FROM room_members WHERE room_id = ?', 'legacy-room'))
      .toEqual({ room_id: 'legacy-room', uid: 'legacy-host' });
    await upgraded.runAsync(
      `INSERT INTO rooms (room_id, host_uid, pin, status, created_at, updated_at) VALUES (?, ?, ?, 'WAITING', ?, ?)`,
      'new-room', 'new-host', '00000042', '2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z',
    );
    await upgraded.closeAsync();
  });

  test('a sessions migration failure leaves the v1 profile schema and data intact', async () => {
    const currentHarness = harness;
    if (!currentHarness) throw new Error('SQLite test harness was not initialized.');
    currentHarness.failOnSessionsMigration = true;
    const { getLocalDatabase } = await loadDatabaseModule();

    await expect(getLocalDatabase()).rejects.toThrow('Injected sessions migration failure');
    currentHarness.failOnSessionsMigration = false;
    const verificationConnection = currentHarness.open();
    const profileTable = await verificationConnection.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'local_profiles'",
    );
    const sessionsTable = await verificationConnection.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sessions'",
    );
    const version = await verificationConnection.getFirstAsync<{ user_version: number }>('PRAGMA user_version');

    expect(profileTable?.name).toBe('local_profiles');
    expect(sessionsTable).toBeNull();
    expect(version?.user_version).toBe(1);
    await verificationConnection.closeAsync();
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
  expect(await database.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 13 });
});

test('adopts existing profile and session tables if schema version metadata was reset', async () => {
  const first = await loadDatabaseModule();
  const database = await first.getLocalDatabase();
  await database.runAsync("INSERT INTO sessions (id, user_id, mode, status, duration_seconds, started_at) VALUES ('saved-session', 'owner', 'COUNTDOWN', 'ACTIVE', 1500, '2026-10-18T00:00:00Z')");
  await database.execAsync('PRAGMA user_version = 0');
  await database.closeAsync();
  const next = await loadDatabaseModule();
  const reopened = await next.getLocalDatabase();
  expect(await reopened.getFirstAsync('SELECT id FROM sessions')).toEqual({ id: 'saved-session' });
  expect(await reopened.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 13 });
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

test('Premium expiry projection survives reopening and stays scoped to its account', async () => {
  const { getLocalDatabase } = await loadDatabaseModule();
  const database = await getLocalDatabase();
  const { upsertLocalProfile, getLocalProfile } = require('../src/features/auth/local-profile-repository') as typeof import('../src/features/auth/local-profile-repository');
  await upsertLocalProfile(database, { uid: 'premium-cache-owner', email: 'cache@example.test', displayName: 'Cache',
    createdAtUtcMs: 1, isPremium: true, premiumExpiresAtUtcMs: 4102444800000 });
  await database.closeAsync();
  const reopened = await (await loadDatabaseModule()).getLocalDatabase();
  expect(await getLocalProfile(reopened, 'premium-cache-owner')).toMatchObject({ premiumExpiresAtUtcMs: 4102444800000, isPremium: true });
  expect(await getLocalProfile(reopened, 'another-account')).toBeNull();
});
