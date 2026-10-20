import { createEarlyExitCleanupRetry } from '../src/features/rooms/early-exit-cleanup-retry';

describe('early-exit local cleanup retry', () => {
  afterEach(() => jest.useRealTimers());

  it('retries a transient cleanup failure and completes once', async () => {
    jest.useFakeTimers();
    const cleanup = jest.fn()
      .mockRejectedValueOnce(new Error('temporary SQLite failure'))
      .mockResolvedValue(undefined);
    const onComplete = jest.fn();
    const onRetrying = jest.fn();
    const retry = createEarlyExitCleanupRetry(cleanup, { onComplete, onRetrying }, 5_000);

    retry.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(onRetrying).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(5_000);
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalledTimes(1);

    retry.retryNow();
    await jest.advanceTimersByTimeAsync(0);
    expect(cleanup).toHaveBeenCalledTimes(2);
    retry.dispose();
  });

  it('lets a reconnect trigger the retry before the backoff expires', async () => {
    jest.useFakeTimers();
    const cleanup = jest.fn()
      .mockRejectedValueOnce(new Error('temporary SQLite failure'))
      .mockResolvedValue(undefined);
    const retry = createEarlyExitCleanupRetry(cleanup, { onComplete: jest.fn(), onRetrying: jest.fn() }, 30_000);

    retry.start();
    await jest.advanceTimersByTimeAsync(0);
    retry.retryNow();
    await jest.advanceTimersByTimeAsync(0);
    expect(cleanup).toHaveBeenCalledTimes(2);
    retry.dispose();
  });
});
