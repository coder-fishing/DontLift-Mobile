import type { ScreenId } from '../../types';

export function shouldTrackGroupConnectivity(screen: ScreenId): boolean {
  return screen === '13-group-summary' || screen === '14-settlement-details'
    || screen === '07-bill-allocation' || screen === '08-vietqr-settlement';
}
