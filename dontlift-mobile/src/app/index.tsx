import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { AccelerometerMeasurement } from 'expo-sensors';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  Linking,
  Text,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Network from 'expo-network';
import * as Crypto from 'expo-crypto';
import { ScreenId, Participant, BillParticipantShare } from '../types';
import { INITIAL_PARTICIPANTS } from '../constants';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { ControlDeckDrawer } from '../components/ControlDeckDrawer';

// 10 Core Screens
import { LoginScreen, LoginScreenBackground } from '../screens/LoginScreen';
import { SoloSelectScreen } from '../screens/SoloSelectScreen';
import { SoloTimerScreen } from '../screens/SoloTimerScreen';
import { SoloSummaryScreen } from '../screens/SoloSummaryScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { createSoloHistoryRepository } from '../features/history/solo-history-repository';
import { GroupLobbyScreen } from '../screens/GroupLobbyScreen';
import { GroupActiveScreen } from '../screens/GroupActiveScreen';
import { BillAllocationScreen } from '../screens/BillAllocationScreen';
import { VietQRSettlementScreen } from '../screens/VietQRSettlementScreen';
import { ActivationScreen } from '../screens/ActivationScreen';
import { HardwareDiagnosticsScreen } from '../screens/HardwareDiagnosticsScreen';
import { useAuthSession } from '../features/auth/auth-session';
import { useSensorAvailability } from '../features/sensors/use-sensor-availability';
import { accelerometerAdapter } from '../features/sensors/sensor-adapter';
import type { RegistrationProfile, RegistrationUser } from '../features/auth/auth-controller';
import type { AuthSessionState } from '../features/auth/auth-session-controller';
import { createLocalSessionRepository } from '../features/solo/local-session-repository';
import { createSoloSessionController, getSoloSessionTime, type SoloSession } from '../features/solo/session-controller';
import { createSoloSessionCompletionController } from '../features/solo/session-completion-controller';
import { createSoloSummaryRepository, type SoloSessionSummary } from '../features/solo/summary-service';
import { createViolationRepository } from '../features/solo/violation-repository';
import { createOutboxSyncRepository } from '../features/sync/outbox-repository';
import { createSoloSyncWorker } from '../features/sync/sync-worker';
import { createSyncEventsPort } from '../features/sync/sync-events-port';
import { getConfiguredFirebaseRuntime } from '../features/auth/firebase-adapters';
import { getLocalDatabase } from '../features/local/database';
import { createRoomRepository, RoomCreateError, type CreatedRoom, type RoomCreateCommand, type JoinedRoom, RoomJoinError, roomJoinErrorMessage } from '../features/rooms/room-repository';
import { roomCreateErrorMessage } from '../features/rooms/room-create-error';
import { JoinRoomScreen } from '../screens/JoinRoomScreen';
import { createBackgroundRecoveryRepository } from '../features/solo/background-recovery';
import { createSessionLifecycleController } from '../features/solo/session-lifecycle-controller';
import {
  createForegroundDetectionController,
  type ForegroundDetectionController,
  type ForegroundDetectionViewState,
} from '../features/solo/foreground-detection-controller';

const soloSessionController = createSoloSessionController(createLocalSessionRepository());
const soloCompletionController = createSoloSessionCompletionController(createSoloSummaryRepository());
const violationRepository = createViolationRepository();
const backgroundRecovery = createBackgroundRecoveryRepository();
const INITIAL_DETECTION_STATE: ForegroundDetectionViewState = {
  orientation: 'UNKNOWN',
  isGraceActive: false,
  isViolationActive: false,
  graceSeconds: 0,
  violationsCount: 0,
  violationDurationSeconds: 0,
};

export default function HomeScreen() {
  const session = useAuthSession();

  if (session.state.kind === 'loading') {
    return (
      <View style={styles.authLoading}>
        <StatusBar barStyle="dark-content" backgroundColor="#EEF2FF" />
        <ActivityIndicator accessibilityLabel="Restoring account session" size="large" color="#004AC6" />
      </View>
    );
  }

  if (session.state.kind === 'authenticated') {
    return <AuthenticatedHome key={session.state.profile.uid} profile={session.state.profile} />;
  }

  const recoveryUser = session.state.kind === 'profile-recovery' && session.state.reason === 'missing-profile'
    ? session.state.user
    : undefined;
  return <LoginGate state={session.state} recoveryUser={recoveryUser} />;
}

function LoginGate({ state, recoveryUser }: { state: AuthSessionState; recoveryUser?: RegistrationUser }) {
  const insets = useSafeAreaInsets();
  const session = useAuthSession();
  const formError = state.kind === 'profile-recovery' && state.reason === 'profile-unavailable'
    ? 'Your account is signed in, but the profile service is unavailable. Try again when connected.'
    : state.kind === 'unavailable' ? state.message : undefined;

  return (
    <View style={[styles.loginGate, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#EEF2FF" />
      <LoginScreenBackground />
      <ScrollView contentContainerStyle={styles.loginGateContent} keyboardShouldPersistTaps="handled">
        <LoginScreen
          onAuthenticated={() => { void session.refreshProfile(); }}
          onSignIn={session.signIn}
          onSignOut={session.signOut}
          recoveryUser={recoveryUser}
          canSignOut={state.kind === 'profile-recovery'}
          formError={formError}
        />
      </ScrollView>
    </View>
  );
}

function AuthenticatedHome({ profile }: { profile: RegistrationProfile }) {
  const insets = useSafeAreaInsets();
  const session = useAuthSession();
  const sensorAvailability = useSensorAvailability();
  const soloHistoryRepository = useMemo(
    () => createSoloHistoryRepository(getConfiguredFirebaseRuntime(Platform.OS, __DEV__)),
    [profile.uid],
  );
  const roomRepository = useMemo(() => {
    const runtime = getConfiguredFirebaseRuntime(Platform.OS, __DEV__);
    return createRoomRepository({
      firestore: runtime.firestore,
      auth: runtime.auth,
      database: getLocalDatabase(),
      randomUUID: Crypto.randomUUID,
    });
  }, [profile.uid]);
  // Navigation & Drawer
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('02-solo-select');
  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);
  const [isHostRole, setIsHostRole] = useState<boolean>(true);
  const [showEmptyState, setShowEmptyState] = useState<boolean>(false);
  const [createdRoom, setCreatedRoom] = useState<CreatedRoom | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomCreateError, setRoomCreateError] = useState<string | undefined>();
  const pendingRoomCommand = useRef<RoomCreateCommand | null>(null);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState<JoinedRoom | null>(null);
  const [roomJoinError, setRoomJoinError] = useState<string | undefined>();
  const pendingRoomJoinCommand = useRef<{ requestId: string; pin: string } | null>(null);

  const handleCreateRoom = async () => {
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);
    setRoomCreateError(undefined);
    const command = pendingRoomCommand.current ?? roomRepository.createCommand();
    pendingRoomCommand.current = command;
    try {
      const result = await roomRepository.createRoom(profile.displayName, command);
      pendingRoomCommand.current = null;
      setCreatedRoom(result);
    } catch (error) {
      if (!(error instanceof RoomCreateError) || error.code !== 'unavailable') pendingRoomCommand.current = null;
      if (__DEV__ && error instanceof RoomCreateError) {
        console.warn('[room-create] failed', JSON.stringify({
          code: error.code, stage: error.stage, firebaseCode: error.firebaseCode,
        }));
      }
      setRoomCreateError(roomCreateErrorMessage(error));
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = async (pin: string) => {
    if (isJoiningRoom) return;
    setIsJoiningRoom(true);
    setRoomJoinError(undefined);
    const command = pendingRoomJoinCommand.current?.pin === pin
      ? pendingRoomJoinCommand.current
      : { requestId: Crypto.randomUUID(), pin };
    pendingRoomJoinCommand.current = command;
    try {
      const result = await roomRepository.joinRoomByPin(command);
      pendingRoomJoinCommand.current = null;
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
  };

  const cancelRoomJoin = useCallback(() => {
    if (isJoiningRoom) return;
    setCurrentScreen('05-group-lobby');
    setRoomJoinError(undefined);
    pendingRoomJoinCommand.current = null;
  }, [isJoiningRoom]);

  useEffect(() => {
    if (currentScreen !== '12-join-room') return undefined;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      cancelRoomJoin();
      return true;
    });
    return () => back.remove();
  }, [currentScreen, cancelRoomJoin]);

  // Solo State
  const [selectedDuration, setSelectedDuration] = useState<number>(25);
  const [selectedMode, setSelectedMode] = useState<'COUNTDOWN' | 'STOPWATCH'>('COUNTDOWN');
  const [activeSoloSession, setActiveSoloSession] = useState<SoloSession | null>(null);
  const [soloNow, setSoloNow] = useState<number>(Date.now());
  const [isStartingSolo, setIsStartingSolo] = useState<boolean>(false);
  const [isCancellingSolo, setIsCancellingSolo] = useState<boolean>(false);
  const [isCompletingSolo, setIsCompletingSolo] = useState<boolean>(false);
  const [soloCompletionError, setSoloCompletionError] = useState<string | undefined>();
  const [soloSummary, setSoloSummary] = useState<SoloSessionSummary | null>(null);
  const [soloSummaryPendingView, setSoloSummaryPendingView] = useState<boolean>(false);
  const [soloSyncState, setSoloSyncState] = useState<{
    sessionId: string;
    status: 'syncing' | 'pending' | 'synced' | 'failed';
  } | null>(null);
  const soloSyncWorker = useRef<ReturnType<typeof createSoloSyncWorker> | null>(null);
  const [foregroundDetection, setForegroundDetection] = useState<ForegroundDetectionViewState>(INITIAL_DETECTION_STATE);
  const foregroundDetectionController = useRef<ForegroundDetectionController | null>(null);
  const soloStartPending = useRef(false);
  const completionAttemptedSessionId = useRef<string | null>(null);
  const backgroundRecoveryPending = useRef(false);
  // State đánh thức effect countdown; ref khóa thao tác ngay trước lượt render tiếp theo.
  const [isRecoveringBackground, setIsRecoveringBackground] = useState(false);
  const soloLifecycle = useRef<{
    sessionId: string;
    controller: ReturnType<typeof createSessionLifecycleController>;
    subscription: ReturnType<typeof AppState.addEventListener>;
  } | null>(null);
  const isMounted = useRef(false);

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
          userId: profile.uid,
          getCurrentUserId: () => runtime.auth.currentUser?.uid ?? null,
          repository: createOutboxSyncRepository(database),
          transport: createSyncEventsPort(runtime.functions),
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
  }, [profile.uid]);

  useEffect(() => {
    if (soloSummary) void soloSyncWorker.current?.kick({ sessionId: soloSummary.sessionId });
  }, [soloSummary]);
  const [soloStartError, setSoloStartError] = useState<string | undefined>();
  // Group State
  const [participants, setParticipants] = useState<Participant[]>(INITIAL_PARTICIPANTS);
  const [groupTimerSeconds, setGroupTimerSeconds] = useState<number>(13 * 60 + 40); // 13:40
  const [groupAlertVisible, setGroupAlertVisible] = useState<boolean>(true);
  const [groupGraceSeconds, setGroupGraceSeconds] = useState<number>(2);

  // Bill State
  const [totalBillAmount, setTotalBillAmount] = useState<number>(550000);
  const [hostOverrideMode, setHostOverrideMode] = useState<boolean>(false);

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

  // Tính giờ từ started_at đã lưu để tiếp tục đúng thời điểm sau khi quay lại session.
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
      // Quay về màn chọn không kết thúc hay xóa session ACTIVE đã lưu.
      setCurrentScreen('02-solo-select');
      return true;
    });
    return () => back.remove();
  }, [currentScreen]);

  // 40/60 Bill Split calculation
  const billBreakdown: BillParticipantShare[] = useMemo(() => {
    const N = participants.length || 1;
    const baseSharePool = totalBillAmount * 0.4;
    const penaltySharePool = totalBillAmount * 0.6;
    const basePerPerson = Math.round(baseSharePool / N);
    const totalViolations = participants.reduce((sum, p) => sum + p.lifts, 0);

    return participants.map((p) => {
      let penaltyShare = 0;
      if (totalViolations > 0) {
        penaltyShare = Math.round((p.lifts / totalViolations) * penaltySharePool);
      }
      return {
        ...p,
        baseShare: basePerPerson,
        penaltyShare,
        totalShare: basePerPerson + penaltyShare,
      };
    });
  }, [participants, totalBillAmount]);

  // Solo handlers
  const handleStartSolo = async (mode: 'COUNTDOWN' | 'STOPWATCH', mins: number) => {
    // Ref khóa ngay trong cùng lượt xử lý, trước khi React kịp render nút disabled.
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
      // Nếu Start bị gọi trong giai đoạn chuyển nền, ghi nhận luôn mốc để session không mất grace.
      if (startupState !== 'active') {
        startupTransitions.push({ state: startupState, observedAt: backgroundRecovery.captureTime() });
      }
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
        userId: profile.uid,
        mode,
        durationMinutes: mode === 'COUNTDOWN' ? mins : undefined,
        sensorReady: sensorAvailability.state.kind === 'ready',
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
          // Khởi tạo từ active để mốc non-active đã chụp trước khi SQLite trả lời được ghi như một lần rời app.
          startupLifecycle = createSoloLifecycle(result.session, 'active');
          const subscription = startupSubscription!;
          soloLifecycle.current = {
            sessionId: result.session.id,
            controller: startupLifecycle,
            subscription,
          };
          attachedLifecycle = true;
          // Replay các mốc đã chụp trong lúc SQLite chưa trả session ID; thao tác được queue trước event mới.
          const replay = startupTransitions.map(({ state, observedAt }) =>
            startupLifecycle!.handleChangeAt(state, observedAt));
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
      // Chỉ chuyển sang timer sau khi repository xác nhận session đã commit vào SQLite.
      setActiveSoloSession(result.session);
      setSoloSummary(null);
      setSoloSummaryPendingView(false);
      setSoloCompletionError(undefined);
      completionAttemptedSessionId.current = null;
      setSelectedMode(result.session.mode);
      if (result.session.mode === 'COUNTDOWN') {
        setSelectedDuration(result.session.durationSeconds / 60);
      }
      setSoloNow(Date.now());
      setCurrentScreen('03-solo-timer');
      if (result.resumed) {
        Alert.alert('Active session continued', 'Your existing Solo session was restored from this device.');
      }
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
          ? 'Choose a duration from 5 to 180 minutes in 5-minute steps.'
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
    if (activeSoloSession.mode === 'COUNTDOWN') {
      setSelectedDuration(activeSoloSession.durationSeconds / 60);
    }
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
      const cancelled = await soloSessionController.cancel({
        userId: profile.uid,
        sessionId: activeSoloSession.id,
      });
      if (!isMounted.current) return;
      if (!cancelled) {
        // Session không còn ACTIVE; bỏ giao diện cũ để không tiếp tục hiển thị timer sai trạng thái.
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
      if (isMounted.current) {
        Alert.alert('Could not cancel session', 'The session is still saved. Check device storage and try again.');
      }
    } finally {
      soloStartPending.current = false;
      if (isMounted.current) setIsCancellingSolo(false);
    }
  };

  const confirmCancelSoloSession = () => {
    if (!activeSoloSession || soloStartPending.current || backgroundRecoveryPending.current) return;
    Alert.alert(
      'Cancel Solo session?',
      'This session will be canceled without a completion summary. This action cannot be undone.',
      [
        { text: 'Keep session', style: 'cancel' },
        { text: 'Cancel session', style: 'destructive', onPress: () => { void performCancelSoloSession(); } },
      ],
    );
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
      // Đợi sensor queue đóng violation và khóa controller trước khi chốt summary.
      await detector?.endCurrentViolation(completedAtUtcMs);
      detectionSealed = detector !== null;
      // Session, violations đã mở và summary outbox được chốt trong cùng transaction local.
      const summary = await soloCompletionController.complete({
        userId: profile.uid,
        sessionId: activeSoloSession.id,
        completedAtUtcMs,
      });
      if (!isMounted.current) return;
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
      if (isMounted.current) {
        setSoloCompletionError('Could not save this session summary. Your session is still active; retry when device storage is available.');
      }
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
    Alert.alert(
      'Finish this focus session?',
      'Your focus time, confirmed lifts, time away, and penalty score will be saved in the summary.',
      [
        { text: 'Keep focusing', style: 'cancel' },
        { text: 'Finish session', onPress: () => { void completeActiveSoloSession(Date.now()); } },
      ],
    );
  };

  const handleEndSoloSession = () => {
    setCurrentScreen('02-solo-select');
  };

  const soloSecondsLeft = activeSoloSession
    ? getSoloSessionTime(activeSoloSession, soloNow).displayedSeconds
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

    // Timer zero kết thúc theo cutoff dự kiến, không cộng thêm độ trễ của tick UI.
    void completeActiveSoloSession(Date.parse(activeSoloSession.startedAt) + activeSoloSession.durationSeconds * 1_000);
  }, [activeSoloSession, currentScreen, isCompletingSolo, isRecoveringBackground, soloSecondsLeft]);

  const navigateToScreen = (screen: ScreenId) => {
    if (screen === '02-solo-select' && soloSummaryPendingView && soloSummary) {
      setSoloSummaryPendingView(false);
      setCurrentScreen('04-solo-summary');
      return;
    }
    setCurrentScreen(screen);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#EEF2FF" />

      {/* Header */}
      <Header
        currentScreen={currentScreen}
        onNavigate={navigateToScreen}
        onOpenDrawer={() => setDrawerVisible(true)}
      />

      {/* Main Body */}
      <View style={styles.mainBody}>
        {currentScreen === '01-login' && <LoginScreenBackground />}
        {currentScreen === '11-solo-history' ? (
          <HistoryScreen
            userId={profile.uid}
            serverPremium={profile.isPremium}
            repository={soloHistoryRepository}
            onBack={() => navigateToScreen('02-solo-select')}
          />
        ) : <ScrollView
          style={styles.mainBodyScrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {currentScreen === '01-login' && (
          <LoginScreen
            onAuthenticated={() => { void session.refreshProfile(); }}
            onSignIn={session.signIn}
            authenticatedProfile={profile}
            onSignOut={session.signOut}
          />
        )}

        {currentScreen === '02-solo-select' && (
          <SoloSelectScreen
            selectedDuration={selectedDuration}
            selectedMode={selectedMode}
            onSelectDuration={setSelectedDuration}
            onSelectMode={setSelectedMode}
            onStartSession={handleStartSolo}
            onContinueSession={continueActiveSoloSession}
            onCancelSession={confirmCancelSoloSession}
            onOpenHistory={() => setCurrentScreen('11-solo-history')}
            isStarting={isStartingSolo || isRecoveringBackground}
            isCancelling={isCancellingSolo}
            startError={soloStartError}
            activeSession={activeSoloSession}
            sensorAvailability={sensorAvailability.state}
            onRetrySensorCheck={() => { void sensorAvailability.retry(); }}
            onOpenSettings={() => {
              void Linking.openSettings().catch(() => {
                Alert.alert('Settings unavailable', 'Open your device settings and allow motion access for DontLift.');
              });
            }}
          />
        )}

        {currentScreen === '03-solo-timer' && (
          <SoloTimerScreen
            mode={activeSoloSession?.mode ?? selectedMode}
            selectedDuration={selectedDuration}
            secondsLeft={soloSecondsLeft}
            orientation={foregroundDetection.orientation}
            isGraceActive={foregroundDetection.isGraceActive}
            isViolationActive={foregroundDetection.isViolationActive}
            graceSeconds={foregroundDetection.graceSeconds}
            violationsCount={foregroundDetection.violationsCount}
            violationDurationSeconds={foregroundDetection.violationDurationSeconds}
            detectionError={foregroundDetection.persistenceError}
            completionError={soloCompletionError}
            onEndSession={handleEndSoloSession}
            onFinishSession={requestFinishSoloSession}
            onCancelSession={confirmCancelSoloSession}
            isCancelling={isCancellingSolo}
            isCompletingSession={isCompletingSolo}
            isRecoveringBackground={isRecoveringBackground}
          />
        )}

        {currentScreen === '04-solo-summary' && soloSummary && (
          <SoloSummaryScreen
            summary={soloSummary}
            syncStatus={soloSyncState?.sessionId === soloSummary.sessionId ? soloSyncState.status : 'pending'}
            onRetrySync={() => {
              void soloSyncWorker.current?.kick({ ignoreBackoff: true, sessionId: soloSummary.sessionId });
            }}
            onNewFocus={() => {
              setSoloSummaryPendingView(false);
              setCurrentScreen('02-solo-select');
            }}
          />
        )}

        {currentScreen === '05-group-lobby' && (
          <GroupLobbyScreen
            room={createdRoom}
            isCreating={isCreatingRoom}
            errorMessage={roomCreateError}
            onCreateRoom={() => { void handleCreateRoom(); }}
            onJoinRoom={() => {
              setJoinedRoom(null);
              setRoomJoinError(undefined);
              pendingRoomJoinCommand.current = null;
              setCurrentScreen('12-join-room');
            }}
          />
        )}

        {currentScreen === '12-join-room' && (
          <JoinRoomScreen
            result={joinedRoom}
            isJoining={isJoiningRoom}
            errorMessage={roomJoinError}
            onJoin={(pin) => { void handleJoinRoom(pin); }}
            onCancel={cancelRoomJoin}
          />
        )}

        {currentScreen === '06-group-active' && (
          <GroupActiveScreen
            participants={participants}
            groupTimerSeconds={groupTimerSeconds}
            groupAlertVisible={groupAlertVisible}
            groupGraceSeconds={groupGraceSeconds}
            isHostRole={isHostRole}
            onEndSession={() => setCurrentScreen('07-bill-allocation')}
          />
        )}

        {currentScreen === '07-bill-allocation' && (
          <BillAllocationScreen
            totalBillAmount={totalBillAmount}
            billBreakdown={billBreakdown}
            hostOverrideMode={hostOverrideMode}
            onUpdateTotalBill={setTotalBillAmount}
            onToggleHostOverride={() => setHostOverrideMode(!hostOverrideMode)}
            onPublishBill={() => setCurrentScreen('08-vietqr-settlement')}
          />
        )}

        {currentScreen === '08-vietqr-settlement' && (
          <VietQRSettlementScreen billBreakdown={billBreakdown} />
        )}

        {currentScreen === '09-activation' && <ActivationScreen />}

        {currentScreen === '10-hardware-diagnostics' && (
          <HardwareDiagnosticsScreen
            sensorAvailability={sensorAvailability.state}
            onRetrySensorCheck={() => { void sensorAvailability.retry(); }}
            onOpenSettings={() => {
              void Linking.openSettings().catch(() => {
                Alert.alert('Settings unavailable', 'Open your device settings and allow motion access for DontLift.');
              });
            }}
          />
        )}
        </ScrollView>}
      </View>

      {/* 5-Tab Bottom Navigation Bar */}
      <BottomNav
        currentScreen={currentScreen}
        onNavigate={navigateToScreen}
      />

      {/* Prototype Control Deck Modal */}
      <ControlDeckDrawer
        visible={drawerVisible}
        currentScreen={currentScreen}
        isHostRole={isHostRole}
        showEmptyState={showEmptyState}
        onClose={() => setDrawerVisible(false)}
        onNavigate={(screen) => setCurrentScreen(screen)}
        onToggleHostRole={() => setIsHostRole(!isHostRole)}
        onToggleEmptyState={() => setShowEmptyState(!showEmptyState)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  authLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2FF' },
  loginGate: { flex: 1, position: 'relative', backgroundColor: '#EEF2FF' },
  loginGateContent: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  container: {
    flex: 1,
    backgroundColor: '#EEF2FF',
  },
  mainBody: {
    flex: 1,
    position: 'relative',
  },
  mainBodyScrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
});
