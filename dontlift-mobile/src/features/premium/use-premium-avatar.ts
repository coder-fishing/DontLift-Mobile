import { useEffect, useState } from 'react';
import { premiumIsActive } from './premium-entitlement';

const MAX_TIMEOUT_MS = 2_147_000_000;

export function usePremiumAvatarActive(expiresAtUtcMs: number | null | undefined): boolean {
  const [nowUtcMs, setNowUtcMs] = useState(() => Date.now());

  useEffect(() => {
    if (!premiumIsActive(expiresAtUtcMs)) return undefined;
    let timeout: ReturnType<typeof setTimeout>;
    const refreshAtExpiry = () => {
      const remaining = (expiresAtUtcMs ?? 0) - Date.now();
      if (remaining <= 0) {
        setNowUtcMs(Date.now());
        return;
      }
      timeout = setTimeout(refreshAtExpiry, Math.min(remaining, MAX_TIMEOUT_MS));
    };
    refreshAtExpiry();
    return () => clearTimeout(timeout);
  }, [expiresAtUtcMs]);

  return premiumIsActive(expiresAtUtcMs, nowUtcMs);
}
