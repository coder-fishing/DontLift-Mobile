export type SoloSyncEvent = {
  eventId: string;
  sessionId: string;
  aggregateId: string;
  occurredAtUtcMs: number;
  payload: {
    durationSeconds: number;
    liftCount: number;
    violationDurationSeconds: number;
    penaltyScore: number;
    startedAtUtcMs: number;
    completedAtUtcMs: number;
  };
  attemptCount: number;
  createdAt: string;
};

export type SoloSyncOutcome = {
  eventId: string;
  status: 'SYNCED' | 'FAILED';
  retryable: boolean;
  errorCode?: string;
  destinationRef?: string;
};

type SyncWorkerRepository = {
  claimBatch(input: {
    userId: string;
    nowUtcMs: number;
    leaseExpiresAtUtcMs: number;
    limit: number;
    ignoreBackoff?: boolean;
  }): Promise<SoloSyncEvent[]>;
  markSynced(input: { userId: string; eventId: string; syncedAtUtcMs: number }): Promise<void>;
  markFailed(input: { userId: string; eventId: string; errorCode: string }): Promise<void>;
  scheduleRetry(input: {
    userId: string;
    eventId: string;
    nextAttemptAtUtcMs: number;
    errorCode: string;
  }): Promise<void>;
  releaseLease(input: { userId: string; eventId: string }): Promise<void>;
  getStatus(input: { userId: string; sessionId: string }): Promise<'pending' | 'synced' | 'failed' | 'unknown'>;
};

export type SoloSyncWireEvent = {
  eventId: string;
  eventType: 'SOLO_SESSION_COMPLETED';
  schemaVersion: 1;
  aggregateType: 'SOLO_SESSION';
  aggregateId: string;
  sessionId: string;
  occurredAtUtcMs: number;
  payload: SoloSyncEvent['payload'];
};

export type SyncWorkerTransport = {
  sendBatch(events: SoloSyncWireEvent[]): Promise<{
    version: 1;
    serverTimeUtcMs: number;
    outcomes: SoloSyncOutcome[];
  }>;
};

type SyncWorkerDependencies = {
  userId: string;
  getCurrentUserId: () => string | null;
  repository: SyncWorkerRepository;
  transport: SyncWorkerTransport;
  now?: () => number;
  random?: () => number;
  onStatusChange?: (sessionId: string, status: 'syncing' | 'pending' | 'synced' | 'failed') => void;
};

const MAX_BATCH_SIZE = 20;
const LEASE_DURATION_MS = 90_000;
const BASE_RETRY_DELAY_MS = 15_000;
const MAX_RETRY_DELAY_MS = 6 * 60 * 60 * 1_000;

function normalizeCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error) || typeof error.code !== 'string') {
    return 'unavailable';
  }
  return error.code.replace(/^(functions|firestore)\//, '').slice(0, 80);
}

function isAuthFailure(error: unknown): boolean {
  return normalizeCode(error) === 'unauthenticated';
}

function isRequestPermanent(error: unknown): boolean {
  return ['invalid-argument', 'permission-denied', 'failed-precondition', 'not-found', 'already-exists'].includes(normalizeCode(error));
}

export function createSoloSyncWorker(dependencies: SyncWorkerDependencies) {
  const now = dependencies.now ?? Date.now;
  const random = dependencies.random ?? Math.random;
  let disposed = false;
  let currentRun: Promise<void> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const emit = (sessionId: string, status: 'syncing' | 'pending' | 'synced' | 'failed') => {
    dependencies.onStatusChange?.(sessionId, status);
  };

  const scheduleRetryTimer = (delayMs: number) => {
    if (disposed) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void kick();
    }, Math.max(0, delayMs));
  };

  const retryDelay = (attemptCount: number) => {
    const exponential = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * (2 ** Math.min(attemptCount, 10)));
    // Jitter voorkomt dat veel clients na een storing tegelijk dezelfde batch sturen.
    return Math.floor(exponential * (0.5 + Math.min(1, Math.max(0, random()))));
  };

  const send = async (events: SoloSyncEvent[]): Promise<void> => {
    if (events.length === 0) return;
    if (disposed || dependencies.getCurrentUserId() !== dependencies.userId) {
      await Promise.all(events.map((event) => dependencies.repository.releaseLease({
        userId: dependencies.userId, eventId: event.eventId,
      })));
      return;
    }

    events.forEach((event) => emit(event.sessionId, 'syncing'));
    let response: Awaited<ReturnType<SyncWorkerTransport['sendBatch']>>;
    try {
      response = await dependencies.transport.sendBatch(events.map((event): SoloSyncWireEvent => ({
        eventId: event.eventId,
        eventType: 'SOLO_SESSION_COMPLETED',
        schemaVersion: 1,
        aggregateType: 'SOLO_SESSION',
        aggregateId: event.aggregateId,
        sessionId: event.sessionId,
        occurredAtUtcMs: event.occurredAtUtcMs,
        payload: event.payload,
      })));
    } catch (error) {
      if (isAuthFailure(error) || disposed || dependencies.getCurrentUserId() !== dependencies.userId) {
        await Promise.all(events.map((event) => dependencies.repository.releaseLease({
          userId: dependencies.userId, eventId: event.eventId,
        })));
        return;
      }
      if (normalizeCode(error) === 'resource-exhausted' && events.length > 1) {
        const midpoint = Math.ceil(events.length / 2);
        await send(events.slice(0, midpoint));
        await send(events.slice(midpoint));
        return;
      }
      const code = normalizeCode(error);
      for (const event of events) {
        if (isRequestPermanent(error)) {
          await dependencies.repository.markFailed({ userId: dependencies.userId, eventId: event.eventId, errorCode: code });
          emit(event.sessionId, 'failed');
        } else {
          const delay = retryDelay(event.attemptCount);
          await dependencies.repository.scheduleRetry({
            userId: dependencies.userId,
            eventId: event.eventId,
            nextAttemptAtUtcMs: now() + delay,
            errorCode: code,
          });
          emit(event.sessionId, 'pending');
          scheduleRetryTimer(delay);
        }
      }
      return;
    }

    if (disposed || dependencies.getCurrentUserId() !== dependencies.userId) {
      await Promise.all(events.map((event) => dependencies.repository.releaseLease({
        userId: dependencies.userId, eventId: event.eventId,
      })));
      return;
    }

    const outcomeById = new Map<string, SoloSyncOutcome>();
    for (const outcome of response.outcomes) {
      if (!outcomeById.has(outcome.eventId)) outcomeById.set(outcome.eventId, outcome);
    }
    for (const event of events) {
      const outcome = outcomeById.get(event.eventId);
      if (!outcome) {
        const delay = retryDelay(event.attemptCount);
        await dependencies.repository.scheduleRetry({
          userId: dependencies.userId,
          eventId: event.eventId,
          nextAttemptAtUtcMs: now() + delay,
          errorCode: 'missing-outcome',
        });
        emit(event.sessionId, 'pending');
        scheduleRetryTimer(delay);
      } else if (outcome.status === 'SYNCED') {
        await dependencies.repository.markSynced({
          userId: dependencies.userId, eventId: event.eventId, syncedAtUtcMs: now(),
        });
        emit(event.sessionId, 'synced');
      } else if (outcome.retryable) {
        const delay = retryDelay(event.attemptCount);
        await dependencies.repository.scheduleRetry({
          userId: dependencies.userId,
          eventId: event.eventId,
          nextAttemptAtUtcMs: now() + delay,
          errorCode: outcome.errorCode ?? 'retryable-failure',
        });
        emit(event.sessionId, 'pending');
        scheduleRetryTimer(delay);
      } else {
        await dependencies.repository.markFailed({
          userId: dependencies.userId,
          eventId: event.eventId,
          errorCode: outcome.errorCode ?? 'permanent-failure',
        });
        emit(event.sessionId, 'failed');
      }
    }
  };

  const run = async (options: { ignoreBackoff?: boolean; sessionId?: string } = {}) => {
    if (disposed) return;
    if (dependencies.getCurrentUserId() !== dependencies.userId) return;
    const events = await dependencies.repository.claimBatch({
      userId: dependencies.userId,
      nowUtcMs: now(),
      leaseExpiresAtUtcMs: now() + LEASE_DURATION_MS,
      limit: MAX_BATCH_SIZE,
      ignoreBackoff: options.ignoreBackoff,
    });
    await send(events);
    if (options.sessionId && !disposed && dependencies.getCurrentUserId() === dependencies.userId) {
      const status = await dependencies.repository.getStatus({ userId: dependencies.userId, sessionId: options.sessionId });
      if (status !== 'unknown') emit(options.sessionId, status);
    }
  };

  function kick(options: { ignoreBackoff?: boolean; sessionId?: string } = {}): Promise<void> {
    if (currentRun) return currentRun;
    currentRun = run(options).finally(() => { currentRun = null; });
    return currentRun;
  }

  return {
    kick,
    dispose() {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = undefined;
    },
  };
}
