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
};

export type RoomLobbySnapshot = {
  roomId: string;
  hostUid: string;
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABORTED';
  participantCount: number;
  startedAtUtcMs: number | null;
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
): Unsubscribe {
  let active = true;
  let roomValue: Omit<RoomLobbySnapshot, 'members'> | null = null;
  let members: RoomLobbyMember[] = [];
  let roomReady = false;
  let membersReady = false;
  let roomFromCache = true;
  let membersFromCache = true;
  let latest: RoomLobbySnapshot | null = null;
  const publish = () => {
    if (!active) return;
    if (roomReady && membersReady && roomValue) {
      latest = { ...roomValue, members };
      onState({ kind: roomFromCache || membersFromCache ? 'cached' : 'live', snapshot: latest });
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
    roomValue = {
      roomId,
      hostUid: String(data.hostId ?? ''),
      status: data.status,
      participantCount: Number(data.participantCount ?? 0),
      startedAtUtcMs: startedAt instanceof Timestamp ? startedAt.toMillis() : null,
    };
    roomReady = true;
    publish();
  }, () => {
    if (active) onState({ kind: 'error', snapshot: latest });
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
        };
      });
      membersReady = true;
      publish();
    }, () => {
      if (active) onState({ kind: 'error', snapshot: latest });
    },
  );
  return () => {
    active = false;
    stopRoom();
    stopMembers();
  };
}
