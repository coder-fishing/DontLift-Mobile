import { createBankDirectoryRepository, BankDirectoryError } from '../src/features/settlement/bank-directory';

describe('VietQR bank directory', () => {
  it('returns bank metadata including BIN, keeps all banks, sorts, and caches the list', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: '00', data: [
        { name: 'Z Bank', shortName: 'ZB', code: 'ZB', bin: 970416, lookupSupported: 0 },
        { name: 'A Bank', shortName: 'AB', code: 'AB', bin: '970436', lookupSupported: 1, logo: 'https://example.test/a.png' },
        { name: 'Invalid Bank', shortName: 'IB', code: 'IB', bin: '97', lookupSupported: 1 },
      ] }),
    });
    const directory = createBankDirectoryRepository({ fetchImpl });

    const first = await directory.list();
    const second = await directory.list();

    expect(first).toEqual([
      { name: 'A Bank', shortName: 'AB', code: 'AB', bin: '970436', logo: 'https://example.test/a.png' },
      { name: 'Z Bank', shortName: 'ZB', code: 'ZB', bin: '970416' },
    ]);
    expect(second).toBe(first);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.vietqr.io/v2/banks', expect.objectContaining({ method: 'GET' }));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retain an invalid response and retries the next request', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ code: '00', data: 'not-an-array' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ code: '00', data: [] }) });
    const directory = createBankDirectoryRepository({ fetchImpl });

    await expect(directory.list()).rejects.toBeInstanceOf(BankDirectoryError);
    await expect(directory.list()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
