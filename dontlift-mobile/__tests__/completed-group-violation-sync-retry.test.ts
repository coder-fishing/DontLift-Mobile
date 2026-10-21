import { createCompletedGroupViolationSyncRetry } from '../src/features/rooms/completed-group-violation-sync-retry';

describe('completed group violation sync retry', () => {
  afterEach(() => jest.useRealTimers());

  it('keeps retrying after screen navigation until completed-room events drain', async () => {
    jest.useFakeTimers();
    const syncPendingCompletedRooms = jest.fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    const retry = createCompletedGroupViolationSyncRetry({ syncPendingCompletedRooms }, 5_000, 20_000);

    retry.setOnline(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(syncPendingCompletedRooms).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5_000);
    expect(syncPendingCompletedRooms).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(20_000);
    expect(syncPendingCompletedRooms).toHaveBeenCalledTimes(2);
    retry.dispose();
  });

  it('retries a failed pass when connectivity returns before the backoff expires', async () => {
    jest.useFakeTimers();
    const syncPendingCompletedRooms = jest.fn()
      .mockRejectedValueOnce(new Error('temporary Firestore error'))
      .mockResolvedValueOnce(0);
    const retry = createCompletedGroupViolationSyncRetry({ syncPendingCompletedRooms }, 30_000, 60_000);

    retry.setOnline(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(syncPendingCompletedRooms).toHaveBeenCalledTimes(1);

    retry.setOnline(false);
    retry.setOnline(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(syncPendingCompletedRooms).toHaveBeenCalledTimes(2);
    retry.dispose();
  });
});
