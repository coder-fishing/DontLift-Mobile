import { BillAllocationError, calculateDefaultBillShares } from '../src/features/settlement/bill-allocation';

describe('calculateDefaultBillShares', () => {
  it('splits the full bill equally when every finalized score is zero', () => {
    const result = calculateDefaultBillShares(10_001, [
      { uid: 'b', penaltyScore: 0 }, { uid: 'a', penaltyScore: 0 }, { uid: 'c', penaltyScore: 0 },
    ]);

    expect(result.sumShareVnd).toBe(10_001);
    expect(result.shares).toEqual([
      { uid: 'a', shareVnd: 4_001 }, { uid: 'b', shareVnd: 3_000 }, { uid: 'c', shareVnd: 3_000 },
    ]);
  });

  it('preserves an exact sub-1,000 VND residual for a 1,001 VND bill', () => {
    const result = calculateDefaultBillShares(1_001, [
      { uid: 'member-a', penaltyScore: 0 }, { uid: 'member-b', penaltyScore: 3 },
    ]);

    expect(result.sumShareVnd).toBe(1_001);
    expect(result.shares.every(share => Number.isSafeInteger(share.shareVnd) && share.shareVnd >= 0)).toBe(true);
  });

  it.each([
    999,
    -1,
    1_000.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid total bill %s', total => {
    expect(() => calculateDefaultBillShares(total, [{ uid: 'member-a', penaltyScore: 0 }]))
      .toThrow(new BillAllocationError('invalid-argument'));
  });

  it('rejects malformed or duplicate members', () => {
    expect(() => calculateDefaultBillShares(1_000, [])).toThrow('invalid-argument');
    expect(() => calculateDefaultBillShares(1_000, [
      { uid: 'same', penaltyScore: 0 }, { uid: 'same', penaltyScore: 1 },
    ])).toThrow('invalid-argument');
    expect(() => calculateDefaultBillShares(1_000, [{ uid: 'member-a', penaltyScore: -1 }]))
      .toThrow('invalid-argument');
  });

  it('is deterministic for early-exit members represented by their frozen final score', () => {
    const members = [
      { uid: 'host', penaltyScore: 0 },
      { uid: 'early-exit', penaltyScore: 37 },
      { uid: 'member', penaltyScore: 14 },
    ];
    expect(calculateDefaultBillShares(54_321, members))
      .toEqual(calculateDefaultBillShares(54_321, [...members].reverse()));
  });

  it('keeps integer, non-negative shares and exact sums over varied rosters', () => {
    let seed = 24_001;
    const random = (limit: number) => {
      seed = (seed * 48_271) % 2_147_483_647;
      return seed % limit;
    };

    for (let caseIndex = 0; caseIndex < 120; caseIndex += 1) {
      const memberCount = 1 + random(15);
      const totalBillVnd = 1_000 + random(50_000_000);
      const members = Array.from({ length: memberCount }, (_, index) => ({
        uid: `member-${String(index).padStart(2, '0')}`,
        penaltyScore: random(5_000),
      }));
      const result = calculateDefaultBillShares(totalBillVnd, members);
      expect(result.shares.reduce((sum, share) => sum + share.shareVnd, 0)).toBe(totalBillVnd);
      expect(result.shares.every(share => Number.isSafeInteger(share.shareVnd) && share.shareVnd >= 0)).toBe(true);
      expect(result).toEqual(calculateDefaultBillShares(totalBillVnd, [...members].reverse()));
    }
  });
});
