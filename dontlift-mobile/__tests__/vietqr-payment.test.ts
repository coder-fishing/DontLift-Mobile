import { buildVietQrPayment } from '../src/features/settlement/vietqr-payload';

function fixture(): Parameters<typeof buildVietQrPayment>[0] {
  return {
    roomId: 'room', roomPin: '12345678', actorUid: 'member',
    member: { uid: 'member', displayName: 'Đặng Như Ý & + #', status: 'ACTIVE' },
    isOnline: true, nowUtcMs: 1_000,
    billState: { kind: 'published', bill: {
      version: 1, roomId: 'room', requestId: 'default', calculationVersion: 1,
      totalBillVnd: 123_456, sumShareVnd: 123_456, billRevision: 0,
      shares: [{ uid: 'member', shareVnd: 123_456 }],
    } },
    detailsState: { kind: 'ready', details: {
      version: 1, roomId: 'room', bankId: '970436', accountNumber: '00123456789',
      accountName: 'DANG NHU Y & CO', updatedAtUtcMs: 800, expiresAtUtcMs: 2_000,
    } },
  };
}

test('builds exact integer amount, leading-zero account and safely encoded payee/memo', () => {
  const qr = buildVietQrPayment(fixture());
  expect(qr.kind).toBe('ready');
  if (qr.kind !== 'ready') throw new Error('QR missing');
  expect(qr.imageUrl).toContain('/970436-00123456789-qr_only.svg?amount=123456&');
  const url = new URL(qr.imageUrl);
  expect(url.searchParams.get('accountName')).toBe('DANG NHU Y & CO');
  expect(url.searchParams.get('addInfo')).toBe('DL 12345678 DANG NHU Y');
  expect([...url.searchParams.keys()]).toEqual(['amount', 'addInfo', 'accountName']);
});

test.each(['cached', 'error', 'loading', 'unpublished'] as const)('does not generate from %s bill data', kind => {
  const input = fixture();
  input.billState = { kind, bill: null };
  expect(buildVietQrPayment(input).kind).toBe('unavailable');
});

test.each(['loading', 'unavailable', 'error'] as const)('does not generate from %s bank details', kind => {
  const input = fixture();
  input.detailsState = { kind };
  expect(buildVietQrPayment(input).kind).toBe('unavailable');
});

test('blocks expired details exactly at expiry and offline use', () => {
  expect(buildVietQrPayment({ ...fixture(), nowUtcMs: 2_000 }).kind).toBe('unavailable');
  expect(buildVietQrPayment({ ...fixture(), isOnline: false }).kind).toBe('unavailable');
});

test('rejects outsiders, removed memberships and mismatched rooms', () => {
  expect(buildVietQrPayment({ ...fixture(), member: undefined }).kind).toBe('unavailable');
  expect(buildVietQrPayment({ ...fixture(), actorUid: 'outsider' }).kind).toBe('unavailable');
  expect(buildVietQrPayment({ ...fixture(), roomId: 'another-room' }).kind).toBe('unavailable');
  const input = fixture();
  input.member!.status = 'REMOVED';
  expect(buildVietQrPayment(input).kind).toBe('unavailable');
});

test('treats zero as no transfer, and rejects fractional, negative and provider-overflow amounts', () => {
  for (const amount of [0, -1, 0.5, 10_000_000_000_000]) {
    const input = fixture();
    if (input.billState.kind !== 'published') throw new Error();
    input.billState.bill.shares = [{ uid: 'member', shareVnd: amount }, { uid: 'other', shareVnd: 1_000 }];
    input.billState.bill.totalBillVnd = amount + 1_000;
    input.billState.bill.sumShareVnd = amount + 1_000;
    expect(buildVietQrPayment(input).kind).toBe(amount === 0 ? 'zero' : 'unavailable');
  }
});

test('limits normalized memo to 50 ASCII characters without truncating room code', () => {
  const input = fixture();
  input.member!.displayName = 'Nguyễn '.repeat(20);
  const qr = buildVietQrPayment(input);
  if (qr.kind !== 'ready') throw new Error();
  expect(qr.memo.length).toBeLessThanOrEqual(50);
  expect(qr.memo).toMatch(/^DL 12345678 [A-Z0-9 ]+$/);
});

test('invalidates image identity when publication or recipient changes', () => {
  const original = buildVietQrPayment(fixture());
  const input = fixture();
  if (input.billState.kind !== 'published' || input.detailsState.kind !== 'ready') throw new Error();
  input.billState.bill.requestId = 'override';
  input.billState.bill.billRevision = 1;
  const replacement = buildVietQrPayment(input);
  input.detailsState.details.accountNumber = '55555555';
  const changedAccount = buildVietQrPayment(input);
  if (original.kind !== 'ready' || replacement.kind !== 'ready' || changedAccount.kind !== 'ready') throw new Error();
  expect(replacement.identity).not.toBe(original.identity);
  expect(changedAccount.identity).not.toBe(replacement.identity);
});

test('rejects unsupported bank/account input instead of embedding arbitrary URL paths', () => {
  for (const [bankId, accountNumber] of [['VCB', '123'], ['970436', '123/../456'], ['970436', '1'.repeat(20)]]) {
    const input = fixture();
    if (input.detailsState.kind !== 'ready') throw new Error();
    Object.assign(input.detailsState.details, { bankId, accountNumber });
    expect(buildVietQrPayment(input).kind).toBe('unavailable');
  }
});
