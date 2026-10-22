import type { ScreenId } from '../../types';
import type { PublishedBillState } from './published-bill-listener';
import type { PublishedBill } from './bill-repository';

export function billPublicationKey(bill: Pick<PublishedBill, 'roomId' | 'requestId'>): string {
  return `${bill.roomId}/${bill.requestId}`;
}

export function shouldOpenPublishedBillForMember(
  state: PublishedBillState,
  role: 'HOST' | 'MEMBER' | undefined,
  currentScreen: ScreenId,
  openedPublications: ReadonlySet<string>,
): boolean {
  return role === 'MEMBER' && currentScreen === '13-group-summary' && state.kind === 'published'
    && !openedPublications.has(billPublicationKey(state.bill));
}
