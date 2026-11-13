import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AccelerometerMeasurement } from 'expo-sensors';
import { Alert, AppState, BackHandler, Platform } from 'react-native';
import * as Network from 'expo-network';
import { ScreenId } from '../../../types';
import { accelerometerAdapter } from '../../sensors/sensor-adapter';
import { createLocalSessionRepository } from '../local-session-repository';
import { createSoloSessionController, getSoloSessionTime, type SoloSession } from '../session-controller';
import { createSoloSessionCompletionController } from '../session-completion-controller';
import { createSoloSummaryRepository, type SoloSessionSummary } from '../summary-service';
import { createViolationRepository } from '../violation-repository';
import { createBackgroundRecoveryRepository } from '../background-recovery';
import { createSessionLifecycleController } from '../session-lifecycle-controller';
import {
  createForegroundDetectionController,
  type ForegroundDetectionController,
  type ForegroundDetectionViewState,
} from '../foreground-detection-controller';
import { createOutboxSyncRepository } from '../../sync/outbox-repository';
import { createSoloSyncWorker } from '../../sync/sync-worker';
import { createFirestoreSoloSyncPort } from '../../sync/firestore-solo-sync-port';
import { getConfiguredFirebaseRuntime } from '../../auth/firebase-adapters';
import { getLocalDatabase } from '../../local/database';

const soloSessionController = createSoloSessionController(createLocalSessionRepository());
const soloCompletionController = createSoloSessionCompletionController(createSoloSummaryRepository());
const violationRepository = createViolationRepository();

const INITIAL_DETECTION_STATE: ForegroundDetectionViewState = {
  orientation: 'UNKNOWN',
  isGraceActive: false,
  isViolationActive: false,
  graceSeconds: 0,
  violationsCount: 0,
  violationDurationSeconds: 0,
};

type BackgroundRecoveryRepository = ReturnType<typeof createBackgroundRecoveryRepository>;
type FeedbackService = {
  notifyConfirmedViolation(userId: string): Promise<void>;
  notifySoloSessionCompleted(): Promise<void>;
};

type SoloSessionRuntimeOptions = {
  userId: string;
  currentScreen: ScreenId;
  setCurrentScreen: Dispatch<SetStateAction<ScreenId>>;
  backgroundRecovery: BackgroundRecoveryRepository;
  feedbackService: FeedbackService;
  sensorReady: boolean;
};

export function useSoloSessionRuntime({
  userId,
  currentScreen,
  setCurrentScreen,
  backgroundRecovery,
  feedbackService,
  sensorReady,
}: SoloSessionRuntimeOptions) {
  const [selectedDuration, setSelectedDuration] = useState<number>(25);
  const [selectedMode, setSelectedMode] = useState<'COUNTDOWN' | 'STOPWATCH'>('COUNTDOWN');
  const [activeSoloSession, setActiveSoloSession] = useState<SoloSession | null>(null);
  const [soloNow, setSoloNow] = useState<number>(Date.now());
  const [isStartingSolo, setIsStartingSolo] = useState(false);
  const [isCancellingSolo, setIsCancellingSolo] = useState(false);
  const [isCompletingSolo, setIsCompletingSolo] = useState(false);
  const [soloCompletionError, setSoloCompletionError] = useState<string | undefined>();
  const [soloSummary, setSoloSummary] = useState<SoloSessionSummary | null>(null);
  const [soloSummaryPendingView, setSoloSummaryPendingView] = useState(false);
  const [soloSyncState, setSoloSyncState] = useState<{
    sessionId: string;
    status: 'syncing' | 'pending' | 'synced' | 'failed';
  } | null>(null);
  const [foregroundDetection, setForegroundDetection] = useState<ForegroundDetectionViewState>(INITIAL_DETECTION_STATE);
  const [isRecoveringBackground, setIsRecoveringBackground] = useState(false);
  const [soloStartError, setSoloStartError] = useState<string | undefined>();

  const soloSyncWorker = useRef<ReturnType<typeof createSoloSyncWorker> | null>(null);
  const foregroundDetectionController = useRef<ForegroundDetectionController | null>(null);
  const soloStartPending = useRef(false);
  const completionAttemptedSessionId = useRef<string | null>(null);
  const backgroundRecoveryPending = useRef(false);
  const isMounted = useRef(false);
  const soloLifecycle = useRef<{
    sessionId: string;
    controller: ReturnType<typeof createSessionLifecycleController>;
    subscription: ReturnType<typeof AppState.addEventListener>;
  } | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    let disposed = false;
    let appStateSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
    let networkSubscription: ReturnType<typeof Network.addNetworkStateListener> | undefined;
    let worker: ReturnType<typeof createSoloSyncWorker> | undefined;
    void (async () => {
      try {
        const [database, runtime] = await Promise.all([
          getLocalDatabase(),
          Promise.resolve(getConfiguredFirebaseRuntime(Platform.OS, __DEV__)),
        ]);
        if (disposed) return;
        worker = createSoloSyncWorker({
          userId,
          getCurrentUserId: () => runtime.auth.currentUser?.uid ?? null,
          repository: createOutboxSyncRepository(database),
          transport: createFirestoreSoloSyncPort({
            firestore: runtime.firestore,
            auth: runtime.auth,
            userId,
          }),
          onStatusChange: (sessionId, status) => {
            if (!disposed) setSoloSyncState({ sessionId, status });
          },
        });
        soloSyncWorker.current = worker;
        appStateSubscription = AppState.addEventListener('change', (state) => {
          if (state === 'active') void worker?.kick();
        });
        networkSubscription = Network.addNetworkStateListener((state) => {
          if (state.isConnected && state.isInternetReachable !== false) void worker?.kick();
        });
        void worker.kick();
      } catch {
      }
    })();
    return () => {
      disposed = true;
      appStateSubscription?.remove();
      networkSubscription?.remove();
      worker?.dispose();
      if (soloSyncWorker.current === worker) soloSyncWorker.current = null;
    };
  }, [userId]);

  useEffect(() => {
    if (soloSummary) void soloSyncWorker.current?.kick({ sessionId: soloSummary.sessionId });
  }, [soloSummary]);

  const createSoloLifecycle = (soloSession: SoloSession, initialState: typeof AppState.currentState) =>
    createSessionLifecycleController({
      session: { sessionId: soloSession.id, userId: soloSession.userId },
      initialState,
      repository: backgroundRecovery,
      captureTime: backgroundRecovery.captureTime,
      getDetector: () => foregroundDetectionController.current,
      onPendingChange: (pending) => {
        backgroundRecoveryPending.current = pending;
        setIsRecoveringBackground(pending);
      },
      onRecovered: (recovery, detection) => {
        if (detection) setForegroundDetection(detection);
        setSoloNow(Date.now());
        if (recovery === 'needs-review') {
          Alert.alert(
            'Session recovery needs review',
            'Elapsed time could not be verified while DontLift was in the background. No violation was added; continue or cancel the session to resolve it.',
          );
        }
      },
      onError: (stage) => {
        Alert.alert(
          stage === 'begin' ? 'Background recovery unavailable' : 'Could not restore background state',
          stage === 'begin'
            ? 'Could not save this background transition. The Solo session is still active, but this transition may not be included in its result.'
            : 'The session remains saved on this device. Leave and reopen DontLift to retry recovery before completing the session.',
        );
      },
    });

  // Derive the timer from the persisted start time so it resumes correctly after returning.
  useEffect(() => {
    if (!activeSoloSession) return undefined;
    setSoloNow(Date.now());
    const timer = setInterval(() => setSoloNow(Date.now()), 1000);
    let lifecycleHandle = soloLifecycle.current;
    if (!lifecycleHandle || lifecycleHandle.sessionId !== activeSoloSession.id) {
      lifecycleHandle?.controller.dispose();
      lifecycleHandle?.subscription.remove();
      const controller = createSoloLifecycle(activeSoloSession, AppState.currentState);
      const subscription = AppState.addEventListener('change', (nextState) => {
        void controller.handleChange(nextState);
      });
      lifecycleHandle = { sessionId: activeSoloSession.id, controller, subscription };
      soloLifecycle.current = lifecycleHandle;
    }
    return () => {
      clearInterval(timer);
      if (soloLifecycle.current === lifecycleHandle) {
        lifecycleHandle.controller.dispose();
        lifecycleHandle.subscription.remove();
        soloLifecycle.current = null;
      }
    };
  }, [activeSoloSession]);

  useEffect(() => {
    if (!activeSoloSession) {
      foregroundDetectionController.current = null;
      setForegroundDetection(INITIAL_DETECTION_STATE);
      return undefined;
    }

    const controller = createForegroundDetectionController(
      { id: activeSoloSession.id, userId: activeSoloSession.userId },
      violationRepository,
      () => feedbackService.notifyConfirmedViolation(activeSoloSession.userId),
    );
    foregroundDetectionController.current = controller;
    let disposed = false;
    let initialized = false;
    let processing = false;
    let latestMeasurement: AccelerometerMeasurement | undefined;
    let tickRequested = false;

    const drain = async () => {
      if (disposed || processing || !initialized || backgroundRecoveryPending.current || AppState.currentState !== 'active') return;
      processing = true;
      try {
        while (!disposed && !backgroundRecoveryPending.current && AppState.currentState === 'active' && (latestMeasurement || tickRequested)) {
          if (latestMeasurement) {
            const measurement = latestMeasurement;
            latestMeasurement = undefined;
            const nextState = await controller.observeSample(measurement, Date.now());
            if (!disposed) setForegroundDetection(nextState);
          } else {
            tickRequested = false;
            const nextState = await controller.tick(Date.now());
            if (!disposed) setForegroundDetection(nextState);
          }
        }
      } catch {
        if (!disposed) {
          setForegroundDetection((state) => ({
            ...state,
            persistenceError: 'Phone-down detection is temporarily unavailable. Check device sensors and retry.',
          }));
        }
      } finally {
        processing = false;
        if (!disposed && !backgroundRecoveryPending.current && (latestMeasurement || tickRequested)) void drain();
      }
    };

    void controller.initialize().then((state) => {
      if (disposed) return;
      setForegroundDetection(state);
      initialized = true;
      void drain();
    }).catch(() => {
      if (!disposed) {
        setForegroundDetection((state) => ({
          ...state,
          persistenceError: 'Could not load this session’s violation history from the device.',
        }));
      }
    });

    try {
      accelerometerAdapter.setUpdateInterval(20);
      const subscription = accelerometerAdapter.subscribe((measurement) => {
        latestMeasurement = measurement;
        void drain();
      });
      const timer = setInterval(() => {
        tickRequested = true;
        void drain();
      }, 200);

      return () => {
        disposed = true;
        subscription.remove();
        clearInterval(timer);
        if (foregroundDetectionController.current === controller) foregroundDetectionController.current = null;
      };
    } catch {
      disposed = true;
      setForegroundDetection((state) => ({
        ...state,
        persistenceError: 'Could not start the accelerometer. Check sensor availability and retry.',
      }));
      return () => {
        if (foregroundDetectionController.current === controller) foregroundDetectionController.current = null;
      };
    }
  }, [activeSoloSession]);

  useEffect(() => {
    if (currentScreen !== '03-solo-timer') return undefined;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      // Returning to selection does not cancel or delete the persisted ACTIVE session.
      setCurrentScreen('02-solo-select');
      return true;
    });
    return () => back.remove();
  }, [currentScreen, setCurrentScreen]);

  const handleStartSolo = async (mode: 'COUNTDOWN' | 'STOPWATCH', mins: number) => {
    if (soloStartPending.current) return;
    soloStartPending.current = true;
    setSoloStartError(undefined);
    setIsStartingSolo(true);

    const supportsRecovery = Platform.OS === 'android' || Platform.OS === 'ios';
    const startupState = AppState.currentState;
    let latestStartupState = startupState;
    const startupTransitions: { state: typeof AppState.currentState; observedAt: ReturnType<typeof backgroundRecovery.captureTime> }[] = [];
    let startupLifecycle: ReturnType<typeof createSessionLifecycleController> | null = null;
    let startupSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
    let attachedLifecycle = false;

    if (supportsRecovery) {
      if (startupState !== 'active') startupTransitions.push({ state: startupState, observedAt: backgroundRecovery.captureTime() });
      startupSubscription = AppState.addEventListener('change', (nextState) => {
        const wasActive = latestStartupState === 'active';
        latestStartupState = nextState;
        if (startupLifecycle) {
          void startupLifecycle.handleChangeAt(nextState, backgroundRecovery.captureTime());
        } else if (wasActive && nextState !== 'active') {
          startupTransitions.push({ state: nextState, observedAt: backgroundRecovery.captureTime() });
        } else if (!wasActive && nextState === 'active') {
          startupTransitions.push({ state: nextState, observedAt: backgroundRecovery.captureTime() });
        }
      });
    }

    try {
      const result = await soloSessionController.start({
        userId,
        mode,
        durationMinutes: mode === 'COUNTDOWN' ? mins : undefined,
        sensorReady,
      });

      if (supportsRecovery) {
        const existing = soloLifecycle.current;
        if (existing?.sessionId === result.session.id) {
          startupLifecycle = existing.controller;
          startupSubscription?.remove();
          startupSubscription = undefined;
        } else {
          existing?.controller.dispose();
          existing?.subscription.remove();
          startupLifecycle = createSoloLifecycle(result.session, 'active');
          const subscription = startupSubscription!;
          soloLifecycle.current = { sessionId: result.session.id, controller: startupLifecycle, subscription };
          attachedLifecycle = true;
          const replay = startupTransitions.map(({ state, observedAt }) => startupLifecycle!.handleChangeAt(state, observedAt));
          await Promise.all(replay);
        }
        if (startupTransitions.length === 0) await startupLifecycle.reconcileCurrent();
      }

      if (!isMounted.current) {
        if (attachedLifecycle && soloLifecycle.current?.controller === startupLifecycle) {
          startupLifecycle?.dispose();
          startupSubscription?.remove();
          soloLifecycle.current = null;
        }
        return;
      }
      setActiveSoloSession(result.session);
      setSoloSummary(null);
      setSoloSummaryPendingView(false);
      setSoloCompletionError(undefined);
      completionAttemptedSessionId.current = null;
      setSelectedMode(result.session.mode);
      if (result.session.mode === 'COUNTDOWN') setSelectedDuration(result.session.durationSeconds / 60);
      setSoloNow(Date.now());
      setCurrentScreen('03-solo-timer');
      if (result.resumed) Alert.alert('Active session continued', 'Your existing Solo session was restored from this device.');
    } catch (error) {
      if (attachedLifecycle && soloLifecycle.current?.controller === startupLifecycle) {
        startupLifecycle?.dispose();
        startupSubscription?.remove();
        soloLifecycle.current = null;
      }
      if (!isMounted.current) return;
      const code = (error as { code?: string }).code;
      setSoloStartError(code === 'sensor-not-ready'
        ? 'Accelerometer check must be ready before a focus session can start.'
        : code === 'invalid-duration'
          ? 'Choose a duration from 5 to 720 minutes in 5-minute steps.'
          : 'Could not save or restore this session on the device. Your choices are kept; retry when local storage is available.');
    } finally {
      if (!attachedLifecycle) startupSubscription?.remove();
      soloStartPending.current = false;
      if (isMounted.current) setIsStartingSolo(false);
    }
  };

  const continueActiveSoloSession = () => {
    if (!activeSoloSession || isCancellingSolo) return;
    setSelectedMode(activeSoloSession.mode);
    if (activeSoloSession.mode === 'COUNTDOWN') setSelectedDuration(activeSoloSession.durationSeconds / 60);
    setSoloNow(Date.now());
    setCurrentScreen('03-solo-timer');
  };

  const performCancelSoloSession = async () => {
    if (!activeSoloSession || soloStartPending.current || backgroundRecoveryPending.current) return;
    soloStartPending.current = true;
    setIsCancellingSolo(true);
    const detector = foregroundDetectionController.current;
    let detectionSealed = false;
    try {
      await detector?.endCurrentViolation(Date.now());
      detectionSealed = detector !== null;
      const cancelled = await soloSessionController.cancel({ userId, sessionId: activeSoloSession.id });
      if (!isMounted.current) return;
      if (!cancelled) {
        setActiveSoloSession(null);
        setCurrentScreen('02-solo-select');
        Alert.alert('Session already changed', 'This session is no longer active. Return to Solo Focus and try again.');
        return;
      }
      setActiveSoloSession(null);
      setSoloStartError(undefined);
      setCurrentScreen('02-solo-select');
    } catch {
      if (detectionSealed && detector) {
        const detectionState = await detector.resumeAfterFinalizationFailure(Date.now()).catch(() => null);
        if (detectionState && isMounted.current) setForegroundDetection(detectionState);
      }
      if (isMounted.current) Alert.alert('Could not cancel session', 'The session is still saved. Check device storage and try again.');
    } finally {
      soloStartPending.current = false;
      if (isMounted.current) setIsCancellingSolo(false);
    }
  };

  const confirmCancelSoloSession = () => {
    if (!activeSoloSession || soloStartPending.current || backgroundRecoveryPending.current) return;
    Alert.alert('Cancel Solo session?', 'This session will be canceled without a completion summary. This action cannot be undone.', [
      { text: 'Keep session', style: 'cancel' },
      { text: 'Cancel session', style: 'destructive', onPress: () => { void performCancelSoloSession(); } },
    ]);
  };

  const completeActiveSoloSession = async (completedAtUtcMs = Date.now()) => {
    if (!activeSoloSession || soloStartPending.current || backgroundRecoveryPending.current) return;
    soloStartPending.current = true;
    completionAttemptedSessionId.current = activeSoloSession.id;
    setIsCompletingSolo(true);
    setSoloCompletionError(undefined);
    const detector = foregroundDetectionController.current;
    let detectionSealed = false;
    try {
      await detector?.endCurrentViolation(completedAtUtcMs);
      detectionSealed = detector !== null;
      const summary = await soloCompletionController.complete({ userId, sessionId: activeSoloSession.id, completedAtUtcMs });
      if (!isMounted.current) return;
      void feedbackService.notifySoloSessionCompleted();
      setSoloSummary(summary);
      setSoloSyncState({ sessionId: summary.sessionId, status: 'pending' });
      void soloSyncWorker.current?.kick({ sessionId: summary.sessionId });
      setActiveSoloSession(null);
      const shouldShowSummaryNow = currentScreen === '02-solo-select' || currentScreen === '03-solo-timer';
      setSoloSummaryPendingView(!shouldShowSummaryNow);
      if (shouldShowSummaryNow) setCurrentScreen('04-solo-summary');
    } catch {
      if (detectionSealed && detector) {
        const detectionState = await detector.resumeAfterFinalizationFailure(Date.now()).catch(() => null);
        if (detectionState && isMounted.current) setForegroundDetection(detectionState);
      }
      if (isMounted.current) setSoloCompletionError('Could not save this session summary. Your session is still active; retry when device storage is available.');
    } finally {
      soloStartPending.current = false;
      if (isMounted.current) setIsCompletingSolo(false);
    }
  };

  const requestFinishSoloSession = () => {
    if (!activeSoloSession || soloStartPending.current || backgroundRecoveryPending.current) return;
    if (soloCompletionError) {
      completionAttemptedSessionId.current = null;
      void completeActiveSoloSession(Date.now());
      return;
    }
    Alert.alert('Finish this focus session?', 'Your focus time, confirmed lifts, time away, and penalty score will be saved in the summary.', [
      { text: 'Keep focusing', style: 'cancel' },
      { text: 'Finish session', onPress: () => { void completeActiveSoloSession(Date.now()); } },
    ]);
  };

  const soloSecondsLeft = activeSoloSession
    ? getSoloSessionTime(activeSoloSession, Math.max(soloNow, Date.now())).displayedSeconds
    : 0;

  useEffect(() => {
    if (
      activeSoloSession?.mode !== 'COUNTDOWN'
      || soloSecondsLeft > 0
      || isCompletingSolo
      || completionAttemptedSessionId.current === activeSoloSession.id
      || isRecoveringBackground
      || backgroundRecoveryPending.current
    ) return;
    void completeActiveSoloSession(Date.parse(activeSoloSession.startedAt) + activeSoloSession.durationSeconds * 1_000);
  }, [activeSoloSession, currentScreen, isCompletingSolo, isRecoveringBackground, soloSecondsLeft]);

  return {
    selectedDuration, setSelectedDuration, selectedMode, setSelectedMode,
    activeSoloSession, soloSecondsLeft, isStartingSolo, isCancellingSolo, isCompletingSolo,
    soloCompletionError, soloSummary, soloSummaryPendingView, setSoloSummaryPendingView,
    soloSyncState, soloSyncWorker, foregroundDetection, isRecoveringBackground, soloStartError,
    handleStartSolo, continueActiveSoloSession, confirmCancelSoloSession, requestFinishSoloSession,
  };
}
