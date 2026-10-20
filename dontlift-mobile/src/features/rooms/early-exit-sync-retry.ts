type Repository = {
  syncPending(roomId: string): Promise<void>;
  getPendingCount(roomId: string): Promise<number>;
  getFailedCount(roomId: string): Promise<number>;
};

type Callbacks = {
  onPending: (count: number) => void;
  onDrained: (failedCount: number) => void;
  onReconciliation: () => void;
  onRetrying: () => void;
};

export function createEarlyExitSyncRetry(
  roomId: string,
  repository: Repository,
  callbacks: Callbacks,
  intervalMs = 5_000,
) {
  let active = true;
  let online = false;
  let syncing = false;
  let settled = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const settle = () => {
    settled = true;
    if (timer) clearInterval(timer);
  };

  const attempt = async () => {
    if (!active || !online || syncing || settled) return;
    syncing = true;
    try {
      await repository.syncPending(roomId);
      const [pending, failed] = await Promise.all([
        repository.getPendingCount(roomId), repository.getFailedCount(roomId),
      ]);
      if (!active) return;
      if (pending === 0) {
        settle();
        callbacks.onDrained(failed);
      } else {
        callbacks.onPending(pending);
      }
    } catch (error) {
      if (!active) return;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'failed-precondition') {
        // Room kết thúc trong lúc retry; SL-020 nhận các event còn chờ để reconciliation.
        settle();
        callbacks.onReconciliation();
      } else {
        callbacks.onRetrying();
      }
    } finally {
      syncing = false;
    }
  };

  timer = setInterval(() => { void attempt(); }, intervalMs);
  return {
    setOnline(value: boolean) {
      online = value;
      if (online) void attempt();
    },
    dispose() {
      active = false;
      if (timer) clearInterval(timer);
    },
  };
}
