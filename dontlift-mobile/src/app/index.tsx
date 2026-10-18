import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { createAndroidBackgroundRecoveryRepository } from '../features/solo/android-background-recovery';
import {
  createForegroundDetectionController,
  type ForegroundDetectionController,
  type ForegroundDetectionViewState,
} from '../features/solo/foreground-detection-controller';

const soloSessionController = createSoloSessionController(createLocalSessionRepository());
const soloCompletionController = createSoloSessionCompletionController(createSoloSummaryRepository());
const violationRepository = createViolationRepository();
const androidBackgroundRecovery = createAndroidBackgroundRecoveryRepository();
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
  // Navigation & Drawer
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('02-solo-select');
  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);
  const [isHostRole, setIsHostRole] = useState<boolean>(true);
  const [showEmptyState, setShowEmptyState] = useState<boolean>(false);

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
  const [foregroundDetection, setForegroundDetection] = useState<ForegroundDetectionViewState>(INITIAL_DETECTION_STATE);
  const foregroundDetectionController = useRef<ForegroundDetectionController | null>(null);
  const soloStartPending = useRef(false);
  const completionAttemptedSessionId = useRef<string | null>(null);
  const backgroundRecoveryPending = useRef(false);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);
  const [soloStartError, setSoloStartError] = useState<string | undefined>();
  // Group State
  const [participants, setParticipants] = useState<Participant[]>(INITIAL_PARTICIPANTS);
  const [groupTimerSeconds, setGroupTimerSeconds] = useState<number>(13 * 60 + 40); // 13:40
  const [groupAlertVisible, setGroupAlertVisible] = useState<boolean>(true);
  const [groupGraceSeconds, setGroupGraceSeconds] = useState<number>(2);

  // Bill State
  const [totalBillAmount, setTotalBillAmount] = useState<number>(550000);
  const [hostOverrideMode, setHostOverrideMode] = useState<boolean>(false);

  // Tính giờ từ started_at đã lưu để tiếp tục đúng thời điểm sau khi quay lại session.
  useEffect(() => {
    if (!activeSoloSession) return undefined;
    setSoloNow(Date.now());
    const timer = setInterval(() => setSoloNow(Date.now()), 1000);
    let previousState = AppState.currentState;
    let handledBackgroundTransition = false;
    const appState = AppState.addEventListener('change', (nextState) => {
      const wasActive = previousState === 'active';
      previousState = nextState;
      if (Platform.OS !== 'android') return;

      if (wasActive && nextState !== 'active' && !handledBackgroundTransition) {
        handledBackgroundTransition = true;
        backgroundRecoveryPending.current = true;
        void (async () => {
          const detector = foregroundDetectionController.current;
          const detection = detector?.getViewState(Date.now());
          if (!detection?.isViolationActive) {
            // Lưu candidate trước khi app bị treo; callback Expo Go vẫn có thể không chạy trước force-stop.
            await androidBackgroundRecovery.begin({
              sessionId: activeSoloSession.id,
              userId: activeSoloSession.userId,
            });
            // Nếu đang trong grace của cảm biến, reset nó để không tính trùng với background candidate.
            await detector?.observeOrientation('UNKNOWN', Date.now());
          }
        })().catch(() => {
          Alert.alert(
            'Background recovery unavailable',
            'Could not save this background transition. The Solo session is still active, but this transition may not be included in its result.',
          );
        });
      }

      if (nextState === 'active' && !wasActive) {
        handledBackgroundTransition = false;
        void (async () => {
          // Xử lý candidate trước khi cập nhật timer để summary đọc được violation vừa phục hồi.
          const recovery = await androidBackgroundRecovery.reconcile({
            sessionId: activeSoloSession.id,
            userId: activeSoloSession.userId,
          });
          backgroundRecoveryPending.current = false;
          await foregroundDetectionController.current?.initialize();
          setSoloNow(Date.now());
          if (recovery === 'needs-review') {
            Alert.alert(
              'Session recovery needs review',
              'The device clock changed while DontLift was in the background. No violation was added; continue or cancel the session to resolve it.',
            );
          }
        })().catch(() => {
          // Giữ completion khóa lại đến lần reconcile kế tiếp; không chốt summary khi candidate còn pending.
          backgroundRecoveryPending.current = true;
          Alert.alert(
            'Could not restore background state',
            'The session remains saved on this device. Leave and reopen DontLift to retry recovery before completing the session.',
          );
          setSoloNow(Date.now());
        });
      }
    });
    return () => {
      clearInterval(timer);
      appState.remove();
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
      if (disposed || processing || !initialized || AppState.currentState !== 'active') return;
      processing = true;
      try {
        while (!disposed && AppState.currentState === 'active' && (latestMeasurement || tickRequested)) {
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
        if (!disposed && (latestMeasurement || tickRequested)) void drain();
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
    try {
      const result = await soloSessionController.start({
        userId: profile.uid,
        mode,
        durationMinutes: mode === 'COUNTDOWN' ? mins : undefined,
        sensorReady: sensorAvailability.state.kind === 'ready',
      });
      const recovery = Platform.OS === 'android'
        ? await androidBackgroundRecovery.reconcile({ sessionId: result.session.id, userId: result.session.userId })
        : 'none';
      backgroundRecoveryPending.current = false;
      // Không cập nhật màn hình cũ nếu người dùng đã đăng xuất hoặc đổi tài khoản trong lúc lưu.
      if (!isMounted.current) return;
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
      if (recovery === 'needs-review') {
        Alert.alert(
          'Session recovery needs review',
          'The device clock changed while DontLift was closed. No violation was added; continue or cancel the session to resolve it.',
        );
      } else if (result.resumed) {
        Alert.alert('Active session continued', 'Your existing Solo session was restored from this device.');
      }
    } catch (error) {
      if (!isMounted.current) return;
      const code = (error as { code?: string }).code;
      setSoloStartError(code === 'sensor-not-ready'
        ? 'Accelerometer check must be ready before a focus session can start.'
        : code === 'invalid-duration'
          ? 'Choose a duration from 5 to 180 minutes in 5-minute steps.'
          : 'Could not save this session on the device. Your choices are kept; retry when local storage is available.');
    } finally {
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
    if (!activeSoloSession || soloStartPending.current) return;
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
    if (!activeSoloSession || soloStartPending.current) return;
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
    if (!activeSoloSession || soloStartPending.current) return;
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
    if (!activeSoloSession || soloStartPending.current) return;
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
      || backgroundRecoveryPending.current
    ) return;

    // Timer zero kết thúc theo cutoff dự kiến, không cộng thêm độ trễ của tick UI.
    void completeActiveSoloSession(Date.parse(activeSoloSession.startedAt) + activeSoloSession.durationSeconds * 1_000);
  }, [activeSoloSession, currentScreen, isCompletingSolo, soloSecondsLeft]);

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
        <ScrollView
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
            isStarting={isStartingSolo}
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
          />
        )}

        {currentScreen === '04-solo-summary' && soloSummary && (
          <SoloSummaryScreen
            summary={soloSummary}
            onNewFocus={() => {
              setSoloSummaryPendingView(false);
              setCurrentScreen('02-solo-select');
            }}
          />
        )}

        {currentScreen === '05-group-lobby' && (
          <GroupLobbyScreen
            roomPin="#8821"
            participants={participants}
            isHostRole={isHostRole}
            showEmptyState={showEmptyState}
            onStartSession={() => setCurrentScreen('06-group-active')}
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
        </ScrollView>
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
