export type RoomCreateStage = 'clock-write' | 'clock-read' | 'transaction';
type RoomCreateErrorCode = 'unauthenticated' | 'quota-exhausted' | 'already-exists' | 'rejected' | 'unavailable' | 'unknown';

export class RoomCreateError extends Error {
  constructor(
    public readonly code: RoomCreateErrorCode,
    public readonly stage?: RoomCreateStage,
    public readonly firebaseCode?: string,
  ) {
    super(code);
    this.name = 'RoomCreateError';
  }
}

export function mapRoomCreateError(error: unknown, stage: RoomCreateStage): RoomCreateError {
  if (error instanceof RoomCreateError) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code.replace(/^firestore\//, '') : '';
  if (code === 'unauthenticated') return new RoomCreateError('unauthenticated', stage, code);
  if (code === 'resource-exhausted') return new RoomCreateError('quota-exhausted', stage, code);
  if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) {
    return new RoomCreateError('unavailable', stage, code);
  }
  if (code === 'permission-denied') return new RoomCreateError('rejected', stage, code);
  if (code === 'already-exists') return new RoomCreateError('already-exists', stage, code);
  // Chỉ giữ mã lỗi allowlist; không đưa raw message, UID hay token vào UI/log.
  return new RoomCreateError('unknown', stage);
}

export function roomCreateErrorMessage(error: unknown): string {
  if (!(error instanceof RoomCreateError)) return 'Could not create the room. Please try again.';
  switch (error.code) {
    case 'quota-exhausted':
      return 'Monthly room limit reached (7/month). Upgrade to Premium for unlimited creations.';
    case 'unauthenticated':
      return 'Your session has expired. Sign in again and retry.';
    case 'unavailable':
      return 'Could not confirm the result. Reconnect and retry to check your previous request.';
    case 'rejected':
      return error.stage === 'clock-write' || error.stage === 'clock-read'
        ? 'Room creation access could not be checked. Please contact support if this continues.'
        : 'Room creation was denied. Please contact support if this continues.';
    case 'already-exists':
      return 'This request already exists with different details. Please try again.';
    default:
      return 'Could not create the room. Please try again.';
  }
}
