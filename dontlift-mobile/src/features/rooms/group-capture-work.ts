export function createGroupCaptureWorkTracker() {
  const pending = new Set<Promise<unknown>>();

  return {
    track<T>(work: Promise<T>): Promise<T> {
      pending.add(work);
      void work.then(
        () => pending.delete(work),
        () => pending.delete(work),
      );
      return work;
    },
    async waitForIdle(): Promise<void> {
      // Công việc đang chạy có thể thêm recovery/capture work khác trước khi hoàn tất.
      while (pending.size > 0) await Promise.allSettled([...pending]);
    },
  };
}
