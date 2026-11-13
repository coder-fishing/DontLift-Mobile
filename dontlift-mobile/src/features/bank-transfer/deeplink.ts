export function buildBankTransferDeeplink(input: {
  appId: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amountVnd: number;
  memo: string;
  returnUrl: string;
}): string {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(input.appId)
    || !/^[A-Za-z0-9]{1,20}$/.test(input.bankCode)
    || !/^[A-Za-z0-9]{1,19}$/.test(input.accountNumber)
    || !input.accountName.trim() || !Number.isSafeInteger(input.amountVnd) || input.amountVnd < 1
    || !/^[\x20-\x7E]{1,50}$/.test(input.memo)
    || (input.returnUrl !== 'dontliftmobile://' && input.returnUrl !== 'https://www.vietqr.io/deeplink')) {
    throw new Error('bank-transfer-details-unavailable');
  }

  const query = new URLSearchParams({
    app: input.appId,
    am: String(input.amountVnd),
    tn: input.memo,
    ba: `${input.accountNumber}@${input.bankCode.toLowerCase()}`,
    bn: input.accountName.trim(),
    url: input.returnUrl,
  });
  const encoded = query.toString()
    .replace(`ba=${input.accountNumber}%40${input.bankCode.toLowerCase()}`, `ba=${input.accountNumber}@${input.bankCode.toLowerCase()}`)
    .replace(`url=${encodeURIComponent(input.returnUrl)}`, `url=${input.returnUrl}`);
  return `https://dl.vietqr.io/pay?${encoded}`;
}
