import { premiumIsActive, readPremiumExpiry } from '../src/features/premium/premium-entitlement';
import { createPremiumApi } from '../src/features/premium/premium-api';

test('expiry is required and exact cutoff is Free', () => {
  expect(premiumIsActive(null, 100)).toBe(false);
  expect(premiumIsActive(100, 100)).toBe(false);
  expect(premiumIsActive(101, 100)).toBe(true);
  expect(readPremiumExpiry({ toMillis: () => 123 })).toBe(123);
  expect(readPremiumExpiry({ isPremium: true })).toBe(null);
});

test('checkout sends package identity and fresh token, without a client price', async () => {
  const getIdToken = jest.fn().mockResolvedValue('test-id-token');
  const auth = { currentUser: { uid: 'account-a', getIdToken } };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 1, orderCode: 42, requestId: 'request-1', packageId: 'MONTH_3', amountVnd: 178000,
    status: 'CREATING', checkoutUrl: null, qrCode: null, premiumExpiresAtUtcMs: null }) });
  try {
    await createPremiumApi(auth as never, 'https://premium.example.invalid').create('request-1', 'MONTH_3');
    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://premium.example.invalid/v1/premium/orders', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-id-token' }),
      body: JSON.stringify({ version: 1, requestId: 'request-1', packageId: 'MONTH_3' }),
    }));
  } finally { globalThis.fetch = originalFetch; }
});

test('old account HTTP result is discarded after account changes', async () => {
  const auth = { currentUser: { uid: 'a', getIdToken: async () => 'test-token' } };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn().mockImplementation(async () => {
    auth.currentUser = { ...auth.currentUser, uid: 'b' };
    return { ok: true, json: async () => ({ version: 1 }) };
  });
  try { await expect(createPremiumApi(auth as never, 'https://premium.example.invalid').current()).rejects.toThrow('account changed'); }
  finally { globalThis.fetch = originalFetch; }
});
