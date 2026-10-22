import { shouldTrackGroupConnectivity } from '../src/features/settlement/group-connectivity';

describe('group connectivity screen scope', () => {
  it.each(['13-group-summary', '14-settlement-details', '07-bill-allocation'] as const)(
    'keeps connectivity updates active on %s', screen => {
      expect(shouldTrackGroupConnectivity(screen)).toBe(true);
    },
  );

  it.each(['01-login', '06-group-active', '08-vietqr-settlement'] as const)(
    'does not attach the settlement connectivity listener on %s', screen => {
      expect(shouldTrackGroupConnectivity(screen)).toBe(false);
    },
  );
});
