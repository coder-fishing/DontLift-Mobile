import { createSoloSessionController, getSoloSessionTime } from '../src/features/solo/session-controller';

describe('solo session controller', () => {
  const startOrResume = jest.fn();
  const controller = createSoloSessionController({ startOrResume });

  beforeEach(() => startOrResume.mockReset());

  test('requires a ready sensor before writing a session', async () => {
    await expect(controller.start({
      userId: 'user-1',
      mode: 'COUNTDOWN',
      durationMinutes: 25,
      sensorReady: false,
    })).rejects.toMatchObject({ code: 'sensor-not-ready' });

    expect(startOrResume).not.toHaveBeenCalled();
  });

  test.each([4, 26, 181])('rejects invalid Countdown duration %i before writing', async (durationMinutes) => {
    await expect(controller.start({
      userId: 'user-1',
      mode: 'COUNTDOWN',
      durationMinutes,
      sensorReady: true,
    })).rejects.toMatchObject({ code: 'invalid-duration' });

    expect(startOrResume).not.toHaveBeenCalled();
  });

  test('converts a valid Countdown duration to seconds', async () => {
    const session = { id: 'session-1', userId: 'user-1', mode: 'COUNTDOWN', durationSeconds: 1500, startedAt: '2026-10-18T00:00:00.000Z' };
    startOrResume.mockResolvedValue({ session, resumed: false });

    await expect(controller.start({
      userId: 'user-1',
      mode: 'COUNTDOWN',
      durationMinutes: 25,
      sensorReady: true,
    })).resolves.toEqual({ session, resumed: false });

    expect(startOrResume).toHaveBeenCalledWith({ userId: 'user-1', mode: 'COUNTDOWN', durationSeconds: 1500 });
  });

  test('starts Stopwatch without a Countdown duration', async () => {
    const session = { id: 'session-2', userId: 'user-1', mode: 'STOPWATCH', durationSeconds: 0, startedAt: '2026-10-18T00:00:00.000Z' };
    startOrResume.mockResolvedValue({ session, resumed: false });

    await expect(controller.start({
      userId: 'user-1',
      mode: 'STOPWATCH',
      sensorReady: true,
    })).resolves.toEqual({ session, resumed: false });

    expect(startOrResume).toHaveBeenCalledWith({ userId: 'user-1', mode: 'STOPWATCH', durationSeconds: 0 });
  });

  test('does not create a session without an authenticated owner UID', async () => {
    await expect(controller.start({
      userId: '',
      mode: 'STOPWATCH',
      sensorReady: true,
    })).rejects.toMatchObject({ code: 'invalid-user' });

    expect(startOrResume).not.toHaveBeenCalled();
  });
});

describe('Solo session timer calculation', () => {
  const startedAt = '2026-10-18T00:00:00.000Z';

  test('counts Stopwatch upward from its persisted start time', () => {
    expect(getSoloSessionTime({
      id: 'session-1', userId: 'user-1', mode: 'STOPWATCH', durationSeconds: 0, startedAt,
    }, Date.parse(startedAt) + 61_000)).toEqual({ elapsedSeconds: 61, displayedSeconds: 61 });
  });

  test('counts Countdown down from its persisted start time and never goes negative', () => {
    const session = {
      id: 'session-2', userId: 'user-1', mode: 'COUNTDOWN' as const, durationSeconds: 1500, startedAt,
    };
    expect(getSoloSessionTime(session, Date.parse(startedAt) + 60_000)).toEqual({
      elapsedSeconds: 60,
      displayedSeconds: 1440,
    });
    expect(getSoloSessionTime(session, Date.parse(startedAt) + 2000_000).displayedSeconds).toBe(0);
  });
});
