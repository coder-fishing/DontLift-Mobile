export type SoloSessionMode = 'COUNTDOWN' | 'STOPWATCH';

export type SoloSession = {
  id: string;
  userId: string;
  mode: SoloSessionMode;
  durationSeconds: number;
  startedAt: string;
};

export type SoloSessionStartResult = { session: SoloSession; resumed: boolean };

export function getSoloSessionTime(session: SoloSession, nowUtcMs: number): {
  elapsedSeconds: number;
  displayedSeconds: number;
} {
  // Tính từ mốc đã lưu thay vì cộng từng tick để đồng hồ vẫn chính xác sau khi app bị tạm dừng.
  const elapsedSeconds = Math.max(0, Math.floor((nowUtcMs - Date.parse(session.startedAt)) / 1000));
  return {
    elapsedSeconds,
    displayedSeconds: session.mode === 'COUNTDOWN'
      ? Math.max(0, session.durationSeconds - elapsedSeconds)
      : elapsedSeconds,
  };
}

export type SoloSessionStartInput = {
  userId: string;
  mode: SoloSessionMode;
  durationMinutes?: number;
  sensorReady: boolean;
};

export type SoloSessionRepositoryPort = {
  startOrResume(input: {
    userId: string;
    mode: SoloSessionMode;
    durationSeconds: number;
  }): Promise<SoloSessionStartResult>;
  cancelActive?: (input: { userId: string; sessionId: string }) => Promise<boolean>;
};

export type SoloSessionStartErrorCode = 'sensor-not-ready' | 'invalid-user' | 'invalid-duration';

function sessionStartError(code: SoloSessionStartErrorCode, message: string): Error & { code: SoloSessionStartErrorCode } {
  return Object.assign(new Error(message), { code });
}

export function createSoloSessionController(repository: SoloSessionRepositoryPort) {
  return {
    async start(input: SoloSessionStartInput): Promise<SoloSessionStartResult> {
      if (!input.userId.trim()) {
        throw sessionStartError('invalid-user', 'An authenticated account is required to start a Solo session.');
      }
      if (!input.sensorReady) {
        throw sessionStartError('sensor-not-ready', 'Wait for the motion sensor check before starting a Solo session.');
      }

      let durationSeconds = 0;
      if (input.mode === 'COUNTDOWN') {
        const minutes = input.durationMinutes;
        if (!Number.isInteger(minutes) || minutes === undefined || minutes < 5 || minutes > 180 || minutes % 5 !== 0) {
          throw sessionStartError('invalid-duration', 'Countdown duration must be between 5 and 180 minutes in 5-minute steps.');
        }
        durationSeconds = minutes * 60;
      }

      // Chỉ ghi sau khi đã xác thực UID, sensor và thời lượng để dữ liệu lỗi không lọt vào SQLite.
      return repository.startOrResume({
        userId: input.userId,
        mode: input.mode,
        durationSeconds,
      });
    },
    async cancel(input: { userId: string; sessionId: string }): Promise<boolean> {
      if (!input.userId.trim() || !input.sessionId.trim()) return false;
      return repository.cancelActive ? repository.cancelActive(input) : false;
    },
  };
}
