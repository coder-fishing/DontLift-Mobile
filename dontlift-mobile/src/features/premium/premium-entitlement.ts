export function premiumIsActive(expiresAtUtcMs: number | null | undefined, nowUtcMs = Date.now()): boolean {
  return typeof expiresAtUtcMs === 'number' && Number.isFinite(expiresAtUtcMs) && expiresAtUtcMs > nowUtcMs;
}

export function readPremiumExpiry(value: unknown): number | null {
  if (!value || typeof value !== 'object' || !('toMillis' in value) || typeof value.toMillis !== 'function') return null;
  const time: unknown = value.toMillis();
  return typeof time === 'number' && Number.isFinite(time) ? time : null;
}
