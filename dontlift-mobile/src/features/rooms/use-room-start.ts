import { useCallback, useRef, useState } from 'react';
import { RoomStartError, createRoomRepository, roomStartErrorMessage } from './room-repository';

type RoomRepository = ReturnType<typeof createRoomRepository>;

export function useRoomStart(repository: RoomRepository, roomId: string | undefined, isBlocked: () => boolean) {
  const [isStartingRoom, setIsStartingRoom] = useState(false);
  const [roomStartError, setRoomStartError] = useState<string>();
  const pendingCommand = useRef<ReturnType<RoomRepository['startCommand']> | null>(null);

  const startRoom = useCallback(async () => {
    if (!roomId || isStartingRoom || isBlocked()) return;
    setIsStartingRoom(true);
    setRoomStartError(undefined);
    const command = pendingCommand.current?.roomId === roomId
      ? pendingCommand.current
      : repository.startCommand(roomId);
    pendingCommand.current = command;
    try {
      await repository.startRoom(command);
      pendingCommand.current = null;
    } catch (error) {
      if (!(error instanceof RoomStartError) || error.code !== 'unavailable') pendingCommand.current = null;
      if (__DEV__ && error instanceof RoomStartError) {
        console.warn('[room-start] failed', JSON.stringify({ code: error.code, firebaseCode: error.firebaseCode }));
      }
      setRoomStartError(roomStartErrorMessage(error));
    } finally {
      setIsStartingRoom(false);
    }
  }, [isBlocked, isStartingRoom, repository, roomId]);

  const clearPendingStart = useCallback(() => {
    pendingCommand.current = null;
  }, []);

  return { isStartingRoom, roomStartError, startRoom, clearPendingStart };
}
