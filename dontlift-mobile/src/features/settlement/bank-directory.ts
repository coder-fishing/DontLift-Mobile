export type BankOption = {
  name: string;
  shortName: string;
  code: string;
  bin: string;
  logo?: string;
};

export class BankDirectoryError extends Error {
  readonly code = 'unavailable' as const;

  constructor() {
    super('bank-directory-unavailable');
    this.name = 'BankDirectoryError';
  }
}

type VietQrBank = {
  name?: unknown;
  shortName?: unknown;
  code?: unknown;
  bin?: unknown;
  logo?: unknown;
};

function normalizedBanks(payload: unknown): BankOption[] {
  if (!payload || typeof payload !== 'object' || !('code' in payload) || payload.code !== '00'
    || !('data' in payload) || !Array.isArray(payload.data)) throw new BankDirectoryError();

  return payload.data.flatMap((item: VietQrBank) => {
    const bin = typeof item.bin === 'string' || typeof item.bin === 'number' ? String(item.bin) : '';
    if (!/^\d{6}$/.test(bin)
      || typeof item.name !== 'string' || !item.name.trim()
      || typeof item.shortName !== 'string' || !item.shortName.trim()
      || typeof item.code !== 'string' || !item.code.trim()) return [];
    return [{
      name: item.name.trim(),
      shortName: item.shortName.trim(),
      code: item.code.trim(),
      bin,
      ...(typeof item.logo === 'string' && /^https:\/\//.test(item.logo) ? { logo: item.logo } : {}),
    }];
  }).sort((left, right) => left.name.localeCompare(right.name, 'vi'));
}

async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try { return await operation(controller.signal); }
  finally { clearTimeout(timeoutId); }
}

export function createBankDirectoryRepository(dependencies: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
} = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const timeoutMs = dependencies.timeoutMs ?? 10_000;
  let cached: Promise<BankOption[]> | undefined;

  return {
    list(): Promise<BankOption[]> {
      if (cached) return cached;
      cached = withTimeout(async signal => {
        const response = await fetchImpl('https://api.vietqr.io/v2/banks', { method: 'GET', signal });
        if (!response.ok) throw new BankDirectoryError();
        return normalizedBanks(await response.json());
      }, timeoutMs).catch(error => {
        cached = undefined;
        if (error instanceof BankDirectoryError) throw error;
        throw new BankDirectoryError();
      });
      return cached;
    },
  };
}
