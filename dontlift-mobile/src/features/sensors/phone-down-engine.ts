export type PhoneOrientation = 'UNKNOWN' | 'FACE_DOWN' | 'INVALID' | 'LIFTED';

export type AccelerometerSample = {
  x: number;
  y: number;
  z: number;
};

// Chỉ xem máy là úp khi thành phần trọng lực hướng xuống màn hình đủ rõ và mẫu ổn định.
const MIN_GRAVITY_MAGNITUDE_G = 0.65;
const MAX_GRAVITY_MAGNITUDE_G = 1.35;
const FACE_DOWN_Z_RATIO = -0.85;

export function classifyPhoneOrientation(sample: AccelerometerSample | null): PhoneOrientation {
  if (!sample) return 'UNKNOWN';
  if (![sample.x, sample.y, sample.z].every(Number.isFinite)) return 'INVALID';

  const magnitude = Math.sqrt(sample.x ** 2 + sample.y ** 2 + sample.z ** 2);
  if (magnitude < MIN_GRAVITY_MAGNITUDE_G || magnitude > MAX_GRAVITY_MAGNITUDE_G) return 'INVALID';

  return sample.z / magnitude <= FACE_DOWN_Z_RATIO ? 'FACE_DOWN' : 'LIFTED';
}
