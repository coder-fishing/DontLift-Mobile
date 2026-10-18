import {
  classifyPhoneOrientation,
  type AccelerometerSample,
  type PhoneOrientation,
} from '../sensors/phone-down-engine';
import { GracePeriodEngine, type ActiveViolation } from './grace-period-engine';
import type { ViolationRecord, ViolationSummary } from './violation-repository';

export type ForegroundViolationRepository = {
  start(input: { sessionId: string; userId: string; startedAtUtcMs: number; confirmedAtUtcMs: number }): Promise<ViolationRecord>;
  end(input: { eventId: string; endedAtUtcMs: number }): Promise<boolean>;
  getSummary(sessionId: string): Promise<ViolationSummary>;
  getActive?: (input: { sessionId: string; userId: string }) => Promise<ActiveViolation | null>;
};

export type ForegroundDetectionViewState = {
  orientation: PhoneOrientation;
  isGraceActive: boolean;
  isViolationActive: boolean;
  graceSeconds: number;
  violationsCount: number;
  violationDurationSeconds: number;
  persistenceError?: string;
};

const initialSummary: ViolationSummary = { count: 0, durationSeconds: 0 };
const SENSOR_SAMPLE_STALE_AFTER_MS = 1_000;

export class ForegroundDetectionController {
  private readonly engine = new GracePeriodEngine();
  private summary = initialSummary;
  private nextPersistenceAttemptAtUtcMs = 0;
  private persistenceError: string | undefined;
  private lastSampleAtUtcMs: number | null = null;
  private sealed = false;
  private transitionQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly session: { id: string; userId: string },
    private readonly repository: ForegroundViolationRepository,
  ) {}

  async initialize(): Promise<ForegroundDetectionViewState> {
    return this.serialize(async () => {
      this.summary = await this.repository.getSummary(this.session.id);
      const activeViolation = await this.repository.getActive?.({ sessionId: this.session.id, userId: this.session.userId });
      if (activeViolation) this.engine.restoreActiveViolation(activeViolation);
      return this.getViewState(Date.now());
    });
  }

  async observeSample(sample: AccelerometerSample, nowUtcMs: number): Promise<ForegroundDetectionViewState> {
    return this.serialize(async () => {
      if (this.sealed) return this.getViewState(nowUtcMs);
      this.lastSampleAtUtcMs = nowUtcMs;
      return this.applyOrientation(classifyPhoneOrientation(sample), nowUtcMs);
    });
  }

  async observeOrientation(
    orientation: PhoneOrientation,
    nowUtcMs: number,
  ): Promise<ForegroundDetectionViewState> {
    return this.serialize(async () => {
      if (this.sealed) return this.getViewState(nowUtcMs);
      this.lastSampleAtUtcMs = nowUtcMs;
      return this.applyOrientation(orientation, nowUtcMs);
    });
  }

  async tick(nowUtcMs: number): Promise<ForegroundDetectionViewState> {
    return this.serialize(async () => {
      if (this.sealed) return this.getViewState(nowUtcMs);
      const lastSampleIsFresh = this.lastSampleAtUtcMs !== null
        && nowUtcMs - this.lastSampleAtUtcMs <= SENSOR_SAMPLE_STALE_AFTER_MS;
      if (!lastSampleIsFresh) this.engine.observe('UNKNOWN', nowUtcMs);
      await this.persistTransition(nowUtcMs);
      return this.getViewState(nowUtcMs);
    });
  }

  async endCurrentViolation(nowUtcMs: number): Promise<void> {
    await this.serialize(async () => {
      const wasSealed = this.sealed;
      this.sealed = true;
      try {
        await this.persistTransition(nowUtcMs);
        const state = this.engine.snapshot(nowUtcMs);
        if (state.shouldConfirm) throw new Error('A confirmed violation could not be saved before ending the session.');
        // Giữ violation đang mở để completion/cancellation đóng nó cùng transaction đổi trạng thái session.
      } catch (error) {
        this.sealed = wasSealed;
        throw error;
      }
    });
  }

  async resumeAfterFinalizationFailure(nowUtcMs: number): Promise<ForegroundDetectionViewState> {
    return this.serialize(async () => {
      if (!this.sealed) return this.getViewState(nowUtcMs);
      // Session vẫn ACTIVE nếu bước ghi COMPLETED/CANCELLED lỗi; giữ violation mở và tiếp tục cùng một lượt.
      this.lastSampleAtUtcMs = null;
      this.nextPersistenceAttemptAtUtcMs = 0;
      this.persistenceError = undefined;
      this.sealed = false;
      return this.getViewState(nowUtcMs);
    });
  }

  getViewState(nowUtcMs: number): ForegroundDetectionViewState {
    const state = this.engine.snapshot(nowUtcMs);
    const activeDurationSeconds = state.activeViolation
      ? Math.max(
        0,
        Math.floor((nowUtcMs - state.activeViolation.startedAtUtcMs) / 1_000)
          - Math.floor((state.activeViolation.confirmedAtUtcMs - state.activeViolation.startedAtUtcMs) / 1_000),
      )
      : 0;

    return {
      orientation: state.orientation,
      isGraceActive: state.orientation !== 'UNKNOWN'
        && state.candidateStartedAtUtcMs !== null
        && !state.shouldConfirm,
      isViolationActive: state.activeViolation !== null,
      graceSeconds: state.graceRemainingMs === null ? 0 : Math.ceil(state.graceRemainingMs / 1_000),
      violationsCount: this.summary.count,
      violationDurationSeconds: this.summary.durationSeconds + activeDurationSeconds,
      persistenceError: this.persistenceError,
    };
  }

  private async persistTransition(nowUtcMs: number): Promise<void> {
    if (nowUtcMs < this.nextPersistenceAttemptAtUtcMs) return;
    const state = this.engine.snapshot(nowUtcMs);

    if (state.shouldConfirm && state.candidateStartedAtUtcMs !== null) {
      try {
        const record = await this.repository.start({
          sessionId: this.session.id,
          userId: this.session.userId,
          startedAtUtcMs: state.candidateStartedAtUtcMs,
          confirmedAtUtcMs: nowUtcMs,
        });
        // Chỉ chuyển sang confirmed sau khi transaction local đã commit thành công.
        this.engine.markConfirmed(record.eventId, nowUtcMs);
        this.summary = {
          count: this.summary.count + 1,
          durationSeconds: this.summary.durationSeconds + record.durationSeconds,
        };
        this.persistenceError = undefined;
        this.nextPersistenceAttemptAtUtcMs = 0;
      } catch {
        this.persistenceError = 'Could not save the violation on this device. It will retry automatically.';
        this.nextPersistenceAttemptAtUtcMs = nowUtcMs + 1_000;
      }
      return;
    }

    if (state.shouldEndViolation && state.activeViolation) {
      try {
        const ended = await this.repository.end({ eventId: state.activeViolation.eventId, endedAtUtcMs: nowUtcMs });
        if (ended) this.addActiveDuration(state.activeViolation, nowUtcMs);
        this.engine.markEnded();
        this.persistenceError = undefined;
        this.nextPersistenceAttemptAtUtcMs = 0;
      } catch {
        this.persistenceError = 'Could not finish saving the violation. It will retry automatically.';
        this.nextPersistenceAttemptAtUtcMs = nowUtcMs + 1_000;
      }
    }
  }

  private async applyOrientation(orientation: PhoneOrientation, nowUtcMs: number): Promise<ForegroundDetectionViewState> {
    this.engine.observe(orientation, nowUtcMs);
    await this.persistTransition(nowUtcMs);
    return this.getViewState(nowUtcMs);
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.transitionQueue.then(operation, operation);
    this.transitionQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private addActiveDuration(active: ActiveViolation, nowUtcMs: number) {
    const confirmedDurationSeconds = Math.floor(
      (active.confirmedAtUtcMs - active.startedAtUtcMs) / 1_000,
    );
    const finalDurationSeconds = Math.floor((nowUtcMs - active.startedAtUtcMs) / 1_000);
    this.summary = {
      count: this.summary.count,
      durationSeconds: this.summary.durationSeconds + Math.max(0, finalDurationSeconds - confirmedDurationSeconds),
    };
  }
}

export function createForegroundDetectionController(
  session: { id: string; userId: string },
  repository: ForegroundViolationRepository,
): ForegroundDetectionController {
  return new ForegroundDetectionController(session, repository);
}
