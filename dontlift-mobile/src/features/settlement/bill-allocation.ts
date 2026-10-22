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

function compareUid(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function roundedThousands(numerator: bigint, denominator: bigint): bigint {
  return ((numerator + denominator * 500n) / (denominator * ROUNDING_UNIT)) * ROUNDING_UNIT;
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

  const total = BigInt(totalBillVnd);
  const count = BigInt(members.length);
  const scoreTotal = members.reduce((sum, member) => sum + BigInt(member.penaltyScore), 0n);
  const commonDenominator = scoreTotal === 0n ? count : BASIS_POINTS * count * scoreTotal;

  const rawShares: RawShare[] = members.map(member => {
    const score = BigInt(member.penaltyScore);
    const numerator = scoreTotal === 0n
      ? total
      : 4_000n * total * scoreTotal + 6_000n * total * count * score;
    const denominator = commonDenominator;
    const roundedVnd = roundedThousands(numerator, denominator);
    return {
      uid: member.uid,
      numerator,
      denominator,
      roundedVnd,
      residualNumerator: numerator - roundedVnd * denominator,
    };
  });

  const residualOrder = [...rawShares].sort((left, right) => {
    const residualDifference = left.residualNumerator - right.residualNumerator;
    if (residualDifference !== 0n) return residualDifference > 0n ? -1 : 1;
    return compareUid(left.uid, right.uid);
  });
  // Khi trừ, residual tăng dần nhưng UID vẫn tăng dần nếu bằng nhau; không đảo toàn bộ thứ tự cộng.
  const subtractionOrder = [...rawShares].sort((left, right) => {
    const residualDifference = left.residualNumerator - right.residualNumerator;
    if (residualDifference !== 0n) return residualDifference < 0n ? -1 : 1;
    return compareUid(left.uid, right.uid);
  });

  let discrepancy = total - rawShares.reduce((sum, share) => sum + share.roundedVnd, 0n);
  let cursor = 0;
  let noProgress = 0;
  while (discrepancy >= ROUNDING_UNIT || discrepancy <= -ROUNDING_UNIT) {
    if (discrepancy > 0n) {
      const share = residualOrder[cursor % residualOrder.length];
      share.roundedVnd += ROUNDING_UNIT;
      discrepancy -= ROUNDING_UNIT;
      noProgress = 0;
    } else {
      // Khi cần giảm tổng, bắt đầu từ residual thấp nhất theo contract ADR-005.
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
  if (sumShare !== total || rawShares.some(share => share.roundedVnd < 0n)) {
    throw new BillAllocationError('failed-precondition');
  }

  return {
    totalBillVnd,
    sumShareVnd: Number(sumShare),
    shares: rawShares.map(share => ({ uid: share.uid, shareVnd: Number(share.roundedVnd) }))
      .sort((left, right) => compareUid(left.uid, right.uid)),
  };
}
