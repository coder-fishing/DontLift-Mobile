type Repository = { syncPendingCompletedRooms: () => Promise<number> };

export function createCompletedGroupViolationSyncRetry(
  repository: Repository,
  initialDelayMs = 5_000,
  maxDelayMs = 60_000,
) {
  let active = true;
  let online = false;
  let syncing = false;
  let attemptCount = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const schedule = () => {
    if (!active || !online || syncing || timer) return;
    const delay = Math.min(initialDelayMs * (2 ** attemptCount), maxDelayMs);
    attemptCount += 1;
    timer = setTimeout(() => {
      timer = undefined;
      void attempt();
    }, delay);
  };

  const attempt = async () => {
    if (!active || !online || syncing) return;
    syncing = true;
    let hasPending = false;
    try {
      hasPending = await repository.syncPendingCompletedRooms() > 0;
    } catch {
      // Tạm lỗi hoặc Rules chưa cho phép thì giữ retry; outbox vẫn là nguồn bền vững.
      hasPending = true;
    } finally {
      syncing = false;
      if (!active || !online) return;
      if (hasPending) schedule();
      else attemptCount = 0;
    }
  };

  return {
    setOnline(value: boolean) {
      if (!value) {
        online = false;
        clearTimer();
        return;
      }
      const reconnected = !online;
      online = true;
      if (reconnected) {
        attemptCount = 0;
        clearTimer();
        void attempt();
      }
    },
    retryNow() {
      if (!active || !online || syncing) return;
      clearTimer();
      void attempt();
    },
    dispose() {
      active = false;
      clearTimer();
    },
  };
}
