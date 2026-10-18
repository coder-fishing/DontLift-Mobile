import type { SoloSessionSummary } from './summary-service';

export type SoloSessionCompletionInput = {
  userId: string;
  sessionId: string;
  completedAtUtcMs: number;
};

export type SoloSummaryRepositoryPort = {
  complete(input: SoloSessionCompletionInput): Promise<SoloSessionSummary>;
  get(input: { userId: string; sessionId: string }): Promise<SoloSessionSummary | null>;
};

export function createSoloSessionCompletionController(repository: SoloSummaryRepositoryPort) {
  const inFlightCompletions = new Map<string, Promise<SoloSessionSummary>>();

  return {
    complete(input: SoloSessionCompletionInput): Promise<SoloSessionSummary> {
      if (!input.userId.trim() || !input.sessionId.trim()) {
        return Promise.reject(new Error('An account and session are required to complete Solo focus.'));
      }
      if (!Number.isFinite(input.completedAtUtcMs)) {
        return Promise.reject(new Error('Solo completion time must be a valid timestamp.'));
      }

      const existing = inFlightCompletions.get(input.sessionId);
      if (existing) return existing;

      // Chặn hai nút/timer cùng kết thúc một lượt; SQLite vẫn giữ idempotency sau process restart.
      const completion = repository.complete(input).finally(() => {
        if (inFlightCompletions.get(input.sessionId) === completion) {
          inFlightCompletions.delete(input.sessionId);
        }
      });
      inFlightCompletions.set(input.sessionId, completion);
      return completion;
    },
    get(input: { userId: string; sessionId: string }) {
      return repository.get(input);
    },
  };
}
