import {
  doc, getDocFromServer, onSnapshot, runTransaction, serverTimestamp, Timestamp, type Firestore,
} from 'firebase/firestore';

export type SettlementDetailsInput = {
  roomId: string;
  bankId: string;
  accountNumber: string;
  accountName: string;
};

export type SettlementDetails = SettlementDetailsInput & {
  version: 1;
  updatedAtUtcMs: number | null;
  expiresAtUtcMs: number;
};

export type SettlementDetailsState =
  | { kind: 'loading' | 'unavailable' | 'error' }
  | { kind: 'ready'; details: SettlementDetails };

export type SettlementDetailsErrorCode =
  | 'unauthenticated' | 'invalid-argument' | 'not-found' | 'failed-precondition'
  | 'permission-denied' | 'unavailable';

export class SettlementDetailsError extends Error {
  constructor(readonly code: SettlementDetailsErrorCode, readonly firebaseCode?: string) {
    super(code);
    this.name = 'SettlementDetailsError';
  }
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELD_LIMITS = { bankId: 32, accountNumber: 64, accountName: 100 } as const;

function mapError(error: unknown): never {
  if (error instanceof SettlementDetailsError) throw error;
  const firebaseCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code) : undefined;
  const code = firebaseCode?.replace(/^firestore\//, '').replace(/^auth\//, '');
  const mapped: SettlementDetailsErrorCode = code === 'unauthenticated' ? 'unauthenticated'
    : code === 'invalid-argument' ? 'invalid-argument'
      : code === 'not-found' ? 'not-found'
        : code === 'failed-precondition' ? 'failed-precondition'
          : code === 'permission-denied' ? 'permission-denied' : 'unavailable';
  throw new SettlementDetailsError(mapped, firebaseCode);
}

function cleanInput(input: SettlementDetailsInput): SettlementDetailsInput {
  const cleaned = {
    roomId: input.roomId.trim(),
    bankId: input.bankId.trim(),
    accountNumber: input.accountNumber.trim(),
    accountName: input.accountName.trim(),
  };
  if (!UUID_V4.test(cleaned.roomId)
    || !cleaned.bankId || cleaned.bankId.length > FIELD_LIMITS.bankId
    || !cleaned.accountNumber || cleaned.accountNumber.length > FIELD_LIMITS.accountNumber
    || !cleaned.accountName || cleaned.accountName.length > FIELD_LIMITS.accountName) {
    throw new SettlementDetailsError('invalid-argument');
  }
  return cleaned;
}

function toDetails(roomId: string, data: Record<string, unknown>): SettlementDetails | null {
  if (typeof data.bankId !== 'string' || typeof data.accountNumber !== 'string'
    || typeof data.accountName !== 'string' || !(data.expiresAt instanceof Timestamp)) return null;
  return {
    version: 1,
    roomId,
    bankId: data.bankId,
    accountNumber: data.accountNumber,
    accountName: data.accountName,
    updatedAtUtcMs: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : null,
    expiresAtUtcMs: data.expiresAt.toMillis(),
  };
}

export function createSettlementDetailsRepository(dependencies: {
  firestore: Firestore;
  auth: { currentUser: { uid: string } | null };
}) {
  const roomRef = (roomId: string) => doc(dependencies.firestore, 'rooms', roomId);
  const memberRef = (roomId: string, uid: string) => doc(dependencies.firestore, 'rooms', roomId, 'members', uid);
  const detailsRef = (roomId: string) => doc(dependencies.firestore, 'rooms', roomId, 'settlementDetails', 'current');

  return {
    listen(roomId: string, onState: (state: SettlementDetailsState) => void): () => void {
      if (!dependencies.auth.currentUser || !UUID_V4.test(roomId)) {
        onState({ kind: 'unavailable' });
        return () => undefined;
      }
      onState({ kind: 'loading' });
      return onSnapshot(detailsRef(roomId), { includeMetadataChanges: true }, snapshot => {
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
          onState({ kind: 'loading' });
          return;
        }
        const details = snapshot.exists() ? toDetails(roomId, snapshot.data()) : null;
        onState(details ? { kind: 'ready', details } : { kind: 'unavailable' });
      }, () => onState({ kind: 'error' }));
    },

    async read(roomId: string): Promise<SettlementDetails | null> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new SettlementDetailsError('unauthenticated');
      if (!UUID_V4.test(roomId)) throw new SettlementDetailsError('invalid-argument');
      try {
        const snapshot = await getDocFromServer(detailsRef(roomId));
        return snapshot.exists() ? toDetails(roomId, snapshot.data()) : null;
      } catch (error) { return mapError(error); }
    },

    async save(input: SettlementDetailsInput): Promise<{ version: 1; roomId: string; expiresAtUtcMs: number }> {
      const actor = dependencies.auth.currentUser;
      if (!actor) throw new SettlementDetailsError('unauthenticated');
      const cleaned = cleanInput(input);
      const hostRef = memberRef(cleaned.roomId, actor.uid);
      const detailsDocument = detailsRef(cleaned.roomId);
      try {
        const expiresAt = await runTransaction(dependencies.firestore, async transaction => {
          const [room, host] = await Promise.all([
            transaction.get(roomRef(cleaned.roomId)), transaction.get(hostRef),
          ]);
          if (!room.exists()) throw new SettlementDetailsError('not-found');
          const roomData = room.data();
          if (roomData.status !== 'COMPLETED' || roomData.reconciliationStatus !== 'FINALIZED'
            || !(roomData.endedAt instanceof Timestamp)) {
            throw new SettlementDetailsError('failed-precondition');
          }
          if (roomData.hostId !== actor.uid || !host.exists()
            || host.data().role !== 'HOST' || host.data().status !== 'ACTIVE') {
            throw new SettlementDetailsError('permission-denied');
          }
          const end = roomData.endedAt as Timestamp;
          // Giữ nguyên nanosecond từ endedAt để khớp phép tính expiry trong Rules.
          const expiry = new Timestamp(end.seconds + 30 * 24 * 60 * 60, end.nanoseconds);
          transaction.set(detailsDocument, {
            bankId: cleaned.bankId,
            accountNumber: cleaned.accountNumber,
            accountName: cleaned.accountName,
            updatedAt: serverTimestamp(),
            expiresAt: expiry,
          });
          return expiry;
        });
        return { version: 1, roomId: cleaned.roomId, expiresAtUtcMs: expiresAt.toMillis() };
      } catch (error) { return mapError(error); }
    },
  };
}
