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
  if (!(error instanceof RoomCreateError)) return 'Không thể tạo phòng lúc này. Hãy thử lại.';
  switch (error.code) {
    case 'quota-exhausted':
      return 'Monthly room limit reached (7/month). Upgrade to Premium for unlimited creations.';
    case 'unauthenticated':
      return 'Phiên đăng nhập không còn hiệu lực. Hãy đăng nhập lại rồi thử lại.';
    case 'unavailable':
      return 'Chưa xác nhận được kết quả từ Firebase. Hãy kết nối mạng và thử lại; app sẽ kiểm tra yêu cầu cũ.';
    case 'rejected':
      return error.stage === 'clock-write' || error.stage === 'clock-read'
        ? 'Firebase chưa cho phép khởi tạo phòng (permission-denied). Rules SL-013 trên Cloud có thể chưa được cập nhật.'
        : 'Firebase từ chối giao dịch tạo phòng (permission-denied). Cần kiểm tra Rules; bạn cũng có thể thử lại với PIN mới.';
    case 'already-exists':
      return 'Yêu cầu tạo phòng đã tồn tại với dữ liệu khác. Hãy thử lại.';
    default:
      return 'Không thể tạo phòng lúc này. Hãy thử lại.';
  }
}
