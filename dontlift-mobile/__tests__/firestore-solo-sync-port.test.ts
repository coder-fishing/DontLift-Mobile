import { digestStringAsync } from 'expo-crypto';
import { doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { createFirestoreSoloSyncPort } from '../src/features/sync/firestore-solo-sync-port';
import type { SoloSyncWireEvent } from '../src/features/sync/sync-worker';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => value === 'different' ? 'b'.repeat(64) : 'a'.repeat(64)),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_firestore: unknown, ...path: string[]) => ({ path: path.join('/') })),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-timestamp'),
  Timestamp: { fromMillis: jest.fn((milliseconds: number) => ({ milliseconds })) },
}));

const event: SoloSyncWireEvent = {
  eventId: '550e8400-e29b-41d4-a716-446655440000',
  eventType: 'SOLO_SESSION_COMPLETED',
  schemaVersion: 1,
  aggregateType: 'SOLO_SESSION',
  aggregateId: '550e8400-e29b-41d4-a716-446655440000',
  sessionId: '550e8400-e29b-41d4-a716-446655440000',
  occurredAtUtcMs: 100_000,
  payload: {
    durationSeconds: 90,
    liftCount: 1,
    violationDurationSeconds: 8,
    penaltyScore: 18,
    startedAtUtcMs: 10_000,
    completedAtUtcMs: 100_000,
  },
};

function setup(options: { currentUid?: string | null; exists?: boolean; payloadHash?: string } = {}) {
  const transaction = {
    get: jest.fn(async () => ({
      exists: () => options.exists ?? false,
      data: () => ({ payloadHash: options.payloadHash }),
    })),
    set: jest.fn(),
  };
  (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => callback(transaction));
  const auth = { currentUser: options.currentUid === undefined ? { uid: 'owner-1' } : options.currentUid ? { uid: options.currentUid } : null };
  const port = createFirestoreSoloSyncPort({
    firestore: {} as never,
    auth: auth as never,
    userId: 'owner-1',
    now: () => 123_000,
  });
  return { auth, port, transaction };
}

describe('direct Firestore Solo sync port', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates the owner summary transactionally with the legacy canonical hash', async () => {
    const { port, transaction } = setup();
    const response = await port.sendBatch([event]);

    expect(doc).toHaveBeenCalledWith({}, 'users', 'owner-1', 'sessions', event.sessionId);
    expect(digestStringAsync).toHaveBeenCalledWith('SHA-256', JSON.stringify({
      eventId: event.eventId,
      eventType: event.eventType,
      schemaVersion: event.schemaVersion,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      sessionId: event.sessionId,
      occurredAtUtcMs: event.occurredAtUtcMs,
      payload: event.payload,
    }));
    expect(transaction.set).toHaveBeenCalledWith(
      { path: `users/owner-1/sessions/${event.sessionId}` },
      expect.objectContaining({
        durationSeconds: 90,
        liftCount: 1,
        violationDurationSeconds: 8,
        penaltyScore: 18,
        startedAt: { milliseconds: 10_000 },
        completedAt: { milliseconds: 100_000 },
        payloadHash: 'a'.repeat(64),
        createdAt: 'server-timestamp',
      }),
    );
    expect(Timestamp.fromMillis).toHaveBeenCalledTimes(2);
    expect(serverTimestamp).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      version: 1,
      serverTimeUtcMs: 123_000,
      outcomes: [{ eventId: event.eventId, status: 'SYNCED', destinationRef: `users/owner-1/sessions/${event.sessionId}` }],
    });
  });

  test('treats an existing identical summary as synced without another write', async () => {
    const { port, transaction } = setup({ exists: true, payloadHash: 'a'.repeat(64) });
    const response = await port.sendBatch([event]);

    expect(transaction.set).not.toHaveBeenCalled();
    expect(response.outcomes[0]).toMatchObject({ status: 'SYNCED' });
  });

  test('rejects an existing conflicting summary without overwriting it', async () => {
    const { port, transaction } = setup({ exists: true, payloadHash: 'x'.repeat(64) });
    const response = await port.sendBatch([event]);

    expect(transaction.set).not.toHaveBeenCalled();
    expect(response.outcomes[0]).toMatchObject({ status: 'FAILED', retryable: false, errorCode: 'already-exists' });
  });

  test('returns outcomes per event when one summary conflicts', async () => {
    const conflictingId = '550e8400-e29b-41d4-a716-446655440001';
    const conflictingEvent = { ...event, eventId: conflictingId, sessionId: conflictingId, aggregateId: conflictingId };
    const { port } = setup();
    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => callback({
      get: async (reference: { path: string }) => ({
        exists: () => reference.path.endsWith(conflictingId),
        data: () => ({ payloadHash: 'different-hash' }),
      }),
      set: jest.fn(),
    }));
    const response = await port.sendBatch([event, conflictingEvent]);

    expect(response.outcomes).toEqual([
      expect.objectContaining({ eventId: event.eventId, status: 'SYNCED' }),
      expect.objectContaining({ eventId: conflictingId, status: 'FAILED', errorCode: 'already-exists' }),
    ]);
  });

  test('does not touch Firestore when auth is absent or belongs to another user', async () => {
    for (const currentUid of [null, 'other-user']) {
      const { port, transaction } = setup({ currentUid });
      const response = await port.sendBatch([event]);
      expect(runTransaction).not.toHaveBeenCalled();
      expect(transaction.set).not.toHaveBeenCalled();
      expect(response.outcomes[0]).toMatchObject({ status: 'FAILED', retryable: true, errorCode: 'unauthenticated' });
      jest.clearAllMocks();
    }
  });

  test('does not start the transaction if auth changes while hashing the event', async () => {
    const { auth, port, transaction } = setup();
    (digestStringAsync as jest.Mock).mockImplementationOnce(async () => {
      auth.currentUser = { uid: 'other-user' };
      return 'a'.repeat(64);
    });

    const response = await port.sendBatch([event]);
    expect(runTransaction).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
    expect(response.outcomes[0]).toMatchObject({ status: 'FAILED', retryable: true, errorCode: 'unauthenticated' });
  });

  test.each([
    ['not-found', false],
    ['permission-denied', false],
    ['unavailable', true],
    ['deadline-exceeded', true],
    ['aborted', true],
    ['resource-exhausted', true],
  ])('maps %s to retryable=%s per event', async (code, retryable) => {
    const { port } = setup();
    (runTransaction as jest.Mock).mockRejectedValueOnce({ code: `firestore/${code}` });
    const response = await port.sendBatch([event]);
    expect(response.outcomes[0]).toMatchObject({ status: 'FAILED', retryable, errorCode: code });
  });
});
