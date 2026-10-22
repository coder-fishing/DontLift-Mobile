import { doc, getDocFromServer, runTransaction, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore';

export type MarkPaymentCommand = {
  version: 1; requestId: string; roomId: string; memberUid: string;
  targetStatus: 'MARKED_AS_PAID'; publicationRequestId: string; expectedRevision: number;
};
export type MarkedPayment = MarkPaymentCommand & { actorUid: string; shareVnd: number; paidAtUtcMs: number | null };
type PaymentErrorCode = 'unauthenticated' | 'permission-denied' | 'invalid-argument' | 'not-found'
  | 'failed-precondition' | 'already-exists' | 'unavailable';
export class PaymentStatusError extends Error {
  constructor(readonly code: PaymentErrorCode) { super(code); this.name = 'PaymentStatusError'; }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function replay(data: Record<string, unknown>, command: MarkPaymentCommand, actorUid: string): MarkedPayment {
  if (data.version !== 1 || data.requestId !== command.requestId || data.roomId !== command.roomId
    || data.actorUid !== actorUid || data.memberUid !== command.memberUid || data.targetStatus !== command.targetStatus
    || data.publicationRequestId !== command.publicationRequestId || data.expectedRevision !== command.expectedRevision) {
    throw new PaymentStatusError('already-exists');
  }
  if (!Number.isSafeInteger(data.shareVnd) || Number(data.shareVnd) <= 0 || !(data.paidAt instanceof Timestamp)) {
    throw new PaymentStatusError('failed-precondition');
  }
  return { ...command, actorUid, shareVnd: Number(data.shareVnd), paidAtUtcMs: data.paidAt.toMillis() };
}

export function createPaymentStatusRepository(dependencies: {
  firestore: Firestore; auth: { currentUser: { uid: string } | null };
}) {
  return {
    async markPaid(command: MarkPaymentCommand, isOnline: boolean): Promise<MarkedPayment> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new PaymentStatusError('unauthenticated');
      if (command.version !== 1 || !UUID.test(command.requestId) || !UUID.test(command.roomId)
        || !UUID.test(command.publicationRequestId) || typeof command.memberUid !== 'string' || !/^[^/]{1,128}$/.test(command.memberUid)
        || command.targetStatus !== 'MARKED_AS_PAID' || !Number.isSafeInteger(command.expectedRevision)
        || command.expectedRevision < 0) throw new PaymentStatusError('invalid-argument');
      if (!isOnline) throw new PaymentStatusError('unavailable');
      const roomRef = doc(dependencies.firestore, 'rooms', command.roomId);
      const memberRef = (uid: string) => doc(dependencies.firestore, 'rooms', command.roomId, 'members', uid);
      const receiptRef = doc(dependencies.firestore, 'rooms', command.roomId, 'billPaymentCommands', command.requestId);
      try {
        const result = await runTransaction(dependencies.firestore, async tx => {
          const [roomSnapshot, host, receipt] = await Promise.all([tx.get(roomRef), tx.get(memberRef(actor.uid)), tx.get(receiptRef)]);
          if (!roomSnapshot.exists()) throw new PaymentStatusError('not-found');
          const room = roomSnapshot.data();
          if (!host.exists() || room.hostId !== actor.uid || host.data().role !== 'HOST' || host.data().status !== 'ACTIVE') {
            throw new PaymentStatusError('permission-denied');
          }
          // Replay trước kiểm tra trạng thái hiện hành để lần xác nhận đã commit không bị tính hai lần.
          if (receipt.exists()) return replay(receipt.data(), command, actor.uid);
          const publication = room.billOverrideRequestId ?? room.billRequestId;
          const count = room.billPaidCount ?? 0;
          if (room.status !== 'COMPLETED' || room.reconciliationStatus !== 'FINALIZED' || room.calculationVersion !== 1
            || publication !== command.publicationRequestId || (room.billRevision ?? 0) !== command.expectedRevision
            || !Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(room.billShareCount)
            || count >= room.billShareCount) throw new PaymentStatusError('failed-precondition');
          const shareRef = typeof room.billOverrideRequestId === 'string'
            ? doc(dependencies.firestore, 'rooms', command.roomId, 'billOverrides', publication, 'shares', command.memberUid)
            : doc(dependencies.firestore, 'rooms', command.roomId, 'billShares', command.memberUid);
          const [share, member, details] = await Promise.all([tx.get(shareRef), tx.get(memberRef(command.memberUid)),
            tx.get(doc(dependencies.firestore, 'rooms', command.roomId, 'settlementDetails', 'current'))]);
          if (!share.exists()) throw new PaymentStatusError('not-found');
          const data = share.data();
          if (!member.exists() || !['ACTIVE', 'EARLY_EXIT'].includes(member.data().status)
            || !details.exists() || !(details.data().expiresAt instanceof Timestamp)
            || data.uid !== command.memberUid || data.requestId !== publication
            || !Number.isSafeInteger(data.shareVnd) || data.shareVnd <= 0
            || (data.paymentStatus ?? 'UNPAID') !== 'UNPAID') throw new PaymentStatusError('failed-precondition');
          tx.update(shareRef, { paymentStatus: command.targetStatus, paidAt: serverTimestamp(),
            paidBy: actor.uid, paymentRequestId: command.requestId });
          tx.update(roomRef, { billPaidCount: count + 1, lastPaymentRequestId: command.requestId });
          tx.set(receiptRef, { ...command, actorUid: actor.uid, shareVnd: data.shareVnd, paidAt: serverTimestamp() });
          return { ...command, actorUid: actor.uid, shareVnd: data.shareVnd, paidAtUtcMs: null } satisfies MarkedPayment;
        });
        if (result.paidAtUtcMs !== null) return result;
        // Commit đã được server chấp nhận; lỗi readback chỉ để timestamp pending, không biến thành thất bại.
        try {
          const receipt = await getDocFromServer(receiptRef);
          return receipt.exists() ? replay(receipt.data(), command, actor.uid) : result;
        } catch { return result; }
      } catch (error) {
        if (error instanceof PaymentStatusError) throw error;
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code).replace(/^firestore\//, '') : '';
        const known: PaymentErrorCode[] = ['unauthenticated', 'permission-denied', 'invalid-argument', 'not-found',
          'failed-precondition', 'already-exists'];
        throw new PaymentStatusError(known.includes(code as PaymentErrorCode) ? code as PaymentErrorCode : 'unavailable');
      }
    },
  };
}
