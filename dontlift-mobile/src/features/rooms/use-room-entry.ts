import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ScreenId } from '../../types';
import {
  RoomCreateError,
  RoomJoinError,
  createRoomRepository,
  roomJoinErrorMessage,
  type CreatedRoom,
  type JoinedRoom,
} from './room-repository';
import { roomCreateErrorMessage } from './room-create-error';

type RoomRepository = ReturnType<typeof createRoomRepository>;

type Options = {
  repository: RoomRepository;
  displayName: string;
  setCurrentScreen: Dispatch<SetStateAction<ScreenId>>;
  setCreatedRoom: Dispatch<SetStateAction<CreatedRoom | null>>;
  setJoinedRoom: Dispatch<SetStateAction<JoinedRoom | null>>;
  restoredRoomId: MutableRefObject<string | null>;
  createRequestId: () => string;
};

export function useRoomEntry({
  repository,
  displayName,
  setCurrentScreen,
  setCreatedRoom,
  setJoinedRoom,
  restoredRoomId,
  createRequestId,
}: Options) {
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomCreateError, setRoomCreateError] = useState<string>();
  const pendingRoomCommand = useRef<ReturnType<RoomRepository['createCommand']> | null>(null);
  const roomCreateAttempt = useRef(0);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [roomJoinError, setRoomJoinError] = useState<string>();
  const pendingRoomJoinCommand = useRef<{ requestId: string; pin: string } | null>(null);

  const handleCreateRoom = useCallback(async () => {
    if (isCreatingRoom) return;
    const attemptId = ++roomCreateAttempt.current;
    setIsCreatingRoom(true);
    setRoomCreateError(undefined);
    const command = pendingRoomCommand.current ?? repository.createCommand();
    pendingRoomCommand.current = command;
    try {
      const result = await repository.createRoom(displayName, command);
      if (attemptId !== roomCreateAttempt.current) return;
      pendingRoomCommand.current = null;
      setJoinedRoom(null);
      restoredRoomId.current = null;
      setCreatedRoom(result);
    } catch (error) {
      if (!(error instanceof RoomCreateError) || error.code !== 'unavailable') pendingRoomCommand.current = null;
      if (attemptId !== roomCreateAttempt.current) return;
      if (__DEV__ && error instanceof RoomCreateError) {
        console.warn('[room-create] failed', JSON.stringify({
          code: error.code, stage: error.stage, firebaseCode: error.firebaseCode,
        }));
      }
      setRoomCreateError(roomCreateErrorMessage(error));
    } finally {
      if (attemptId === roomCreateAttempt.current) setIsCreatingRoom(false);
    }
  }, [displayName, isCreatingRoom, repository, restoredRoomId, setCreatedRoom, setJoinedRoom]);

  const cancelRoomCreateAndJoin = useCallback(() => {
    // Firestore transactions cannot be cancelled after submission; ignore late results but keep retry identity.
    roomCreateAttempt.current += 1;
    setIsCreatingRoom(false);
    setRoomCreateError(undefined);
    setJoinedRoom(null);
    setRoomJoinError(undefined);
    pendingRoomJoinCommand.current = null;
    setCurrentScreen('12-join-room');
  }, [setCurrentScreen, setJoinedRoom]);

  const openJoinRoom = useCallback((clearRoomErrors: () => void) => {
    setJoinedRoom(null);
    clearRoomErrors();
    setRoomJoinError(undefined);
    pendingRoomJoinCommand.current = null;
    setCurrentScreen('12-join-room');
  }, [setCurrentScreen, setJoinedRoom]);

  const handleJoinRoom = useCallback(async (pin: string) => {
    if (isJoiningRoom) return;
    setIsJoiningRoom(true);
    setRoomJoinError(undefined);
    const command = pendingRoomJoinCommand.current?.pin === pin
      ? pendingRoomJoinCommand.current
      : { requestId: createRequestId(), pin };
    pendingRoomJoinCommand.current = command;
    try {
      const result = await repository.joinRoomByPin(command);
      pendingRoomJoinCommand.current = null;
      setCreatedRoom(null);
      restoredRoomId.current = null;
      setJoinedRoom(result);
    } catch (error) {
      if (!(error instanceof RoomJoinError) || error.code !== 'unavailable') pendingRoomJoinCommand.current = null;
      if (__DEV__ && error instanceof RoomJoinError) {
        console.warn('[room-join] failed', JSON.stringify({ code: error.code, firebaseCode: error.firebaseCode }));
      }
      setRoomJoinError(roomJoinErrorMessage(error));
    } finally {
      setIsJoiningRoom(false);
    }
  }, [createRequestId, isJoiningRoom, repository, restoredRoomId, setCreatedRoom, setJoinedRoom]);

  const cancelRoomJoin = useCallback(() => {
    if (isJoiningRoom) return;
    setCurrentScreen('05-group-lobby');
    setRoomJoinError(undefined);
    pendingRoomJoinCommand.current = null;
  }, [isJoiningRoom, setCurrentScreen]);

  const clearPendingRoomCommands = useCallback(() => {
    pendingRoomCommand.current = null;
    pendingRoomJoinCommand.current = null;
  }, []);

  return {
    isCreatingRoom,
    roomCreateError,
    isJoiningRoom,
    roomJoinError,
    handleCreateRoom,
    cancelRoomCreateAndJoin,
    openJoinRoom,
    handleJoinRoom,
    cancelRoomJoin,
    clearPendingRoomCommands,
  };
}
