import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { getLocalDatabase } from '../local/database';
import { restoreCachedActiveRoom, type CreatedRoom } from './room-repository';

/** Khôi phục phòng đang chờ hoặc đang chạy từ SQLite sau khi người dùng đăng nhập lại. */
export function useCachedRoomRestore({
  uid,
  restoredRoomId,
  setCreatedRoom,
}: {
  uid: string;
  restoredRoomId: MutableRefObject<string | null>;
  setCreatedRoom: Dispatch<SetStateAction<CreatedRoom | null>>;
}) {
  useEffect(() => {
    let active = true;
    void restoreCachedActiveRoom(getLocalDatabase(), uid).then(room => {
      if (!active || !room) return;
      setCreatedRoom(current => {
        if (current) return current;
        restoredRoomId.current = room.roomId;
        return room;
      });
    }).catch(() => {
      // Local restore must not block sign-in; the cloud listener can restore the room later.
    });
    return () => { active = false; };
  }, [uid, restoredRoomId, setCreatedRoom]);
}
