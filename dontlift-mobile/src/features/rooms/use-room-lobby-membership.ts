import { useCallback, useState, type MutableRefObject } from 'react';
import { Alert } from 'react-native';
import { createLobbyLeaveRepository } from './lobby-leave-repository';
import type { RoomLobbyState } from './room-listener';

type LobbyLeaveRepository = ReturnType<typeof createLobbyLeaveRepository>;

type RoomLobbyMembershipOptions = {
  roomId: string | undefined;
  roomState: RoomLobbyState | null;
  uid: string;
  isStartingRoom: boolean;
  repository: LobbyLeaveRepository;
  busyRefs: { leaving: MutableRefObject<boolean>; removing: MutableRefObject<boolean> };
  onLeft: (roomId: string) => void;
};

export function useRoomLobbyMembership({
  roomId,
  roomState,
  uid,
  isStartingRoom,
  repository,
  busyRefs,
  onLeft,
}: RoomLobbyMembershipOptions) {
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string>();
  const [removingMemberUid, setRemovingMemberUid] = useState<string>();
  const [removeError, setRemoveError] = useState<string>();
  const isBusy = useCallback(() => busyRefs.leaving.current || busyRefs.removing.current, [busyRefs]);
  const clearLeaveError = useCallback(() => setLeaveError(undefined), []);
  const clearRemoveError = useCallback(() => setRemoveError(undefined), []);

  const confirmLeave = useCallback(() => {
    const snapshot = roomState?.kind === 'live' ? roomState.snapshot : undefined;
    if (!roomId || !snapshot || isStartingRoom || isBusy() || snapshot.status !== 'WAITING') return;

    const description = snapshot.hostUid === uid
      ? snapshot.participantCount > 1
        ? 'Host duties will pass to the earliest remaining member. The room will stay open.'
        : 'You are the last member. This will close the room.'
      : 'You will leave this lobby. You can join again with the room PIN while it is waiting.';

    Alert.alert('Leave room?', description, [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave Room', style: 'destructive', onPress: () => {
        if (isBusy()) return;
        busyRefs.leaving.current = true;
        setIsLeaving(true);
        setLeaveError(undefined);
        void repository.leave(roomId).then(() => onLeft(roomId)).catch(error => {
          const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
          setLeaveError(code.includes('permission-denied')
            ? 'Leave was not allowed. The room may have changed, or the room rules need updating.'
            : code ? 'Could not leave the room. Reconnect and try again.'
              : error instanceof Error ? error.message : 'Could not leave the room. Please retry.');
        }).finally(() => { busyRefs.leaving.current = false; setIsLeaving(false); });
      } },
    ]);
  }, [busyRefs, isBusy, isStartingRoom, onLeft, repository, roomId, roomState, uid]);

  const confirmRemoveMember = useCallback((memberUid: string, displayName: string) => {
    const snapshot = roomState?.kind === 'live' ? roomState.snapshot : undefined;
    if (!roomId || memberUid === uid || !snapshot || isStartingRoom || isBusy()
      || snapshot.status !== 'WAITING' || snapshot.hostUid !== uid) return;

    Alert.alert('Remove member?', `Remove ${displayName} from this lobby? They can join again with the PIN.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove Member', style: 'destructive', onPress: () => {
        if (isBusy()) return;
        busyRefs.removing.current = true;
        setRemovingMemberUid(memberUid);
        setRemoveError(undefined);
        void repository.removeMember(roomId, memberUid).catch(error => {
          const isSdkError = typeof error === 'object' && error !== null && 'code' in error;
          setRemoveError(isSdkError ? 'Could not remove this member. Check your connection and host permissions, then retry.'
            : error instanceof Error ? error.message : 'Could not remove this member. Please retry.');
        }).finally(() => { busyRefs.removing.current = false; setRemovingMemberUid(undefined); });
      } },
    ]);
  }, [busyRefs, isBusy, isStartingRoom, repository, roomId, roomState, uid]);

  return {
    isLeaving, leaveError, removingMemberUid, removeError, isBusy, isLeavingRef: busyRefs.leaving,
    clearLeaveError, clearRemoveError, confirmLeave, confirmRemoveMember,
  };
}
