import { upsertLocalProfile } from '../src/features/auth/local-profile-repository';

const profile = { uid: 'owner', email: 'a@example.test', displayName: 'A', isPremium: false, createdAtUtcMs: 1 };

test('serializes overlapping profile writes without opening exclusive transactions', async () => {
  let active = 0;
  let maximum = 0;
  const runAsync = jest.fn(async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active -= 1;
  });
  const exclusive = jest.fn();
  const database = { runAsync, withExclusiveTransactionAsync: exclusive } as never;
  await Promise.all([upsertLocalProfile(database, profile), upsertLocalProfile(database, { ...profile, displayName: 'B' })]);
  expect(maximum).toBe(1);
  expect(runAsync.mock.calls).toHaveLength(2);
  expect(exclusive).not.toHaveBeenCalled();
});

test('retries temporary SQLite contention and lets later writes recover after an error', async () => {
  const runAsync = jest.fn().mockRejectedValueOnce(new Error('Error code 5: database is locked')).mockResolvedValue(undefined);
  const database = { runAsync } as never;
  await upsertLocalProfile(database, profile);
  expect(runAsync).toHaveBeenCalledTimes(2);
  runAsync.mockRejectedValueOnce(new Error('disk full'));
  await expect(upsertLocalProfile(database, profile)).rejects.toThrow('disk full');
  await expect(upsertLocalProfile(database, profile)).resolves.toBeUndefined();
});
