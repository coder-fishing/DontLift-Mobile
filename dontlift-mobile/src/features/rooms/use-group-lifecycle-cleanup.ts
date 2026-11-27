import { useCallback, useRef, type MutableRefObject } from 'react';
import { Alert } from 'react-native';
import { getLocalDatabase } from '../local/database';
import { persistEarlyExitProjection } from './room-repository';
import type { createGroupCaptureWorkTracker } from './group-capture-work';
import type { createGroupViolationRepository } from './group-violation-repository';
import type { RoomLobbySnapshot } from './room-listener';
import type { createBackgroundRecoveryRepository } from '../solo/background-recovery';

type GroupCaptureWorkTracker = ReturnType<typeof createGroupCaptureWorkTracker>;
type GroupViolationRepository = ReturnType<typeof createGroupViolationRepository>;
type BackgroundRecoveryRepository = ReturnType<typeof createBackgroundRecoveryRepository>;

export function useGroupLifecycleCleanup({
  backgroundRecovery,
  violationRepository,
  captureWork,
}: {
  backgroundRecovery: BackgroundRecoveryRepository;
  violationRepository: GroupViolationRepository;
  captureWork: MutableRefObject<Map<string, GroupCaptureWorkTracker>>;
}) {
  const pendingCleanupTasks = useRef(new Map<string, Promise<void>>());

  const reconcileLifecycleAtCutoff = useCallback(async (roomId: string, userId: string, cutoffUtcMs: number) => {
    const result = await backgroundRecovery.reconcileAtCutoff({ sessionId: roomId, userId }, cutoffUtcMs);
    if (result === 'needs-review') {
      Alert.alert(
        'Session recovery needs review',
        'Background time could not be verified. No group violation was added for that interval.',
      );
    }
    return result;
  }, [backgroundRecovery]);

  const runEarlyExitCutoffCleanup = useCallback((input: {
    roomId: string;
    userId: string;
    cutoffUtcMs: number;
    startedAtUtcMs: number;
    historySnapshot?: RoomLobbySnapshot;
  }) => {
    const terminalEnd = input.historySnapshot?.endedAtUtcMs;
    input = { ...input, cutoffUtcMs: terminalEnd == null ? input.cutoffUtcMs : Math.min(input.cutoffUtcMs, terminalEnd) };
    const existingTask = pendingCleanupTasks.current.get(input.roomId);
    if (existingTask) return existingTask;

    const task = (async () => {
      await captureWork.current.get(input.roomId)?.waitForIdle();
      await reconcileLifecycleAtCutoff(input.roomId, input.userId, input.cutoffUtcMs);
      await violationRepository.finalizeOpenAtRoomEnd({
        roomId: input.roomId,
        userId: input.userId,
        endedAtUtcMs: input.cutoffUtcMs,
      });
      await persistEarlyExitProjection(getLocalDatabase(), input);
      captureWork.current.delete(input.roomId);
    })();
    pendingCleanupTasks.current.set(input.roomId, task);
    const clearTask = () => {
      if (pendingCleanupTasks.current.get(input.roomId) === task) pendingCleanupTasks.current.delete(input.roomId);
    };
    void task.then(clearTask, clearTask);
    return task;
  }, [captureWork, reconcileLifecycleAtCutoff, violationRepository]);

  return { reconcileLifecycleAtCutoff, runEarlyExitCutoffCleanup };
}
