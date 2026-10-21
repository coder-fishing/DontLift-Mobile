import {
  collection, doc, onSnapshot, orderBy, query, Timestamp, type Firestore, type Unsubscribe,
} from 'firebase/firestore';

export type RoomLobbyMember = {
  uid: string;
  displayName: string;
  role: 'HOST' | 'MEMBER';
  status: string;
  penaltyScore: number;
  liftCount: number;
  violationDurationSeconds: number;
  joinedAt: string | null;
  earlyExitAtUtcMs?: number | null;
  syncAcknowledgedAtUtcMs?: number | null;
};

export type RoomLobbySnapshot = {
  roomId: string;
  hostUid: string;
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ABORTED';
  participantCount: number;
  activeMemberCount?: number | null;
  startedAtUtcMs: number | null;
  endedAtUtcMs?: number | null;
  reconciliationStatus?: 'PENDING' | 'FINALIZED' | null;
  pendingMemberCount?: number | null;
  finalizationReason?: 'ALL_SYNCED' | 'HOST_OVERRIDE' | null;
  pin: string;
  createdAt: string | null;
  updatedAt: string | null;
  members: RoomLobbyMember[];
};

export type RoomLobbyState =
  | { kind: 'loading'; snapshot: null }
  | { kind: 'live'; snapshot: RoomLobbySnapshot }
  | { kind: 'cached'; snapshot: RoomLobbySnapshot }
  | { kind: 'error'; snapshot: RoomLobbySnapshot | null };

export function listenToRoomLobby(
  firestore: Firestore,
  roomId: string,
  onState: (state: RoomLobbyState) => void,
  persistSnapshot?: (snapshot: RoomLobbySnapshot) => Promise<void>,
): Unsubscribe {
  let active = true;
  let roomValue: Omit<RoomLobbySnapshot, 'members'> | null = null;
  let members: RoomLobbyMember[] = [];
  let roomReady = false;
  let membersReady = false;
  let roomFromCache = true;
  let membersFromCache = true;
  let roomListenerFailed = false;
  let membersListenerFailed = false;
  let latest: RoomLobbySnapshot | null = null;
  let persistTail = Promise.resolve();
  const publish = () => {
    if (!active) return;
    if (roomReady && membersReady && roomValue) {
      latest = { ...roomValue, members };
      if (persistSnapshot && !roomListenerFailed && !membersListenerFailed) {
        const snapshotToPersist = latest;
        // Ghi tuần tự để snapshot cũ không hoàn tất sau và ghi đè roster mới hơn.
        persistTail = persistTail.then(() => persistSnapshot(snapshotToPersist)).catch(error => {
          if (__DEV__) console.warn('[room-lobby] local projection failed', error);
        });
      }
      const kind = roomListenerFailed || membersListenerFailed
        ? 'error'
        : roomFromCache || membersFromCache ? 'cached' : 'live';
      onState({ kind, snapshot: latest });
    }
  };

  onState({ kind: 'loading', snapshot: null });
  const stopRoom = onSnapshot(doc(firestore, 'rooms', roomId), { includeMetadataChanges: true }, snapshot => {
    if (!active) return;
    if (!snapshot.exists()) {
      onState({ kind: 'error', snapshot: latest });
      return;
    }
    const data = snapshot.data();
    roomFromCache = snapshot.metadata.fromCache;
    const startedAt = data.startedAt;
    const endedAt = data.endedAt;
    const createdAt = data.createdAt;
    const updatedAt = data.updatedAt;
    roomValue = {
      roomId,
      hostUid: String(data.hostId ?? ''),
      status: data.status,
      participantCount: Number(data.participantCount ?? 0),
      activeMemberCount: Number.isInteger(data.activeMemberCount) ? Number(data.activeMemberCount) : null,
      startedAtUtcMs: startedAt instanceof Timestamp ? startedAt.toMillis() : null,
      endedAtUtcMs: endedAt instanceof Timestamp ? endedAt.toMillis() : null,
      reconciliationStatus: data.reconciliationStatus === 'PENDING' || data.reconciliationStatus === 'FINALIZED'
        ? data.reconciliationStatus : null,
      pendingMemberCount: Number.isInteger(data.pendingMemberCount) ? Number(data.pendingMemberCount) : null,
      finalizationReason: data.finalizationReason === 'ALL_SYNCED' || data.finalizationReason === 'HOST_OVERRIDE'
        ? data.finalizationReason : null,
      pin: String(data.pin ?? ''),
      createdAt: createdAt instanceof Timestamp ? createdAt.toDate().toISOString() : null,
      updatedAt: updatedAt instanceof Timestamp ? updatedAt.toDate().toISOString() : null,
    };
    roomReady = true;
    publish();
  }, () => {
    if (active) {
      roomListenerFailed = true;
      onState({ kind: 'error', snapshot: latest });
    }
  });
  const stopMembers = onSnapshot(
    query(collection(firestore, 'rooms', roomId, 'members'), orderBy('joinedAt', 'asc')),
    { includeMetadataChanges: true },
    snapshot => {
      if (!active) return;
      membersFromCache = snapshot.metadata.fromCache;
      members = snapshot.docs.map(memberDoc => {
        const data = memberDoc.data();
        return {
          uid: memberDoc.id,
          displayName: String(data.displayName ?? ''),
          role: data.role === 'HOST' ? 'HOST' : 'MEMBER',
          status: String(data.status ?? ''),
          penaltyScore: Number(data.penaltyScore ?? 0),
          liftCount: Number(data.liftCount ?? 0),
          violationDurationSeconds: Number(data.violationDurationSeconds ?? 0),
          joinedAt: data.joinedAt instanceof Timestamp ? data.joinedAt.toDate().toISOString() : null,
          earlyExitAtUtcMs: data.earlyExitAt instanceof Timestamp ? data.earlyExitAt.toMillis() : null,
          syncAcknowledgedAtUtcMs: data.syncAcknowledgedAt instanceof Timestamp ? data.syncAcknowledgedAt.toMillis() : null,
        };
      });
      membersReady = true;
      publish();
    }, () => {
      if (active) {
        membersListenerFailed = true;
        onState({ kind: 'error', snapshot: latest });
      }
    },
  );
  return () => {
    active = false;
    stopRoom();
    stopMembers();
  };
}
