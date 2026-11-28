import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { AccelerometerMeasurement } from 'expo-sensors';
import { AppState, Alert, type AppStateStatus } from 'react-native';
import * as Network from 'expo-network';
import { getLocalDatabase } from '../local/database';
import { accelerometerAdapter } from '../sensors/sensor-adapter';
import {
  createForegroundDetectionController,
  type ForegroundDetectionViewState,
} from '../solo/foreground-detection-controller';
import { createSessionLifecycleController } from '../solo/session-lifecycle-controller';
import type { createBackgroundRecoveryRepository } from '../solo/background-recovery';
import type { createFeedbackService } from '../settings/feedback-service';
import { createGroupCaptureWorkTracker } from './group-capture-work';
import { GroupViolationError, type createGroupViolationRepository } from './group-violation-repository';
import type { RoomLobbySnapshot } from './room-listener';

type GroupViolationRepository = ReturnType<typeof createGroupViolationRepository>;
type BackgroundRecoveryRepository = ReturnType<typeof createBackgroundRecoveryRepository>;
type FeedbackService = ReturnType<typeof createFeedbackService>;
type GroupCaptureWorkTracker = ReturnType<typeof createGroupCaptureWorkTracker>;

/** Nối cảm biến, bộ phát hiện vi phạm, vòng đời app và lưu/sync dữ liệu phiên nhóm. */
export function useGroupSessionRuntime({
  snapshot,
  userId,
  repository,
  backgroundRecovery,
  feedbackService,
  lifecycleCutoffs,
  captureWork,
  setDetection,
  setOnline,
  setSyncPendingCount,
  setSyncMessage,
}: {
  snapshot: RoomLobbySnapshot | null;
  userId: string;
  repository: GroupViolationRepository;
  backgroundRecovery: BackgroundRecoveryRepository;
  feedbackService: FeedbackService;
  lifecycleCutoffs: MutableRefObject<Map<string, number>>;
  captureWork: MutableRefObject<Map<string, GroupCaptureWorkTracker>>;
  setDetection: Dispatch<SetStateAction<ForegroundDetectionViewState>>;
  setOnline: Dispatch<SetStateAction<boolean>>;
  setSyncPendingCount: Dispatch<SetStateAction<number>>;
  setSyncMessage: Dispatch<SetStateAction<string | undefined>>;
}) {
  useEffect(() => {
    if (!snapshot || snapshot.status !== 'ACTIVE' || snapshot.startedAtUtcMs == null) {
      setDetection(INITIAL_DETECTION_STATE);
      return undefined;
    }
    const roomId = snapshot.roomId;
    const startedAtUtcMs = snapshot.startedAtUtcMs;
    const workTracker = createGroupCaptureWorkTracker();
    captureWork.current.set(roomId, workTracker);
    const controller = createForegroundDetectionController(
      { id: roomId, userId }, repository,
      () => feedbackService.notifyConfirmedViolation(userId),
    );
    let disposed = false;
    let initialized = false;
    let processing = false;
    let lifecyclePending = false;
    let lifecycleReady = false;
    const startupState = AppState.currentState as AppStateStatus;
    let latestStartupState = startupState;
    const startupTransitions: { state: AppStateStatus; observedAt: ReturnType<typeof backgroundRecovery.captureTime> }[] = [];
    if (startupState !== 'active') startupTransitions.push({ state: startupState, observedAt: backgroundRecovery.captureTime() });
    let lifecycleController: ReturnType<typeof createSessionLifecycleController> | undefined;
    let lastDetectionState = INITIAL_DETECTION_STATE;
    let latestMeasurement: AccelerometerMeasurement | undefined;
    let tickRequested = false;
    let drainWork: Promise<void> = Promise.resolve();

    const refreshPending = async () => {
      try {
        const [pending, failed] = await Promise.all([
          repository.getPendingCount(roomId),
          repository.getFailedCount(roomId),
        ]);
        if (!disposed) {
          setSyncPendingCount(pending);
          setSyncMessage(failed > 0
            ? `${failed} violation${failed === 1 ? '' : 's'} could not sync and remain saved on this device.`
            : pending > 0 ? `${pending} violation${pending === 1 ? '' : 's'} waiting to sync` : undefined);
        }
      } catch {
        if (!disposed) setSyncMessage('Could not check pending sync yet.');
      }
    };

    const drain = () => {
      if (disposed || !initialized || lifecyclePending || AppState.currentState !== 'active') return Promise.resolve();
      if (processing) return drainWork;
      processing = true;
      drainWork = workTracker.track((async () => {
        try {
          while (!disposed && !lifecyclePending && AppState.currentState === 'active' && (latestMeasurement || tickRequested)) {
            if (latestMeasurement) {
              const sample = latestMeasurement;
              latestMeasurement = undefined;
              const next = await controller.observeSample(sample, Date.now());
              if (!disposed) {
                setDetection(next);
                if (lastDetectionState.isViolationActive && !next.isViolationActive) {
                  void repository.syncPending(roomId).then(refreshPending).catch(() => refreshPending());
                }
                lastDetectionState = next;
              }
            } else {
              tickRequested = false;
              const next = await controller.tick(Date.now());
              if (!disposed) {
                setDetection(next);
                if (lastDetectionState.isViolationActive && !next.isViolationActive) {
                  void repository.syncPending(roomId).then(refreshPending).catch(() => refreshPending());
                }
                lastDetectionState = next;
              }
            }
          }
        } catch {
          if (!disposed) setDetection(state => ({
            ...state, persistenceError: 'Could not save the group violation on this device. It will retry automatically.',
          }));
        } finally {
          processing = false;
          if (!disposed && !lifecyclePending && (latestMeasurement || tickRequested)) void drain();
        }
      })());
      return drainWork;
    };

    // Buffer AppState changes while SQLite and the detector initialize.
    const appStateSubscription = AppState.addEventListener('change', state => {
      const wasActive = latestStartupState === 'active';
      latestStartupState = state;
      const observedAt = backgroundRecovery.captureTime();
      if (lifecycleController && lifecycleReady) {
        void workTracker.track(lifecycleController.handleChangeAt(state, observedAt)).catch(() => undefined);
        if (state === 'active') {
          void drain();
          void repository.syncPending(roomId).then(refreshPending).catch(() => refreshPending());
        }
      } else if ((wasActive && state !== 'active') || (!wasActive && state === 'active')) {
        startupTransitions.push({ state, observedAt });
      }
    });

    const initialization = (async () => {
      try {
        const db = await getLocalDatabase();
        await db.runAsync(
          `INSERT INTO sessions (id, user_id, mode, status, duration_seconds, started_at, completed_at, synced_at)
           VALUES (?, ?, 'GROUP', 'ACTIVE', 0, ?, NULL, NULL)
           ON CONFLICT(id) DO UPDATE SET
             user_id = excluded.user_id,
             mode = 'GROUP',
             status = 'ACTIVE',
             started_at = excluded.started_at,
             completed_at = NULL,
             synced_at = NULL`,
          roomId, userId, new Date(startedAtUtcMs).toISOString(),
        );
        const state = await controller.initialize();
        if (disposed) return;
        setDetection(state);
        lastDetectionState = state;
        initialized = true;
        lifecycleController = createSessionLifecycleController({
          session: { sessionId: roomId, userId },
          initialState: 'active',
          repository: {
            begin: input => backgroundRecovery.begin(input),
            reconcile: input => {
              const cutoffUtcMs = lifecycleCutoffs.current.get(input.sessionId);
              return cutoffUtcMs == null
                ? backgroundRecovery.reconcile(input)
                : backgroundRecovery.reconcileAtCutoff(input, cutoffUtcMs);
            },
          },
          captureTime: backgroundRecovery.captureTime,
          getDetector: () => controller,
          onPendingChange: pending => {
            lifecyclePending = pending;
            if (!pending) void drain();
          },
          onRecovered: (recovery, detection) => {
            if (detection) { setDetection(detection); lastDetectionState = detection; }
            void repository.syncPending(roomId).then(refreshPending).catch(() => refreshPending());
            if (recovery === 'needs-review') Alert.alert(
              'Session recovery needs review',
              'Background time could not be verified. No group violation was added for that interval.',
            );
          },
          onError: stage => setDetection(current => ({
            ...current,
            persistenceError: stage === 'begin'
              ? 'Could not save this background transition; its interval may not count.'
              : 'Could not recover the background interval. It remains saved locally for retry.',
          })),
        });
        let replayedStartupTransition = false;
        let reconciledCurrentState = false;
        while (!disposed) {
          while (startupTransitions.length > 0 && !disposed) {
            const transition = startupTransitions.shift()!;
            replayedStartupTransition = true;
            await workTracker.track(lifecycleController.handleChangeAt(transition.state, transition.observedAt));
          }
          if (disposed) return;
          if (!replayedStartupTransition && !reconciledCurrentState) {
            reconciledCurrentState = true;
            await workTracker.track(lifecycleController.reconcileCurrent());
            continue;
          }
          if (startupTransitions.length === 0) break;
        }
        lifecycleReady = true;
        void drain();
        void refreshPending();
      } catch {
        if (!disposed) setDetection(current => ({ ...current, persistenceError: 'Could not load this room’s local violation history.' }));
      }
    })();
    workTracker.track(initialization);

    let sensorSubscription: ReturnType<typeof accelerometerAdapter.subscribe> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      accelerometerAdapter.setUpdateInterval(20);
      sensorSubscription = accelerometerAdapter.subscribe(sample => { latestMeasurement = sample; void drain(); });
      timer = setInterval(() => { tickRequested = true; void drain(); }, 200);
    } catch {
      setDetection(state => ({ ...state, persistenceError: 'Could not start the accelerometer. Check sensor availability.' }));
    }
    const networkSubscription = Network.addNetworkStateListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setOnline(online);
      if (online) void repository.syncPending(roomId).then(refreshPending).catch((error: GroupViolationError) => {
        if (error.code === 'failed-precondition') setSyncMessage('A saved violation is waiting for room reconciliation.');
        else void refreshPending();
      });
    });
    void Network.getNetworkStateAsync().then(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (!disposed) setOnline(online);
      if (online) void repository.syncPending(roomId).then(refreshPending).catch(() => refreshPending());
    }).catch(() => { if (!disposed) setOnline(false); });

    return () => {
      disposed = true;
      sensorSubscription?.remove();
      if (timer) clearInterval(timer);
      appStateSubscription.remove();
      networkSubscription.remove();
      lifecycleController?.dispose();
    };
  }, [snapshot?.roomId, snapshot?.startedAtUtcMs, snapshot?.status, userId, repository, backgroundRecovery,
    feedbackService, lifecycleCutoffs, captureWork, setDetection, setOnline, setSyncPendingCount, setSyncMessage]);
}

const INITIAL_DETECTION_STATE: ForegroundDetectionViewState = {
  orientation: 'UNKNOWN',
  isGraceActive: false,
  isViolationActive: false,
  graceSeconds: 0,
  violationsCount: 0,
  violationDurationSeconds: 0,
};
