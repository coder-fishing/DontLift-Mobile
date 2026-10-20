type Callbacks = {
  onComplete: () => void;
  onRetrying: () => void;
};

export function createEarlyExitCleanupRetry(
  cleanup: () => Promise<void>,
  callbacks: Callbacks,
  initialDelayMs = 5_000,
  maxDelayMs = 60_000,
) {
  let active = true;
  let running = false;
  let complete = false;
  let attemptCount = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const attempt = async () => {
    if (!active || running || complete) return;
    running = true;
    try {
      await cleanup();
      if (!active) return;
      complete = true;
      callbacks.onComplete();
    } catch {
      if (!active) return;
      attemptCount += 1;
      callbacks.onRetrying();
      const delay = Math.min(initialDelayMs * (2 ** (attemptCount - 1)), maxDelayMs);
      timer = setTimeout(() => { timer = undefined; void attempt(); }, delay);
    } finally {
      running = false;
    }
  };

  return {
    start() { void attempt(); },
    retryNow() {
      if (!active || running || complete) return;
      if (timer) clearTimeout(timer);
      timer = undefined;
      void attempt();
    },
    dispose() {
      active = false;
      if (timer) clearTimeout(timer);
    },
  };
}
