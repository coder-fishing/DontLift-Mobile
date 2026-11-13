export type BankAppPlatform = 'android' | 'ios';

export type BankAppOption = {
  appId: string;
  appName: string;
  bankName: string;
  appLogo?: string;
};

export class BankAppDirectoryError extends Error {
  readonly code = 'unavailable' as const;

  constructor() {
    super('bank-app-directory-unavailable');
    this.name = 'BankAppDirectoryError';
  }
}

type VietQrBankApp = {
  appId?: unknown;
  appName?: unknown;
  bankName?: unknown;
  appLogo?: unknown;
};

function normalizedApps(payload: unknown): BankAppOption[] {
  if (!payload || typeof payload !== 'object' || !('apps' in payload) || !Array.isArray(payload.apps)) {
    throw new BankAppDirectoryError();
  }

  return payload.apps.flatMap((item: VietQrBankApp) => {
    if (typeof item.appId !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(item.appId)
      || typeof item.appName !== 'string' || !item.appName.trim()
      || typeof item.bankName !== 'string' || !item.bankName.trim()) return [];
    return [{
      appId: item.appId,
      appName: item.appName.trim(),
      bankName: item.bankName.trim(),
      ...(typeof item.appLogo === 'string' && /^https:\/\//.test(item.appLogo) ? { appLogo: item.appLogo } : {}),
    }];
  }).sort((left, right) => left.bankName.localeCompare(right.bankName, 'vi')
    || left.appName.localeCompare(right.appName, 'vi'));
}

async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try { return await operation(controller.signal); }
  finally { clearTimeout(timeoutId); }
}

export function createBankAppDirectoryRepository(dependencies: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
} = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const timeoutMs = dependencies.timeoutMs ?? 10_000;
  const cached = new Map<BankAppPlatform, Promise<BankAppOption[]>>();

  return {
    list(platform: BankAppPlatform): Promise<BankAppOption[]> {
      const existing = cached.get(platform);
      if (existing) return existing;
      const path = platform === 'android' ? 'android' : 'ios';
      const request = withTimeout(async signal => {
        const response = await fetchImpl(`https://api.vietqr.io/v2/${path}-app-deeplinks`, { method: 'GET', signal });
        if (!response.ok) throw new BankAppDirectoryError();
        return normalizedApps(await response.json());
      }, timeoutMs).catch(error => {
        cached.delete(platform);
        if (error instanceof BankAppDirectoryError) throw error;
        throw new BankAppDirectoryError();
      });
      cached.set(platform, request);
      return request;
    },
  };
}
