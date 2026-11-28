import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { getLocalDatabase } from '../local/database';
import { persistTerminalRoomProjection, type CreatedRoom, type JoinedRoom } from './room-repository';
import type { createGroupCaptureWorkTracker } from './group-capture-work';
import type { createGroupViolationRepository } from './group-violation-repository';
import { shouldNavigateToGroupSummary } from './group-terminal-navigation';
import type { RoomLobbySnapshot, RoomLobbyState } from './room-listener';
import type { ScreenId } from '../../types';

type GroupCaptureWorkTracker = ReturnType<typeof createGroupCaptureWorkTracker>;
type GroupViolationRepository = ReturnType<typeof createGroupViolationRepository>;

/** Dọn dữ liệu phiên và điều hướng sang tổng kết khi phòng chuyển sang trạng thái kết thúc. */
export function useGroupTerminalLifecycle({
  roomState,
  currentScreen,
  uid,
  violationRepository,
  cleanupInFlight,
  restoredRoomId,
  captureWork,
  setCurrentScreen,
  setCreatedRoom,
  setJoinedRoom,
  reconcileLifecycleAtCutoff,
  runEarlyExitCutoffCleanup,
}: {
  roomState: RoomLobbyState | null;
  currentScreen: ScreenId;
  uid: string;
  violationRepository: GroupViolationRepository;
  cleanupInFlight: MutableRefObject<Set<string>>;
  restoredRoomId: MutableRefObject<string | null>;
  captureWork: MutableRefObject<Map<string, GroupCaptureWorkTracker>>;
  setCurrentScreen: Dispatch<SetStateAction<ScreenId>>;
  setCreatedRoom: Dispatch<SetStateAction<CreatedRoom | null>>;
  setJoinedRoom: Dispatch<SetStateAction<JoinedRoom | null>>;
  reconcileLifecycleAtCutoff: (roomId: string, userId: string, cutoffUtcMs: number) => Promise<unknown>;
  runEarlyExitCutoffCleanup: (input: {
    roomId: string;
    userId: string;
    cutoffUtcMs: number;
    startedAtUtcMs: number;
    historySnapshot?: RoomLobbySnapshot;
  }) => Promise<void>;
}) {
  useEffect(() => {
    const snapshot = roomState?.snapshot;
    const isTerminalRoom = snapshot?.status === 'COMPLETED' || snapshot?.status === 'ABORTED' || snapshot?.status === 'CANCELLED';
    if (roomState && snapshot && isTerminalRoom && snapshot.endedAtUtcMs !== null && snapshot.endedAtUtcMs !== undefined
      && !(snapshot.status === 'CANCELLED' && snapshot.startedAtUtcMs === null)
      && ['live', 'cached'].includes(roomState.kind)
      && !cleanupInFlight.current.has(snapshot.roomId)) {
      const roomId = snapshot.roomId;
      const endedAtUtcMs = snapshot.endedAtUtcMs;
      const shouldShowSummary = shouldNavigateToGroupSummary({
        roomId: snapshot.roomId,
        roomStatus: snapshot.status,
        restoredRoomId: restoredRoomId.current,
        isRoomMember: snapshot.members.some(member => member.uid === uid),
      });
      const ownMember = snapshot.members.find(member => member.uid === uid);
      const earlyExitCutoffUtcMs = ownMember?.status === 'EARLY_EXIT' ? ownMember.earlyExitAtUtcMs : null;
      const startedAtUtcMs = snapshot.startedAtUtcMs;
      cleanupInFlight.current.add(roomId);
      // Firestore remains the source for Summary; local projection is best-effort.
      if (shouldShowSummary) setCurrentScreen('13-group-summary');
      void (async () => {
        try {
          await captureWork.current.get(roomId)?.waitForIdle();
          if (snapshot.status === 'COMPLETED' || snapshot.status === 'ABORTED' || snapshot.status === 'CANCELLED') {
            const cutoffUtcMs = earlyExitCutoffUtcMs == null
              ? endedAtUtcMs : Math.min(endedAtUtcMs, earlyExitCutoffUtcMs);
            await reconcileLifecycleAtCutoff(roomId, uid, cutoffUtcMs);
          }
          if (earlyExitCutoffUtcMs != null && startedAtUtcMs != null) {
            await runEarlyExitCutoffCleanup({
              roomId,
              userId: uid,
              cutoffUtcMs: Math.min(earlyExitCutoffUtcMs, snapshot.endedAtUtcMs!),
              startedAtUtcMs,
              historySnapshot: snapshot,
            });
          }
          await violationRepository.finalizeOpenAtRoomEnd({ roomId, userId: uid, endedAtUtcMs });
          if (snapshot.reconciliationStatus === 'FINALIZED' && snapshot.finalizationReason === 'HOST_OVERRIDE') {
            await violationRepository.syncPending(roomId).catch(() => undefined);
          }
          await persistTerminalRoomProjection(getLocalDatabase(), {
            roomId,
            userId: uid,
            status: snapshot.status as 'COMPLETED' | 'ABORTED' | 'CANCELLED',
            endedAtUtcMs,
            reconciliationStatus: snapshot.reconciliationStatus,
            pendingMemberCount: snapshot.pendingMemberCount,
            finalizationReason: snapshot.finalizationReason,
            historySnapshot: snapshot,
          });
          if (restoredRoomId.current === roomId) restoredRoomId.current = null;
          if (snapshot.status !== 'COMPLETED') {
            setCreatedRoom(current => current?.roomId === roomId ? null : current);
            setJoinedRoom(current => current?.roomId === roomId ? null : current);
            setCurrentScreen(current => current === '06-group-active' ? '05-group-lobby' : current);
          }
        } catch (error) {
          cleanupInFlight.current.delete(roomId);
          if (__DEV__) console.warn('[group-terminal] local projection cleanup failed', error);
        }
      })();
    }
    const ownMembershipCanView = snapshot?.members.some(member => member.uid === uid
      && ['ACTIVE', 'EARLY_EXIT'].includes(member.status)) === true;
    const isRestoredRoom = snapshot?.roomId === restoredRoomId.current && currentScreen === '02-solo-select';
    if (roomState && snapshot?.status === 'ACTIVE' && snapshot.startedAtUtcMs !== null && ownMembershipCanView
      && ['live', 'cached'].includes(roomState.kind)
      && (currentScreen === '05-group-lobby' || isRestoredRoom)) {
      setCurrentScreen('06-group-active');
      restoredRoomId.current = null;
    }
  }, [roomState, currentScreen, uid, violationRepository, reconcileLifecycleAtCutoff, runEarlyExitCutoffCleanup]);
}
