import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Firestore } from 'firebase/firestore';
import { getLocalDatabase } from '../local/database';
import { persistRoomLobbyProjection, type CreatedRoom, type JoinedRoom } from './room-repository';
import { listenToRoomLobby, type RoomLobbyState } from './room-listener';
import type { EarlyExitRequest } from './early-exit-repository';

/** Theo dõi lobby Firestore và cập nhật snapshot/phép chiếu phòng cục bộ. */
export function useRoomLobbySubscription({
  firestore,
  roomId,
  uid,
  lifecycleCutoffs,
  setRoomState,
  setCreatedRoom,
  setJoinedRoom,
  setOpenEarlyExitRequests,
}: {
  firestore: Firestore;
  roomId: string | undefined;
  uid: string;
  lifecycleCutoffs: MutableRefObject<Map<string, number>>;
  setRoomState: Dispatch<SetStateAction<RoomLobbyState | null>>;
  setCreatedRoom: Dispatch<SetStateAction<CreatedRoom | null>>;
  setJoinedRoom: Dispatch<SetStateAction<JoinedRoom | null>>;
  setOpenEarlyExitRequests: Dispatch<SetStateAction<EarlyExitRequest[]>>;
}) {
  useEffect(() => {
    if (!roomId) {
      setRoomState(null);
      setOpenEarlyExitRequests([]);
      return undefined;
    }
    return listenToRoomLobby(firestore, roomId, state => {
      const snapshot = state.snapshot;
      if ((snapshot?.status === 'COMPLETED' || snapshot?.status === 'ABORTED') && snapshot.endedAtUtcMs != null) {
        const ownMember = snapshot.members.find(member => member.uid === uid);
        const cutoffUtcMs = ownMember?.status === 'EARLY_EXIT' && ownMember.earlyExitAtUtcMs != null
          ? Math.min(snapshot.endedAtUtcMs, ownMember.earlyExitAtUtcMs)
          : snapshot.endedAtUtcMs;
        lifecycleCutoffs.current.set(roomId, cutoffUtcMs);
      } else if (snapshot?.status === 'ACTIVE') {
        const ownMember = snapshot.members.find(member => member.uid === uid);
        if (ownMember?.status === 'EARLY_EXIT' && ownMember.earlyExitAtUtcMs != null) {
          lifecycleCutoffs.current.set(roomId, ownMember.earlyExitAtUtcMs);
        }
      }
      setRoomState(state);
      if (snapshot && state.kind === 'live') {
        setCreatedRoom(current => current?.roomId === snapshot.roomId && current.hostUid !== snapshot.hostUid
          ? { ...current, hostUid: snapshot.hostUid } : current);
        setJoinedRoom(current => current?.roomId === snapshot.roomId && current.hostUid !== snapshot.hostUid
          ? { ...current, hostUid: snapshot.hostUid } : current);
      }
    }, snapshot => persistRoomLobbyProjection(getLocalDatabase(), snapshot, uid));
  }, [firestore, roomId, uid, lifecycleCutoffs, setRoomState, setCreatedRoom, setJoinedRoom, setOpenEarlyExitRequests]);
}
