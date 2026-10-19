import { createSoloSyncWorker, type SoloSyncEvent, type SoloSyncOutcome, type SyncWorkerTransport } from '../src/features/sync/sync-worker';

const event: SoloSyncEvent = {
  eventId: '550e8400-e29b-41d4-a716-446655440000',
  sessionId: '550e8400-e29b-41d4-a716-446655440000',
  aggregateId: '550e8400-e29b-41d4-a716-446655440000',
  occurredAtUtcMs: 100_000,
  payload: {
    durationSeconds: 90,
    liftCount: 1,
    violationDurationSeconds: 8,
    penaltyScore: 18,
    startedAtUtcMs: 10_000,
    completedAtUtcMs: 100_000,
  },
  attemptCount: 0,
  createdAt: '1970-01-01T00:01:40.000Z',
};

function setup(overrides: Record<string, unknown> = {}) {
  const repository = {
    claimBatch: jest.fn(async () => [event]),
    markSynced: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
    scheduleRetry: jest.fn(async () => undefined),
    releaseLease: jest.fn(async () => undefined),
    getStatus: jest.fn(async () => 'pending' as const),
  };
  const sendBatch = jest.fn<
    ReturnType<SyncWorkerTransport['sendBatch']>,
    Parameters<SyncWorkerTransport['sendBatch']>
  >(async () => ({
    version: 1 as const,
    serverTimeUtcMs: 101_000,
    outcomes: [{ eventId: event.eventId, status: 'SYNCED', retryable: false } satisfies SoloSyncOutcome],
  }));
  const transport: SyncWorkerTransport = { sendBatch };
  const worker = createSoloSyncWorker({
    userId: 'user-1',
    getCurrentUserId: () => 'user-1',
    repository,
    transport,
    now: () => 102_000,
    random: () => 0.5,
    ...overrides,
  });
  return { repository, transport, sendBatch, worker };
}

describe('Solo sync worker', () => {
  test('sends completed Solo summaries and applies each server acknowledgement', async () => {
    const { repository, transport, worker } = setup();
    await worker.kick();

    expect(transport.sendBatch).toHaveBeenCalledWith([expect.objectContaining({
      eventId: event.eventId,
      eventType: 'SOLO_SESSION_COMPLETED',
      schemaVersion: 1,
      aggregateType: 'SOLO_SESSION',
      aggregateId: event.sessionId,
      sessionId: event.sessionId,
      occurredAtUtcMs: event.occurredAtUtcMs,
      payload: event.payload,
    })]);
    expect(repository.markSynced).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', eventId: event.eventId, syncedAtUtcMs: 102_000,
    }));
    worker.dispose();
  });

  test('keeps transient failures pending with a future retry time', async () => {
    const { repository, sendBatch, worker } = setup();
    sendBatch.mockRejectedValueOnce({ code: 'functions/unavailable' });
    await worker.kick();

    expect(repository.scheduleRetry).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', eventId: event.eventId, nextAttemptAtUtcMs: expect.any(Number),
    }));
    expect(repository.markFailed).not.toHaveBeenCalled();
    worker.dispose();
  });

  test('marks permanent per-event failures and continues applying other outcomes', async () => {
    const secondEvent = { ...event, eventId: '550e8400-e29b-41d4-a716-446655440001', sessionId: '550e8400-e29b-41d4-a716-446655440001', aggregateId: '550e8400-e29b-41d4-a716-446655440001' };
    const { repository, sendBatch, worker } = setup();
    repository.claimBatch.mockResolvedValueOnce([event, secondEvent]);
    sendBatch.mockResolvedValueOnce({
      version: 1 as const,
      serverTimeUtcMs: 101_000,
      outcomes: [
        { eventId: event.eventId, status: 'SYNCED', retryable: false } satisfies SoloSyncOutcome,
        { eventId: secondEvent.eventId, status: 'FAILED', retryable: false, errorCode: 'invalid-argument' } satisfies SoloSyncOutcome,
      ],
    });
    await worker.kick();

    expect(repository.markSynced).toHaveBeenCalledTimes(1);
    expect(repository.markFailed).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', eventId: secondEvent.eventId, errorCode: 'invalid-argument',
    }));
    worker.dispose();
  });

  test('does not apply a delayed acknowledgement after the active account changes', async () => {
    let activeUser = 'user-1';
    const { repository, sendBatch, worker } = setup({ getCurrentUserId: () => activeUser });
    sendBatch.mockImplementationOnce(async () => {
      activeUser = 'user-2';
      return { version: 1, serverTimeUtcMs: 101_000, outcomes: [{ eventId: event.eventId, status: 'SYNCED', retryable: false }] };
    });
    await worker.kick();

    expect(repository.markSynced).not.toHaveBeenCalled();
    expect(repository.releaseLease).toHaveBeenCalledWith({ userId: 'user-1', eventId: event.eventId });
    worker.dispose();
  });
});
