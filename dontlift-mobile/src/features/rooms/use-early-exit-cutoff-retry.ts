import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import * as Network from 'expo-network';
import { createEarlyExitCleanupRetry } from './early-exit-cleanup-retry';
import { createEarlyExitSyncRetry } from './early-exit-sync-retry';
import { createGroupViolationRepository } from './group-violation-repository';
import type { RoomLobbySnapshot } from './room-listener';

type GroupViolationRepository = ReturnType<typeof createGroupViolationRepository>;

/** Retry việc chốt dữ liệu tại cutoff và đồng bộ vi phạm sau khi thành viên rời phiên sớm. */
export function useEarlyExitCutoffRetry({
  snapshot,
  uid,
  cutoffUtcMs,
  repository,
  cleanupInFlight,
  runCleanup,
  setOnline,
  setSyncPendingCount,
  setSyncMessage,
}: {
  snapshot: RoomLobbySnapshot | null | undefined;
  uid: string;
  cutoffUtcMs: number | null | undefined;
  repository: GroupViolationRepository;
  cleanupInFlight: MutableRefObject<Set<string>>;
  runCleanup: (input: {
    roomId: string;
    userId: string;
    cutoffUtcMs: number;
    startedAtUtcMs: number;
    historySnapshot?: RoomLobbySnapshot;
  }) => Promise<void>;
  setOnline: Dispatch<SetStateAction<boolean>>;
  setSyncPendingCount: Dispatch<SetStateAction<number>>;
  setSyncMessage: Dispatch<SetStateAction<string | undefined>>;
}) {
  useEffect(() => {
    const ownMember = snapshot?.members.find(member => member.uid === uid);
    if (!snapshot || !['ACTIVE', 'COMPLETED', 'CANCELLED', 'ABORTED'].includes(snapshot.status)
      || ownMember?.status !== 'EARLY_EXIT' || cutoffUtcMs == null || snapshot.startedAtUtcMs == null
      || cleanupInFlight.current.has(snapshot.roomId)) return undefined;

    const roomId = snapshot.roomId;
    const startedAtUtcMs = snapshot.startedAtUtcMs;
    cleanupInFlight.current.add(roomId);
    let disposed = false;
    let localCleanupComplete = false;
    let online = false;
    let networkSubscription: ReturnType<typeof Network.addNetworkStateListener> | undefined;
    let cleanupRetryController: ReturnType<typeof createEarlyExitCleanupRetry> | undefined;
    let retryController: ReturnType<typeof createEarlyExitSyncRetry> | undefined;
    const updateConnection = (state: Awaited<ReturnType<typeof Network.getNetworkStateAsync>>) => {
      if (disposed) return;
      online = state.isConnected === true && state.isInternetReachable !== false;
      setOnline(online);
      if (online) cleanupRetryController?.retryNow();
      retryController?.setOnline(online);
    };
    cleanupRetryController = createEarlyExitCleanupRetry(
      async () => {
        await runCleanup({ roomId, userId: uid, cutoffUtcMs, startedAtUtcMs, historySnapshot: snapshot });
        if (disposed) return;
      },
      {
        onRetrying: () => setSyncMessage('The room approved your exit, but local session cleanup failed. The app will retry automatically.'),
        onComplete: () => {
          localCleanupComplete = true;
          retryController = createEarlyExitSyncRetry(roomId, repository, {
            onPending: count => {
              setSyncPendingCount(count);
              setSyncMessage(`${count} eligible violation${count === 1 ? '' : 's'} waiting to sync. The app will retry while connected.`);
            },
            onDrained: failed => {
              setSyncPendingCount(0);
              setSyncMessage(failed > 0
                ? `${failed} violation${failed === 1 ? '' : 's'} could not sync and remain saved on this device.`
                : undefined);
            },
            onReconciliation: () => setSyncMessage('A saved violation is waiting for room reconciliation.'),
            onRetrying: () => setSyncMessage('Eligible violations are saved on this device. Sync will retry while connected.'),
          });
          retryController.setOnline(online);
        },
      },
    );
    networkSubscription = Network.addNetworkStateListener(updateConnection);
    void Network.getNetworkStateAsync().then(updateConnection).catch(() => undefined);
    cleanupRetryController.start();
    return () => {
      disposed = true;
      if (!localCleanupComplete) cleanupInFlight.current.delete(roomId);
      cleanupRetryController?.dispose();
      retryController?.dispose();
      networkSubscription?.remove();
    };
  }, [snapshot?.roomId, snapshot?.status, snapshot?.startedAtUtcMs, uid, cutoffUtcMs,
    repository, cleanupInFlight, runCleanup, setOnline, setSyncPendingCount, setSyncMessage]);
}
