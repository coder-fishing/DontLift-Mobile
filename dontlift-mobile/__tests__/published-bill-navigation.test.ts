import { shouldOpenPublishedBillForMember } from '../src/features/settlement/published-bill-navigation';
import type { PublishedBillState } from '../src/features/settlement/published-bill-listener';

describe('published bill navigation', () => {
  const published: PublishedBillState = {
    kind: 'published',
    bill: {
      version: 1, requestId: 'request', roomId: 'room', totalBillVnd: 1_000,
      calculationVersion: 1, shares: [{ uid: 'member', shareVnd: 1_000 }], sumShareVnd: 1_000,
    },
  };

  it('opens the live published breakdown for a Member waiting at Group Summary', () => {
    expect(shouldOpenPublishedBillForMember(published, 'MEMBER', '13-group-summary')).toBe(true);
  });

  it.each([
    [{ kind: 'cached', bill: published.bill } as PublishedBillState, 'MEMBER', '13-group-summary'],
    [{ kind: 'unpublished' } as PublishedBillState, 'MEMBER', '13-group-summary'],
    [published, 'HOST', '13-group-summary'],
    [published, 'MEMBER', '14-settlement-details'],
  ] as const)('does not auto-navigate for cached, unpublished, Host, or another screen', (state, role, screen) => {
    expect(shouldOpenPublishedBillForMember(state, role, screen)).toBe(false);
  });
});
