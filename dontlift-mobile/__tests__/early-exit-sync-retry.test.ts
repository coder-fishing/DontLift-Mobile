import { createEarlyExitSyncRetry } from '../src/features/rooms/early-exit-sync-retry';

describe('early-exit violation sync retry', () => {
  afterEach(() => jest.useRealTimers());

  it('keeps retrying after transient failure until the pending outbox drains', async () => {
    jest.useFakeTimers();
    const syncPending = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error('unavailable'), { code: 'unavailable' }))
      .mockResolvedValue(undefined);
    const getPendingCount = jest.fn().mockResolvedValueOnce(1).mockResolvedValue(0);
    const onPending = jest.fn();
    const onDrained = jest.fn();
    const onRetrying = jest.fn();
    const retry = createEarlyExitSyncRetry('room-id', {
      syncPending, getPendingCount, getFailedCount: jest.fn().mockResolvedValue(0),
    }, {
      onPending, onDrained, onRetrying, onReconciliation: jest.fn(),
    }, 5_000);

    await retry.setOnline(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(onRetrying).toHaveBeenCalledTimes(1);
    expect(onDrained).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(5_000);
    expect(syncPending).toHaveBeenCalledTimes(2);
    expect(onPending).toHaveBeenCalledWith(1);
    expect(onDrained).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(5_000);
    expect(syncPending).toHaveBeenCalledTimes(3);
    expect(onDrained).toHaveBeenCalledWith(0);

    await jest.advanceTimersByTimeAsync(15_000);
    expect(syncPending).toHaveBeenCalledTimes(3);
    retry.dispose();
  });

  it('does not sync while offline and hands terminal-room events to reconciliation', async () => {
    jest.useFakeTimers();
    const syncPending = jest.fn().mockRejectedValue(Object.assign(new Error('failed-precondition'), { code: 'failed-precondition' }));
    const onReconciliation = jest.fn();
    const retry = createEarlyExitSyncRetry('room-id', {
      syncPending, getPendingCount: jest.fn(), getFailedCount: jest.fn(),
    }, {
      onPending: jest.fn(), onDrained: jest.fn(), onRetrying: jest.fn(), onReconciliation,
    }, 5_000);

    await jest.advanceTimersByTimeAsync(10_000);
    expect(syncPending).not.toHaveBeenCalled();
    retry.setOnline(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(onReconciliation).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(syncPending).toHaveBeenCalledTimes(1);
    retry.dispose();
  });
});
