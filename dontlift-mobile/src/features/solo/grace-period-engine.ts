import type { PhoneOrientation } from '../sensors/phone-down-engine';

export const GRACE_PERIOD_MS = 3_000;

export type ActiveViolation = {
  eventId: string;
  startedAtUtcMs: number;
  confirmedAtUtcMs: number;
};

export type GracePeriodSnapshot = {
  orientation: PhoneOrientation;
  candidateStartedAtUtcMs: number | null;
  activeViolation: ActiveViolation | null;
  graceRemainingMs: number | null;
  shouldConfirm: boolean;
  shouldEndViolation: boolean;
};

export class GracePeriodEngine {
  private orientation: PhoneOrientation = 'UNKNOWN';
  private candidateStartedAtUtcMs: number | null = null;
  private activeViolation: ActiveViolation | null = null;

  observe(orientation: PhoneOrientation, nowUtcMs: number): GracePeriodSnapshot {
    this.orientation = orientation;

    if (orientation === 'UNKNOWN') {
      if (!this.activeViolation) this.candidateStartedAtUtcMs = null;
      return this.snapshot(nowUtcMs);
    }

    if (orientation === 'FACE_DOWN') {
      if (!this.activeViolation && this.candidateStartedAtUtcMs !== null) {
        const elapsedMs = nowUtcMs - this.candidateStartedAtUtcMs;
        // Chỉ hủy nếu máy úp lại trước hạn; quá 3 giây thì vẫn phải ghi violation đã đủ điều kiện.
        if (elapsedMs < GRACE_PERIOD_MS) this.candidateStartedAtUtcMs = null;
      }
      return this.snapshot(nowUtcMs);
    }

    if (!this.activeViolation && this.candidateStartedAtUtcMs === null) {
      // Bắt đầu grace bằng thời điểm mẫu đầu tiên không còn ở tư thế úp ổn định.
      this.candidateStartedAtUtcMs = nowUtcMs;
    }

    return this.snapshot(nowUtcMs);
  }

  markConfirmed(eventId: string, confirmedAtUtcMs: number): void {
    if (this.candidateStartedAtUtcMs === null) {
      throw new Error('Cannot confirm a violation without a grace candidate.');
    }
    this.activeViolation = {
      eventId,
      startedAtUtcMs: this.candidateStartedAtUtcMs,
      confirmedAtUtcMs,
    };
    this.candidateStartedAtUtcMs = null;
  }

  markEnded(): void {
    this.activeViolation = null;
    this.candidateStartedAtUtcMs = null;
  }

  reset(): void {
    this.orientation = 'UNKNOWN';
    this.activeViolation = null;
    this.candidateStartedAtUtcMs = null;
  }

  snapshot(nowUtcMs: number): GracePeriodSnapshot {
    const elapsedMs = this.candidateStartedAtUtcMs === null
      ? 0
      : Math.max(0, nowUtcMs - this.candidateStartedAtUtcMs);
    return {
      orientation: this.orientation,
      candidateStartedAtUtcMs: this.candidateStartedAtUtcMs,
      activeViolation: this.activeViolation,
      graceRemainingMs: this.candidateStartedAtUtcMs === null
        ? null
        : Math.max(0, GRACE_PERIOD_MS - elapsedMs),
      shouldConfirm: this.orientation !== 'UNKNOWN'
        && !this.activeViolation
        && this.candidateStartedAtUtcMs !== null
        && elapsedMs >= GRACE_PERIOD_MS,
      shouldEndViolation: this.orientation === 'FACE_DOWN' && this.activeViolation !== null,
    };
  }
}
