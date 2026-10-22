import { selectPublishedBillState, type PublishedBillState } from '../src/features/settlement/published-bill-state';
import type { PublishedBill } from '../src/features/settlement/bill-repository';

const bill: PublishedBill = {
  version: 1, requestId: 'request', roomId: 'room', totalBillVnd: 1_000,
  calculationVersion: 1, shares: [{ uid: 'member', shareVnd: 1_000 }], sumShareVnd: 1_000,
};

describe('published bill display state', () => {
  it.each<PublishedBillState>([
    { kind: 'cached', bill: null },
    { kind: 'error' },
    { kind: 'loading' },
    { kind: 'unpublished' },
  ])('keeps $kind visible while retaining the last confirmed breakdown', state => {
    expect(selectPublishedBillState(state, bill, 'room')).toEqual({ ...state, bill });
  });

  it('uses the current published result when Firebase confirms it', () => {
    const current = { ...bill, requestId: 'new-request' };
    expect(selectPublishedBillState({ kind: 'published', bill: current }, bill, 'room'))
      .toEqual({ kind: 'published', bill: current });
  });

  it('never carries a previous room breakdown into another room', () => {
    expect(selectPublishedBillState({ kind: 'error' }, bill, 'another-room')).toEqual({ kind: 'error' });
  });

  it('keeps an initial read error without inventing a saved breakdown', () => {
    expect(selectPublishedBillState({ kind: 'error' }, null, 'room')).toEqual({ kind: 'error' });
  });

  it('does not retain a stale listener result after changing rooms', () => {
    expect(selectPublishedBillState({ kind: 'published', bill }, null, 'another-room')).toEqual({ kind: 'loading' });
    expect(selectPublishedBillState({ kind: 'cached', bill }, null, 'another-room')).toEqual({ kind: 'cached', bill: null });
  });

  it('keeps an empty cache null when no room is selected', () => {
    expect(selectPublishedBillState({ kind: 'cached', bill: null }, null, undefined)).toEqual({ kind: 'cached', bill: null });
  });
});
