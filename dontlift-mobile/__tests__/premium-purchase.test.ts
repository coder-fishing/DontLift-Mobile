import { premiumIsActive, readPremiumExpiry } from '../src/features/premium/premium-entitlement';
import { createPremiumApi, DISPLAY_PREMIUM_PACKAGES, getBestValuePackageId, getPremiumPlanLabels } from '../src/features/premium/premium-api';

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
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: jest.fn().mockReturnValue('application/json') },
    text: async () => JSON.stringify({ version: 1, orderCode: 42, requestId: 'request-1', packageId: 'MONTH_3', amountVnd: 79000,
      status: 'CREATING', checkoutUrl: null, qrCode: null, premiumExpiresAtUtcMs: null }),
  });
  try {
    await createPremiumApi(auth as never, 'https://premium.example.invalid').create('request-1', 'MONTH_3');
    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://premium.example.invalid/v1/premium/orders', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-id-token' }),
      body: JSON.stringify({ version: 1, requestId: 'request-1', packageId: 'MONTH_3' }),
    }));
  } finally { globalThis.fetch = originalFetch; }
});

test('display fallback matches the approved package schedule', () => {
  expect(DISPLAY_PREMIUM_PACKAGES).toEqual([
    { id: 'MONTH_1', amountVnd: 30000, paidMonths: 1, grantedMonths: 1 },
    { id: 'MONTH_3', amountVnd: 79000, paidMonths: 3, grantedMonths: 4 },
    { id: 'MONTH_6', amountVnd: 149000, paidMonths: 6, grantedMonths: 8 },
    { id: 'MONTH_12', amountVnd: 249000, paidMonths: 12, grantedMonths: 16 },
  ]);
  expect(getBestValuePackageId(DISPLAY_PREMIUM_PACKAGES)).toBe('MONTH_12');
  expect(getBestValuePackageId([])).toBe(null);
  expect(DISPLAY_PREMIUM_PACKAGES.map(getPremiumPlanLabels)).toEqual([
    { duration: '1 month', bonusMonths: 0, bonus: null, access: 'Basic access' },
    { duration: '3 months', bonusMonths: 1, bonus: '+1 month free', access: 'Use Premium for 4 months' },
    { duration: '6 months', bonusMonths: 2, bonus: '+2 months free', access: 'Use Premium for 8 months' },
    { duration: '12 months', bonusMonths: 4, bonus: '+4 months free', access: 'Use Premium for 16 months' },
  ]);
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
