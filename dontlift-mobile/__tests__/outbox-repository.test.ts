import { createOutboxSyncRepository } from '../src/features/sync/outbox-repository';

function createDatabase() {
  const transaction = {
    getAllAsync: jest.fn(async (_sql: string, ..._params: unknown[]) => []),
    runAsync: jest.fn(async (_sql: string, ..._params: unknown[]) => ({ changes: 0 })),
  };
  const database = {
    runAsync: jest.fn(async (_sql: string, ..._params: unknown[]) => ({ changes: 0 })),
    withExclusiveTransactionAsync: jest.fn(async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction)),
    getFirstAsync: jest.fn(async () => null),
  };
  return { database, transaction };
}

describe('Solo outbox retry repository', () => {
  test('requeues only the matching owner/session failed Solo event without resetting attempts or payload', async () => {
    const { database } = createDatabase();
    database.runAsync.mockResolvedValueOnce({ changes: 1 });
    const repository = createOutboxSyncRepository(database as never);

    await expect(repository.requeueFailedForSession({ userId: 'owner-a', sessionId: 'session-a' })).resolves.toBe(true);

    const [sql, ...params] = database.runAsync.mock.calls[0];
    expect(sql).toContain("SET sync_status = 'PENDING'");
    expect(sql).toContain("event_type = 'SOLO_SESSION_COMPLETED'");
    expect(sql).toContain("sync_status = 'FAILED'");
    expect(sql).toContain('actor_uid = ? AND session_id = ?');
    expect(sql).not.toContain('attempt_count =');
    expect(sql).not.toContain('payload_json =');
    expect(params).toEqual(['owner-a', 'session-a']);
  });

  test('returns false when no failed row matched', async () => {
    const { database } = createDatabase();
    const repository = createOutboxSyncRepository(database as never);

    await expect(repository.requeueFailedForSession({ userId: 'owner-a', sessionId: 'missing' })).resolves.toBe(false);
  });

  test('claims only the requested session during an explicit retry', async () => {
    const { database, transaction } = createDatabase();
    const repository = createOutboxSyncRepository(database as never);

    await repository.claimBatch({
      userId: 'owner-a', nowUtcMs: 100, leaseExpiresAtUtcMs: 200, limit: 20,
      ignoreBackoff: true, sessionId: 'session-a',
    });

    const [sql, ...params] = transaction.getAllAsync.mock.calls[0];
    expect(sql).toContain('AND (? IS NULL OR session_id = ?)');
    expect(params.slice(0, 3)).toEqual(['owner-a', 'session-a', 'session-a']);
  });
});
