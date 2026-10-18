import type * as SQLite from 'expo-sqlite';

type LocalMigration = {
  version: number;
  migrate: (database: SQLite.SQLiteDatabase) => Promise<void>;
};


type ExpectedColumn = { type: 'TEXT' | 'INTEGER'; notnull: number; pk: number };

async function validateExistingSchema(
  database: SQLite.SQLiteDatabase,
  table: 'local_profiles' | 'sessions' | 'violation_logs' | 'sync_outbox',
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
  {
    version: 2,
    migrate: async (database) => {
      await database.execAsync(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        mode TEXT CHECK(mode IN ('COUNTDOWN', 'STOPWATCH', 'GROUP')) NOT NULL,
        status TEXT CHECK(status IN ('CREATED', 'ACTIVE', 'COMPLETED', 'CANCELLED')) NOT NULL,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        synced_at TEXT
      );

    `);
      await validateExistingSchema(database, 'sessions', {
        id: { type: 'TEXT', notnull: 1, pk: 1 },
        user_id: { type: 'TEXT', notnull: 1, pk: 0 },
        mode: { type: 'TEXT', notnull: 1, pk: 0 },
        status: { type: 'TEXT', notnull: 1, pk: 0 },
        duration_seconds: { type: 'INTEGER', notnull: 1, pk: 0 },
        started_at: { type: 'TEXT', notnull: 1, pk: 0 },
        completed_at: { type: 'TEXT', notnull: 0, pk: 0 },
        synced_at: { type: 'TEXT', notnull: 0, pk: 0 },
      });
      await database.execAsync(`
      -- Mỗi tài khoản chỉ có một session Solo đang chạy để lần Start sau có thể tiếp tục đúng session.
      CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_solo_session_per_user
        ON sessions(user_id)
        WHERE mode IN ('COUNTDOWN', 'STOPWATCH') AND status = 'ACTIVE';
    `);
    },
  },
  {
    version: 3,
    migrate: async (database) => {
      await database.execAsync(`
      CREATE TABLE IF NOT EXISTS violation_logs (
        event_id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL,
        room_id TEXT,
        user_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK(duration_seconds >= 0),
        sync_status TEXT NOT NULL CHECK(sync_status IN ('PENDING', 'SYNCED', 'FAILED')),
        created_at TEXT NOT NULL,
        synced_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_outbox (
        event_id TEXT PRIMARY KEY NOT NULL,
        event_type TEXT NOT NULL CHECK(event_type IN ('VIOLATION_RECORDED', 'SOLO_SESSION_COMPLETED', 'GROUP_SESSION_LOCAL_SUMMARY')),
        schema_version INTEGER NOT NULL CHECK(schema_version > 0),
        aggregate_type TEXT NOT NULL CHECK(aggregate_type IN ('SOLO_SESSION', 'GROUP_SESSION', 'ROOM')),
        aggregate_id TEXT NOT NULL,
        session_id TEXT,
        actor_uid TEXT NOT NULL,
        occurred_at_utc_ms INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        sync_status TEXT NOT NULL CHECK(sync_status IN ('PENDING', 'SYNCED', 'FAILED')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
        next_attempt_at INTEGER,
        lease_expires_at INTEGER,
        last_error_code TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_violation_logs_session_started
        ON violation_logs(session_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending_order
        ON sync_outbox(sync_status, occurred_at_utc_ms, aggregate_id);
    `);
      await validateExistingSchema(database, 'violation_logs', {
        event_id: { type: 'TEXT', notnull: 1, pk: 1 },
        session_id: { type: 'TEXT', notnull: 1, pk: 0 },
        room_id: { type: 'TEXT', notnull: 0, pk: 0 },
        user_id: { type: 'TEXT', notnull: 1, pk: 0 },
        started_at: { type: 'TEXT', notnull: 1, pk: 0 },
        ended_at: { type: 'TEXT', notnull: 0, pk: 0 },
        duration_seconds: { type: 'INTEGER', notnull: 1, pk: 0 },
        sync_status: { type: 'TEXT', notnull: 1, pk: 0 },
        created_at: { type: 'TEXT', notnull: 1, pk: 0 },
        synced_at: { type: 'TEXT', notnull: 0, pk: 0 },
      });
      await validateExistingSchema(database, 'sync_outbox', {
        event_id: { type: 'TEXT', notnull: 1, pk: 1 },
        event_type: { type: 'TEXT', notnull: 1, pk: 0 },
        schema_version: { type: 'INTEGER', notnull: 1, pk: 0 },
        aggregate_type: { type: 'TEXT', notnull: 1, pk: 0 },
        aggregate_id: { type: 'TEXT', notnull: 1, pk: 0 },
        session_id: { type: 'TEXT', notnull: 0, pk: 0 },
        actor_uid: { type: 'TEXT', notnull: 1, pk: 0 },
        occurred_at_utc_ms: { type: 'INTEGER', notnull: 1, pk: 0 },
        payload_json: { type: 'TEXT', notnull: 1, pk: 0 },
        sync_status: { type: 'TEXT', notnull: 1, pk: 0 },
        attempt_count: { type: 'INTEGER', notnull: 1, pk: 0 },
        next_attempt_at: { type: 'INTEGER', notnull: 0, pk: 0 },
        lease_expires_at: { type: 'INTEGER', notnull: 0, pk: 0 },
        last_error_code: { type: 'TEXT', notnull: 0, pk: 0 },
        created_at: { type: 'TEXT', notnull: 1, pk: 0 },
        synced_at: { type: 'TEXT', notnull: 0, pk: 0 },
      });
    },
  },
  {
    version: 4,
    migrate: async (database) => {
      // Lưu riêng mốc xác nhận của cảm biến; created_at vẫn giữ nghĩa thời điểm ghi SQLite.
      await database.execAsync('ALTER TABLE violation_logs ADD COLUMN confirmed_at TEXT');
      await database.execAsync(`
        UPDATE violation_logs SET confirmed_at = created_at WHERE confirmed_at IS NULL;
      `);
      await validateExistingSchema(database, 'violation_logs', {
        event_id: { type: 'TEXT', notnull: 1, pk: 1 },
        session_id: { type: 'TEXT', notnull: 1, pk: 0 },
        room_id: { type: 'TEXT', notnull: 0, pk: 0 },
        user_id: { type: 'TEXT', notnull: 1, pk: 0 },
        started_at: { type: 'TEXT', notnull: 1, pk: 0 },
        ended_at: { type: 'TEXT', notnull: 0, pk: 0 },
        duration_seconds: { type: 'INTEGER', notnull: 1, pk: 0 },
        sync_status: { type: 'TEXT', notnull: 1, pk: 0 },
        created_at: { type: 'TEXT', notnull: 1, pk: 0 },
        synced_at: { type: 'TEXT', notnull: 0, pk: 0 },
        confirmed_at: { type: 'TEXT', notnull: 0, pk: 0 },
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
