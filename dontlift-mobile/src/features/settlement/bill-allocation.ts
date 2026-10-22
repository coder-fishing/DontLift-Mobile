export type BillAllocationMember = {
  uid: string;
  penaltyScore: number;
};

export type BillShare = {
  uid: string;
  shareVnd: number;
};

export type BillAllocation = {
  totalBillVnd: number;
  sumShareVnd: number;
  shares: BillShare[];
};

export class BillAllocationError extends Error {
  constructor(readonly code: 'invalid-argument' | 'failed-precondition') {
    super(code);
    this.name = 'BillAllocationError';
  }
}

const ROUNDING_UNIT = 1_000n;
const BASIS_POINTS = 10_000n;

type RawShare = {
  uid: string;
  numerator: bigint;
  denominator: bigint;
  roundedVnd: bigint;
  residualNumerator: bigint;
};

export type BillShareOverride = {
  uid: string;
  type: 'FIXED_VND' | 'PERCENT_BPS';
  value: number;
};

function compareUid(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function roundedThousands(numerator: bigint, denominator: bigint): bigint {
  return ((numerator + denominator * 500n) / (denominator * ROUNDING_UNIT)) * ROUNDING_UNIT;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function calculateFromRaw(totalBillVnd: number, rawShares: RawShare[]): BillAllocation {
  const commonDenominator = rawShares.reduce((current, share) =>
    current / gcd(current, share.denominator) * share.denominator, 1n);
  for (const share of rawShares) {
    share.numerator *= commonDenominator / share.denominator;
    share.denominator = commonDenominator;
    share.roundedVnd = roundedThousands(share.numerator, commonDenominator);
    share.residualNumerator = share.numerator - share.roundedVnd * commonDenominator;
  }

  const residualOrder = [...rawShares].sort((left, right) => {
    const residualDifference = left.residualNumerator - right.residualNumerator;
    if (residualDifference !== 0n) return residualDifference > 0n ? -1 : 1;
    return compareUid(left.uid, right.uid);
  });
  const subtractionOrder = [...rawShares].sort((left, right) => {
    const residualDifference = left.residualNumerator - right.residualNumerator;
    if (residualDifference !== 0n) return residualDifference < 0n ? -1 : 1;
    return compareUid(left.uid, right.uid);
  });

  const total = BigInt(totalBillVnd);
  let discrepancy = total - rawShares.reduce((sum, share) => sum + share.roundedVnd, 0n);
  let cursor = 0;
  let noProgress = 0;
  while (discrepancy >= ROUNDING_UNIT || discrepancy <= -ROUNDING_UNIT) {
    if (discrepancy > 0n) {
      residualOrder[cursor % residualOrder.length].roundedVnd += ROUNDING_UNIT;
      discrepancy -= ROUNDING_UNIT;
      noProgress = 0;
    } else {
      const share = subtractionOrder[cursor % subtractionOrder.length];
      if (share.roundedVnd >= ROUNDING_UNIT) {
        share.roundedVnd -= ROUNDING_UNIT;
        discrepancy += ROUNDING_UNIT;
        noProgress = 0;
      } else {
        noProgress += 1;
        if (noProgress >= residualOrder.length) throw new BillAllocationError('failed-precondition');
      }
    }
    cursor += 1;
  }

  if (discrepancy > 0n) {
    residualOrder[0].roundedVnd += discrepancy;
    discrepancy = 0n;
  } else if (discrepancy < 0n) {
    const amountToRemove = -discrepancy;
    const recipient = subtractionOrder.find(share => share.roundedVnd >= amountToRemove);
    if (!recipient) throw new BillAllocationError('failed-precondition');
    recipient.roundedVnd -= amountToRemove;
    discrepancy = 0n;
  }

  const sumShare = rawShares.reduce((sum, share) => sum + share.roundedVnd, 0n);
  if (sumShare !== total || rawShares.some(share => share.roundedVnd < 0n || share.roundedVnd > BigInt(Number.MAX_SAFE_INTEGER))) {
    throw new BillAllocationError('failed-precondition');
  }
  return {
    totalBillVnd,
    sumShareVnd: Number(sumShare),
    shares: rawShares.map(share => ({ uid: share.uid, shareVnd: Number(share.roundedVnd) }))
      .sort((left, right) => compareUid(left.uid, right.uid)),
  };
}

function createDefaultRawShares(totalBillVnd: number, members: readonly BillAllocationMember[]): RawShare[] {
  const total = BigInt(totalBillVnd);
  const count = BigInt(members.length);
  const scoreTotal = members.reduce((sum, member) => sum + BigInt(member.penaltyScore), 0n);
  const commonDenominator = scoreTotal === 0n ? count : BASIS_POINTS * count * scoreTotal;
  return members.map(member => {
    const score = BigInt(member.penaltyScore);
    const numerator = scoreTotal === 0n
      ? total
      : 4_000n * total * scoreTotal + 6_000n * total * count * score;
    return { uid: member.uid, numerator, denominator: commonDenominator, roundedVnd: 0n, residualNumerator: 0n };
  });
}

export function calculateDefaultBillShares(
  totalBillVnd: number,
  members: readonly BillAllocationMember[],
): BillAllocation {
  if (!Number.isSafeInteger(totalBillVnd) || totalBillVnd < 1_000
    || members.length === 0
    || members.some(member => !member.uid || !Number.isSafeInteger(member.penaltyScore) || member.penaltyScore < 0)
    || new Set(members.map(member => member.uid)).size !== members.length) {
    throw new BillAllocationError('invalid-argument');
  }

  // Default và override cùng đi qua một pipeline làm tròn/residual duy nhất.
  return calculateFromRaw(totalBillVnd, createDefaultRawShares(totalBillVnd, members));
}

export function calculateBillSharesWithOverrides(
  totalBillVnd: number,
  members: readonly BillAllocationMember[],
  overrides: readonly BillShareOverride[],
): BillAllocation {
  if (!Number.isSafeInteger(totalBillVnd) || totalBillVnd < 1_000 || members.length === 0
    || members.some(member => !member.uid || !Number.isSafeInteger(member.penaltyScore) || member.penaltyScore < 0)
    || new Set(members.map(member => member.uid)).size !== members.length
    || overrides.length === 0
    || overrides.some(item => !item.uid || !['FIXED_VND', 'PERCENT_BPS'].includes(item.type)
      || !Number.isSafeInteger(item.value) || item.value < 0
      || (item.type === 'PERCENT_BPS' && item.value > 10_000))
    || new Set(overrides.map(item => item.uid)).size !== overrides.length
    || overrides.some(item => !members.some(member => member.uid === item.uid))) {
    throw new BillAllocationError('invalid-argument');
  }

  const rawShares = createDefaultRawShares(totalBillVnd, members);
  const byUid = new Map(rawShares.map(share => [share.uid, share]));
  for (const override of overrides) {
    const denominator = override.type === 'PERCENT_BPS' ? BASIS_POINTS : 1n;
    const numerator = BigInt(override.value) * (override.type === 'PERCENT_BPS' ? BigInt(totalBillVnd) : 1n);
    byUid.set(override.uid, {
      uid: override.uid, numerator, denominator, roundedVnd: 0n, residualNumerator: 0n,
    });
  }

  const completeRawShares = rawShares.map(share => byUid.get(share.uid)!);
  const commonDenominator = completeRawShares.reduce((current, share) =>
    current / gcd(current, share.denominator) * share.denominator, 1n);
  // Không tự chia phần dư: tổng vector thô phải khớp hóa đơn trước khi làm tròn chung.
  const exactTotal = completeRawShares.reduce((sum, share) => sum
    + byUid.get(share.uid)!.numerator * (commonDenominator / byUid.get(share.uid)!.denominator), 0n);
  if (exactTotal !== BigInt(totalBillVnd) * commonDenominator) {
    throw new BillAllocationError('failed-precondition');
  }
  return calculateFromRaw(totalBillVnd, completeRawShares);
}
