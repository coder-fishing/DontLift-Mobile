import type { ScreenId } from '../../types';
import type { PublishedBillState } from './published-bill-listener';

export function shouldOpenPublishedBillForMember(
  state: PublishedBillState,
  role: 'HOST' | 'MEMBER' | undefined,
  currentScreen: ScreenId,
): boolean {
  return role === 'MEMBER' && currentScreen === '13-group-summary' && state.kind === 'published';
}
