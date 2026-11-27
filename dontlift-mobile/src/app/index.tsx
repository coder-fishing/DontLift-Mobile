import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { ScreenId } from '../types';
import { Colors } from '../constants/theme';
import { Header } from '../components/Header';
import { AppBackground } from '../components/AppBackground';
import { BottomNav } from '../components/BottomNav';

// 10 Core Screens
import { LoginScreen } from '../screens/LoginScreen';
import { SoloSelectScreen } from '../screens/SoloSelectScreen';
import { SoloTimerScreen } from '../screens/SoloTimerScreen';
import { SoloSummaryScreen } from '../screens/SoloSummaryScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { GroupHistoryScreen } from '../screens/GroupHistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { createSettingsRepository } from '../features/settings/settings-repository';
import { createFeedbackService } from '../features/settings/feedback-service';
import { nativeFeedbackAdapters } from '../features/settings/native-feedback';
import { createGroupHistoryRepository, type GroupActionableSession } from '../features/history/group-history-repository';
import { createSoloHistoryRepository } from '../features/history/solo-history-repository';
import { GroupLobbyScreen } from '../screens/GroupLobbyScreen';
import { useGroupLobbyDashboard } from '../features/history/use-group-lobby-dashboard';
import { useGroupHistorySync } from '../features/history/use-group-history-sync';
import { createLobbyLeaveRepository } from '../features/rooms/lobby-leave-repository';
import { GroupActiveScreen } from '../screens/GroupActiveScreen';
import { GroupSummaryScreen } from '../screens/GroupSummaryScreen';
import { BillAllocationScreen } from '../screens/BillAllocationScreen';
import { VietQRSettlementScreen } from '../screens/VietQRSettlementScreen';
import { SettlementDetailsScreen } from '../screens/SettlementDetailsScreen';
import { PremiumScreen } from '../screens/PremiumScreen';
import { createPremiumApi } from '../features/premium/premium-api';
import { premiumIsActive } from '../features/premium/premium-entitlement';
import { HardwareDiagnosticsScreen } from '../screens/HardwareDiagnosticsScreen';
import { useAuthSession } from '../features/auth/auth-session';
import { useSensorAvailability } from '../features/sensors/use-sensor-availability';
import type { RegistrationProfile, RegistrationUser } from '../features/auth/auth-controller';
import type { AuthSessionState } from '../features/auth/auth-session-controller';
import { getConfiguredFirebaseRuntime } from '../features/auth/firebase-adapters';
import { getLocalDatabase } from '../features/local/database';
import { createRoomRepository, type CreatedRoom, type JoinedRoom } from '../features/rooms/room-repository';
import { useRoomEntry } from '../features/rooms/use-room-entry';
import { useRoomStart } from '../features/rooms/use-room-start';
import { useRoomLobbyMembership } from '../features/rooms/use-room-lobby-membership';
import { useRoomCompletionActions } from '../features/rooms/use-room-completion-actions';
import { useRoomVotingActions } from '../features/rooms/use-room-voting-actions';
import { useGroupSessionRuntime } from '../features/rooms/use-group-session-runtime';
import { useRoomLiveness } from '../features/rooms/use-room-liveness';
import { useGroupTerminalLifecycle } from '../features/rooms/use-group-terminal-lifecycle';
import { useEarlyExitCutoffRetry } from '../features/rooms/use-early-exit-cutoff-retry';
import { useGroupLifecycleCleanup } from '../features/rooms/use-group-lifecycle-cleanup';
import { useRoomLobbySubscription } from '../features/rooms/use-room-lobby-subscription';
import { useCachedRoomRestore } from '../features/rooms/use-cached-room-restore';
import { useGroupBillActions } from '../features/settlement/use-group-bill-actions';
import { listenToOwnRoomRemoval, type RoomLobbyState, type RoomLobbySnapshot } from '../features/rooms/room-listener';
import { createGroupViolationRepository } from '../features/rooms/group-violation-repository';
import { useCompletedGroupViolationSync } from '../features/rooms/use-completed-group-violation-sync';
import { createGroupCaptureWorkTracker } from '../features/rooms/group-capture-work';
import { createEarlyExitRepository, type EarlyExitRequest } from '../features/rooms/early-exit-repository';
import { listenToOpenEarlyExitRequests } from '../features/rooms/early-exit-listener';
import { createTerminationVoteRepository } from '../features/rooms/termination-vote-repository';
import { createRoomCompletionRepository } from '../features/rooms/room-completion-repository';
import { createSettlementDetailsRepository, type SettlementDetailsState } from '../features/settlement/settlement-details-repository';
import { createBankDirectoryRepository } from '../features/settlement/bank-directory';
import { createBankAppDirectoryRepository } from '../features/bank-transfer/bank-app-directory';
import { createReceiptScanApi } from '../features/settlement/receipt-scan-api';
import { createReceiptEvidenceApi } from '../features/settlement/receipt-evidence-api';
import { createProfileRepository } from '../features/profile/profile-repository';
import { useCanonicalProfile } from '../features/profile/use-canonical-profile';
import { createBillRepository } from '../features/settlement/bill-repository';
import { createPaymentStatusRepository } from '../features/settlement/payment-status-repository';
import { acceptsBillProgress } from '../features/settlement/payment-status-domain';
import { listenToPublishedBill, type PublishedBillState } from '../features/settlement/published-bill-listener';
import { billPublicationKey, shouldOpenPublishedBillForMember } from '../features/settlement/published-bill-navigation';
import { selectPublishedBillState } from '../features/settlement/published-bill-state';
import { shouldTrackGroupConnectivity } from '../features/settlement/group-connectivity';
import { createRoomLivenessRepository } from '../features/rooms/room-liveness-repository';
import { listenToTerminationVote, type TerminationVoteState } from '../features/rooms/termination-vote-listener';
import { JoinRoomScreen } from '../screens/JoinRoomScreen';
import { createBackgroundRecoveryRepository } from '../features/solo/background-recovery';
import type { ForegroundDetectionViewState } from '../features/solo/foreground-detection-controller';
import { useSoloSessionRuntime } from '../features/solo/hooks/use-solo-session-runtime';

const backgroundRecovery = createBackgroundRecoveryRepository();
const settingsRepository = createSettingsRepository();
const feedbackService = createFeedbackService(settingsRepository, nativeFeedbackAdapters);
const INITIAL_DETECTION_STATE: ForegroundDetectionViewState = {
  orientation: 'UNKNOWN',
  isGraceActive: false,
  isViolationActive: false,
  graceSeconds: 0,
  violationsCount: 0,
  violationDurationSeconds: 0,
};

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <AppBackground />
      <HomeContent />
    </View>
  );
}

function HomeContent() {
  const session = useAuthSession();

  if (session.state.kind === 'loading') {
    return (
      <View style={styles.authLoading}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.light.background} />
        <ActivityIndicator accessibilityLabel="Restoring account session" size="large" color={Colors.light.primary} />
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
      <StatusBar barStyle="dark-content" backgroundColor={Colors.light.background} />
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
  const roomRuntime = useMemo(() => getConfiguredFirebaseRuntime(Platform.OS, __DEV__), [profile.uid]);
  const profileRepository = useMemo(() => createProfileRepository({
    firestore: roomRuntime.firestore,
    auth: roomRuntime.auth,
  }), [roomRuntime]);
  const acceptCanonicalProfile = session.acceptCanonicalProfile;
  const premiumApi = useMemo(() => createPremiumApi(roomRuntime.auth), [roomRuntime.auth]);
  const receiptScanApi = useMemo(() => createReceiptScanApi(roomRuntime.auth), [roomRuntime.auth]);
  const receiptEvidenceApi = useMemo(() => createReceiptEvidenceApi(roomRuntime.auth), [roomRuntime.auth]);
  useCanonicalProfile({ profile, repository: profileRepository, acceptCanonicalProfile });
  const handleProfileUpdated = useCallback((canonical: RegistrationProfile) => {
    acceptCanonicalProfile(canonical);
  }, [acceptCanonicalProfile]);
  const groupHistoryRepository = useMemo(() => createGroupHistoryRepository({
    firestore: roomRuntime.firestore, auth: roomRuntime.auth,
  }), [roomRuntime]);
  useGroupHistorySync(groupHistoryRepository, profile.uid);
  const roomRepository = useMemo(() => createRoomRepository({
      firestore: roomRuntime.firestore,
      auth: roomRuntime.auth,
      database: getLocalDatabase(),
      randomUUID: Crypto.randomUUID,
    }), [roomRuntime]);
  const lobbyLeaveRepository = useMemo(() => createLobbyLeaveRepository({
    firestore: roomRuntime.firestore, auth: roomRuntime.auth, database: getLocalDatabase(),
  }), [roomRuntime]);
  const roomLivenessRepository = useMemo(() => createRoomLivenessRepository({
    firestore: roomRuntime.firestore,
    auth: roomRuntime.auth,
  }), [roomRuntime]);
  const groupViolationRepository = useMemo(() => createGroupViolationRepository({
    firestore: roomRuntime.firestore,
    auth: roomRuntime.auth,
  }), [roomRuntime]);
  const earlyExitRepository = useMemo(() => createEarlyExitRepository({
    firestore: roomRuntime.firestore,
    auth: roomRuntime.auth,
    createId: Crypto.randomUUID,
  }), [roomRuntime]);
  const terminationVoteRepository = useMemo(() => createTerminationVoteRepository({
    firestore: roomRuntime.firestore,
    auth: roomRuntime.auth,
  }), [roomRuntime]);
  const roomCompletionRepository = useMemo(() => createRoomCompletionRepository({
    firestore: roomRuntime.firestore,
    auth: roomRuntime.auth,
  }), [roomRuntime]);
  const settlementDetailsRepository = useMemo(() => createSettlementDetailsRepository({
    firestore: roomRuntime.firestore,
    auth: roomRuntime.auth,
  }), [roomRuntime]);
  const billRepository = useMemo(() => createBillRepository({
    firestore: roomRuntime.firestore,
    auth: roomRuntime.auth,
  }), [roomRuntime]);
  const settlementBankDirectory = useMemo(() => createBankDirectoryRepository(), []);
  const settlementBankAppDirectory = useMemo(() => createBankAppDirectoryRepository(), []);
  // Navigation
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('02-solo-select');
  const [groupHistoryInitialRoomId, setGroupHistoryInitialRoomId] = useState<string>();
  const settingsReturnScreen = useRef<ScreenId>('02-solo-select');
  const [createdRoom, setCreatedRoom] = useState<CreatedRoom | null>(null);
  const restoredGroupRoomId = useRef<string | null>(null);
  const terminalRoomCleanupInFlight = useRef(new Set<string>());
  const groupLifecycleCutoffs = useRef(new Map<string, number>());
  const [joinedRoom, setJoinedRoom] = useState<JoinedRoom | null>(null);
  const [roomLobbyState, setRoomLobbyState] = useState<RoomLobbyState | null>(null);
  const [groupTimerSeconds, setGroupTimerSeconds] = useState(0);
  const [groupDetection, setGroupDetection] = useState<ForegroundDetectionViewState>(INITIAL_DETECTION_STATE);
  const [groupIsOnline, setGroupIsOnline] = useState(false);
  const [groupSyncMessage, setGroupSyncMessage] = useState<string>();
  const [groupSyncPendingCount, setGroupSyncPendingCount] = useState(0);
  const pendingGroupActionDestination = useRef<{ roomId: string; action: GroupActionableSession['action'] } | null>(null);
  const leavingLobby = useRef(false);
  const kickingLobby = useRef(false);
  const lobbyActionBusyRefs = useMemo(() => ({ leaving: leavingLobby, removing: kickingLobby }), []);
  const [openEarlyExitRequests, setOpenEarlyExitRequests] = useState<EarlyExitRequest[]>([]);
  const [terminationVoteState, setTerminationVoteState] = useState<TerminationVoteState>({ vote: null, ownBallot: null, error: false });
  const earlyExitCleanupInFlight = useRef(new Set<string>());
  const groupCaptureWork = useRef(new Map<string, ReturnType<typeof createGroupCaptureWorkTracker>>());
  const roomEntry = useRoomEntry({
    repository: roomRepository,
    displayName: profile.displayName,
    setCurrentScreen,
    setCreatedRoom,
    setJoinedRoom,
    restoredRoomId: restoredGroupRoomId,
    createRequestId: Crypto.randomUUID,
  });
  const lobbyRoom = joinedRoom ?? createdRoom;
  const votingActions = useRoomVotingActions({
    roomId: lobbyRoom?.roomId,
    earlyExitRepository,
    terminationVoteRepository,
    terminationVoteState,
  });
  const roomStart = useRoomStart(roomRepository, lobbyRoom?.roomId, () => leavingLobby.current || kickingLobby.current);
  const lobbyMembership = useRoomLobbyMembership({
    roomId: lobbyRoom?.roomId,
    roomState: roomLobbyState,
    uid: profile.uid,
    isStartingRoom: roomStart.isStartingRoom,
    repository: lobbyLeaveRepository,
    busyRefs: lobbyActionBusyRefs,
    onLeft: roomId => {
      setCreatedRoom(current => current?.roomId === roomId ? null : current);
      setJoinedRoom(current => current?.roomId === roomId ? null : current);
      setRoomLobbyState(null);
      lobbyMembership.clearRemoveError();
      roomEntry.clearPendingRoomCommands();
      roomStart.clearPendingStart();
      setCurrentScreen('05-group-lobby');
    },
  });
  const lobbyDashboard = useGroupLobbyDashboard({
    repository: groupHistoryRepository,
    uid: profile.uid,
    isPremium: profile.isPremium,
    shouldLoad: currentScreen === '05-group-lobby' && !lobbyRoom,
  });

  const openActionableGroupSession = useCallback(async (selected: GroupActionableSession) => {
    lobbyDashboard.setActionableErrorMessage(undefined);
    pendingGroupActionDestination.current = null;
    try {
      const current = await groupHistoryRepository.readActionableSession(profile.uid, selected.roomId);
      if (!current) throw new Error('This session no longer needs attention. The list has been refreshed.');
      const room = await roomRepository.loadMemberRoom(selected.roomId,
        current.action === 'RESUME_SESSION' ? 'ACTIVE' : 'COMPLETED');
      if (current.action === 'AWAITING_CONFIRMATION') {
        setGroupHistoryInitialRoomId(current.roomId);
        setCurrentScreen('15-group-history');
        return;
      }
      pendingGroupActionDestination.current = { roomId: current.roomId, action: current.action };
      restoredGroupRoomId.current = current.roomId;
      setRoomLobbyState(null);
      setJoinedRoom(null);
      setCreatedRoom(room);
      setCurrentScreen('05-group-lobby');
    } catch (error) {
      const message = error instanceof Error && error.message.startsWith('This session')
        ? error.message : 'Could not open this session. It may have changed or your membership may no longer be active.';
      lobbyDashboard.setActionableErrorMessage(message);
      void lobbyDashboard.loadActionableSessions();
    }
  }, [groupHistoryRepository, lobbyDashboard.loadActionableSessions, lobbyDashboard.setActionableErrorMessage, profile.uid, roomRepository]);


  const { reconcileLifecycleAtCutoff: reconcileGroupLifecycleAtCutoff, runEarlyExitCutoffCleanup } = useGroupLifecycleCleanup({
    backgroundRecovery,
    violationRepository: groupViolationRepository,
    captureWork: groupCaptureWork,
  });

  useCachedRoomRestore({ uid: profile.uid, restoredRoomId: restoredGroupRoomId, setCreatedRoom });

  useCompletedGroupViolationSync(groupViolationRepository);

  useRoomLobbySubscription({
    firestore: roomRuntime.firestore,
    roomId: lobbyRoom?.roomId,
    uid: profile.uid,
    lifecycleCutoffs: groupLifecycleCutoffs,
    setRoomState: setRoomLobbyState,
    setCreatedRoom,
    setJoinedRoom,
    setOpenEarlyExitRequests,
  });

  useRoomLiveness({
    roomId: lobbyRoom?.roomId,
    uid: profile.uid,
    roomState: roomLobbyState,
    repository: roomLivenessRepository,
  });



  useEffect(() => {
    if (!lobbyRoom) return undefined;
    return listenToOpenEarlyExitRequests(
      roomRuntime.firestore,
      lobbyRoom.roomId,
      requests => { setOpenEarlyExitRequests(requests); votingActions.clearEarlyExitError(); },
      votingActions.setEarlyExitLoadError,
    );
  }, [lobbyRoom?.roomId, roomRuntime.firestore, votingActions.clearEarlyExitError, votingActions.setEarlyExitLoadError]);

  useEffect(() => {
    if (!lobbyRoom) {
      setTerminationVoteState({ vote: null, ownBallot: null, error: false });
      return undefined;
    }
    return listenToTerminationVote(roomRuntime.firestore, lobbyRoom.roomId, profile.uid, state => {
      setTerminationVoteState(state);
      if (!state.error) votingActions.clearTerminationVoteError();
    });
  }, [lobbyRoom?.roomId, roomRuntime.firestore, profile.uid, votingActions.clearTerminationVoteError]);

  useGroupTerminalLifecycle({
    roomState: roomLobbyState,
    currentScreen,
    uid: profile.uid,
    violationRepository: groupViolationRepository,
    cleanupInFlight: terminalRoomCleanupInFlight,
    restoredRoomId: restoredGroupRoomId,
    captureWork: groupCaptureWork,
    setCurrentScreen,
    setCreatedRoom,
    setJoinedRoom,
    reconcileLifecycleAtCutoff: reconcileGroupLifecycleAtCutoff,
    runEarlyExitCutoffCleanup,
  });

  const earlyExitSnapshot = roomLobbyState?.snapshot;
  const earlyExitCutoffUtcMs = earlyExitSnapshot?.members.find(member => member.uid === profile.uid)?.earlyExitAtUtcMs;
  useEarlyExitCutoffRetry({
    snapshot: earlyExitSnapshot,
    uid: profile.uid,
    cutoffUtcMs: earlyExitCutoffUtcMs,
    repository: groupViolationRepository,
    cleanupInFlight: earlyExitCleanupInFlight,
    runCleanup: runEarlyExitCutoffCleanup,
    setOnline: setGroupIsOnline,
    setSyncPendingCount: setGroupSyncPendingCount,
    setSyncMessage: setGroupSyncMessage,
  });

  useEffect(() => {
    if (!lobbyRoom) return undefined;
    const roomId = lobbyRoom.roomId;
    return listenToOwnRoomRemoval(roomRuntime.firestore, roomId, profile.uid, () => {
      if (lobbyMembership.isLeavingRef.current) return;
      setCreatedRoom(current => current?.roomId === roomId ? null : current);
      setJoinedRoom(current => current?.roomId === roomId ? null : current);
      setRoomLobbyState(current => current?.snapshot?.roomId === roomId ? null : current);
      roomEntry.clearPendingRoomCommands();
      roomStart.clearPendingStart();
      lobbyMembership.clearRemoveError();
      setCurrentScreen(current => ['05-group-lobby', '12-join-room', '06-group-active'].includes(current) ? '05-group-lobby' : current);
      void getLocalDatabase().then(db => db.runAsync('DELETE FROM room_members WHERE room_id = ? AND uid = ?', roomId, profile.uid))
        .catch(error => { if (__DEV__) console.warn('[room-removal] local cleanup pending', error); });
      Alert.alert('No longer in room', 'You are no longer a member of this room.');
    });
  }, [lobbyRoom?.roomId, roomRuntime.firestore, profile.uid, roomEntry.clearPendingRoomCommands,
    roomStart.clearPendingStart, lobbyMembership.clearRemoveError, lobbyMembership.isLeavingRef]);

  const roomCompletion = useRoomCompletionActions({
    repository: roomCompletionRepository,
    violationRepository: groupViolationRepository,
    roomId: lobbyRoom?.roomId,
    snapshot: roomLobbyState?.snapshot,
    uid: profile.uid,
    captureWork: groupCaptureWork,
    reconcileLifecycleAtCutoff: reconcileGroupLifecycleAtCutoff,
    runEarlyExitCutoffCleanup,
    onCompleted: () => setCurrentScreen('13-group-summary'),
  });

  useEffect(() => {
    if (currentScreen !== '12-join-room') return undefined;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      roomEntry.cancelRoomJoin();
      return true;
    });
    return () => back.remove();
  }, [currentScreen, roomEntry.cancelRoomJoin]);

  const solo = useSoloSessionRuntime({
    userId: profile.uid,
    currentScreen,
    setCurrentScreen,
    backgroundRecovery,
    feedbackService,
    sensorReady: sensorAvailability.state.kind === 'ready',
  });
  const {
    selectedDuration, setSelectedDuration, selectedMode, setSelectedMode,
    activeSoloSession, soloSecondsLeft, isStartingSolo, isCancellingSolo, isCompletingSolo,
    soloCompletionError, soloSummary, soloSummaryPendingView, setSoloSummaryPendingView,
    soloSyncState, soloSyncWorker, foregroundDetection, isRecoveringBackground, soloStartError,
    handleStartSolo, continueActiveSoloSession, confirmCancelSoloSession, requestFinishSoloSession,
  } = solo;
  // Group State
  const candidateGroupRoom = roomLobbyState?.snapshot;
  const groupRoomSnapshot = candidateGroupRoom?.status === 'ACTIVE'
    && candidateGroupRoom.startedAtUtcMs !== null ? candidateGroupRoom : null;
  const groupSummarySnapshot = candidateGroupRoom?.status === 'COMPLETED' ? candidateGroupRoom : null;

  useEffect(() => {
    const pending = pendingGroupActionDestination.current;
    if (!pending || currentScreen !== '13-group-summary' || groupSummarySnapshot?.roomId !== pending.roomId
      || groupSummarySnapshot.reconciliationStatus !== 'FINALIZED') return;
    pendingGroupActionDestination.current = null;
    if (pending.action === 'SET_UP_BILL' || pending.action === 'REVIEW_PAYMENTS') setCurrentScreen('07-bill-allocation');
  }, [currentScreen, groupSummarySnapshot?.roomId, groupSummarySnapshot?.reconciliationStatus]);
  const [settlementDetailsMode, setSettlementDetailsMode] = useState<'host' | 'member'>('member');
  const [paymentDetailsState, setPaymentDetailsState] = useState<SettlementDetailsState>({ kind: 'loading' });
  const [paymentDetailsRevision, setPaymentDetailsRevision] = useState(0);
  const [publishedBillState, setPublishedBillState] = useState<PublishedBillState>({ kind: 'loading' });
  const [billListenerRevision, setBillListenerRevision] = useState(0);
  const paymentStatusRepository = useMemo(() => createPaymentStatusRepository({
    firestore: roomRuntime.firestore, auth: roomRuntime.auth,
  }), [roomRuntime.firestore, roomRuntime.auth]);
  const autoOpenedBillPublications = useRef(new Set<string>());

  const billActions = useGroupBillActions({
    snapshot: groupSummarySnapshot,
    uid: profile.uid,
    isOnline: groupIsOnline,
    repository: billRepository,
    paymentRepository: paymentStatusRepository,
    publishedBillState,
    setPublishedBillState,
    setListenerRevision: setBillListenerRevision,
  });

  useEffect(() => {
    if (!groupSummarySnapshot || groupSummarySnapshot.reconciliationStatus !== 'FINALIZED') {
      setPublishedBillState({ kind: 'loading' });
      return undefined;
    }
    setPublishedBillState({ kind: 'loading' });
    const roomId = groupSummarySnapshot.roomId;
    return listenToPublishedBill(roomRuntime.firestore, roomId, state => {
      if (billActions.activeBillRoomId.current !== roomId) return;
      if (state.kind === 'published') {
        const revision = state.bill.billRevision ?? 0;
        const latest = billActions.latestBillRevision.current;
        if (!acceptsBillProgress(state.bill, latest)) return;
        billActions.latestBillRevision.current = { roomId, revision, paidCount: state.bill.billPaidCount ?? 0 };
      }
      setPublishedBillState(state);
    });
  }, [groupSummarySnapshot?.roomId, groupSummarySnapshot?.reconciliationStatus, roomRuntime.firestore, billListenerRevision,
    billActions.activeBillRoomId, billActions.latestBillRevision]);

  useEffect(() => {
    const ownMember = groupSummarySnapshot?.members.find(member => member.uid === profile.uid);
    if (publishedBillState.kind === 'published' && publishedBillState.bill.roomId === groupSummarySnapshot?.roomId
      && shouldOpenPublishedBillForMember(publishedBillState, ownMember?.role, currentScreen, autoOpenedBillPublications.current)) {
      // Chỉ tự mở một lần cho mỗi publication; nút Back phải giữ Member ở summary.
      autoOpenedBillPublications.current.add(billPublicationKey(publishedBillState.bill));
      setCurrentScreen('07-bill-allocation');
    }
  }, [publishedBillState, groupSummarySnapshot, profile.uid, currentScreen]);

  const billScreenState = selectPublishedBillState(publishedBillState, billActions.committedBill, groupSummarySnapshot?.roomId);
  useEffect(() => {
    if (currentScreen !== '08-vietqr-settlement') return undefined;
    setPaymentDetailsState({ kind: 'loading' });
    const ownMember = groupSummarySnapshot?.members.find(member => member.uid === profile.uid);
    if (!groupSummarySnapshot || groupSummarySnapshot.reconciliationStatus !== 'FINALIZED'
      || !ownMember || !['ACTIVE', 'EARLY_EXIT'].includes(ownMember.status)) return undefined;
    let active = true;
    const stop = settlementDetailsRepository.listen(groupSummarySnapshot.roomId, state => {
      if (active) setPaymentDetailsState(state);
    });
    return () => { active = false; stop(); };
  }, [currentScreen, groupSummarySnapshot?.roomId, groupSummarySnapshot?.reconciliationStatus,
    groupSummarySnapshot?.members.find(member => member.uid === profile.uid)?.status,
    profile.uid, settlementDetailsRepository, paymentDetailsRevision]);
  const ownGroupRoomMember = groupRoomSnapshot?.members.find(member => member.uid === profile.uid);
  const groupCaptureRoomSnapshot = ownGroupRoomMember?.status === 'ACTIVE' ? groupRoomSnapshot : null;

  useEffect(() => {
    if (!shouldTrackGroupConnectivity(currentScreen)) return undefined;
    let active = true;
    const update = (state: Network.NetworkState) => {
      if (active) setGroupIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    };
    const subscription = Network.addNetworkStateListener(state => {
      update(state);
    });
    void Network.getNetworkStateAsync().then(state => {
      update(state);
    }).catch(() => {
      if (active) setGroupIsOnline(false);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [currentScreen]);

  useEffect(() => {
    if (!groupRoomSnapshot) {
      setGroupTimerSeconds(0);
      return undefined;
    }
    const update = () => setGroupTimerSeconds(Math.max(0, Math.floor((Date.now() - groupRoomSnapshot.startedAtUtcMs!) / 1_000)));
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [groupRoomSnapshot?.roomId, groupRoomSnapshot?.startedAtUtcMs]);

  useGroupSessionRuntime({
    snapshot: groupCaptureRoomSnapshot,
    userId: profile.uid,
    repository: groupViolationRepository,
    backgroundRecovery,
    feedbackService,
    lifecycleCutoffs: groupLifecycleCutoffs,
    captureWork: groupCaptureWork,
    setDetection: setGroupDetection,
    setOnline: setGroupIsOnline,
    setSyncPendingCount: setGroupSyncPendingCount,
    setSyncMessage: setGroupSyncMessage,
  });

  const openSettings = () => {
    if (currentScreen !== '17-settings') settingsReturnScreen.current = currentScreen;
    setCurrentScreen('17-settings');
  };

  const navigateToScreen = (screen: ScreenId) => {
    if (screen === '02-solo-select' && soloSummaryPendingView && soloSummary) {
      setSoloSummaryPendingView(false);
      setCurrentScreen('04-solo-summary');
      return;
    }
    if (screen === '05-group-lobby' && lobbyRoom && groupSummarySnapshot) {
      setCurrentScreen('13-group-summary');
      return;
    }
    if (screen === '07-bill-allocation') {
      const ownMember = candidateGroupRoom?.members.find(member => member.uid === profile.uid);
      if (!candidateGroupRoom || candidateGroupRoom.status !== 'COMPLETED'
        || candidateGroupRoom.reconciliationStatus !== 'FINALIZED' || ownMember?.role !== 'HOST') {
        setCurrentScreen(candidateGroupRoom?.status === 'COMPLETED' ? '13-group-summary'
          : candidateGroupRoom?.status === 'ACTIVE' ? '06-group-active' : '05-group-lobby');
        return;
      }
    }
    if (screen === '08-vietqr-settlement') {
      const ownMember = groupSummarySnapshot?.members.find(member => member.uid === profile.uid);
      if (!groupSummarySnapshot || groupSummarySnapshot.reconciliationStatus !== 'FINALIZED' || !ownMember) {
        setCurrentScreen(groupSummarySnapshot ? '13-group-summary' : '05-group-lobby');
        return;
      }
    }
    if (screen === '07-bill-allocation') {
      const ownMember = groupSummarySnapshot?.members.find(member => member.uid === profile.uid);
      if (!groupSummarySnapshot || groupSummarySnapshot.reconciliationStatus !== 'FINALIZED' || !ownMember) {
        setCurrentScreen(groupSummarySnapshot ? '13-group-summary' : '05-group-lobby');
        return;
      }
    }
    if (screen === '14-settlement-details') {
      const ownMember = groupSummarySnapshot?.members.find(member => member.uid === profile.uid);
      if (!groupSummarySnapshot || groupSummarySnapshot.reconciliationStatus !== 'FINALIZED' || !ownMember) {
        setCurrentScreen(groupSummarySnapshot ? '13-group-summary' : '05-group-lobby');
        return;
      }
      setSettlementDetailsMode(ownMember.role === 'HOST' ? 'host' : 'member');
    }
    setCurrentScreen(screen);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.light.background} />

      {/* Header */}
      <Header
        currentScreen={currentScreen}
        displayName={profile.displayName}
        email={profile.email}
        avatarUri={profile.avatarUri ?? undefined}
        premiumExpiresAtUtcMs={profile.premiumExpiresAtUtcMs}
        onNavigate={navigateToScreen}
        onOpenSettings={openSettings}
      />

      {/* Main Body */}
      <View style={styles.mainBody}>
        {currentScreen === '17-settings' ? (
          <SettingsScreen key={profile.uid} userId={profile.uid} repository={settingsRepository}
            onBack={() => setCurrentScreen(settingsReturnScreen.current)} />
        ) : currentScreen === '16-profile' ? (
          <ProfileScreen key={profile.uid} profile={profile} repository={profileRepository}
            onProfileUpdated={handleProfileUpdated} onSignOut={session.signOut}
            onPremium={() => navigateToScreen('09-activation')}
            onBack={() => navigateToScreen('02-solo-select')} />
        ) : currentScreen === '15-group-history' ? (
          <GroupHistoryScreen key={profile.uid} userId={profile.uid} serverPremium={profile.isPremium}
            currentUserPremiumExpiresAtUtcMs={profile.premiumExpiresAtUtcMs}
            repository={groupHistoryRepository} bankDirectory={settlementBankDirectory} initialRoomId={groupHistoryInitialRoomId}
            onBack={() => { setGroupHistoryInitialRoomId(undefined); navigateToScreen('05-group-lobby'); }} />
        ) : currentScreen === '11-solo-history' ? (
          <HistoryScreen
            userId={profile.uid}
            serverPremium={profile.isPremium}
            repository={soloHistoryRepository}
            onBack={() => navigateToScreen('02-solo-select')}
          />
        ) : currentScreen === '07-bill-allocation' ? (
          groupSummarySnapshot?.reconciliationStatus === 'FINALIZED' ? (
            <BillAllocationScreen
              roomId={groupSummarySnapshot.roomId}
              mode={groupSummarySnapshot.members.find(member => member.uid === profile.uid)?.role === 'HOST' ? 'host' : 'member'}
              isPremium={premiumIsActive(profile.premiumExpiresAtUtcMs)}
              onOpenPremium={() => navigateToScreen('09-activation')}
              onScanReceipt={(roomId, uri, mimeType) => receiptScanApi.scan(roomId, uri, mimeType)}
              onUploadReceiptEvidence={receiptEvidenceApi.upload}
              onDeleteReceiptEvidence={receiptEvidenceApi.deleteUnpublished}
              getReceiptEvidenceImageSource={receiptEvidenceApi.imageSource}
              members={groupSummarySnapshot.members
                .filter(member => member.status === 'ACTIVE' || member.status === 'EARLY_EXIT')
                .map(member => ({ uid: member.uid, displayName: member.displayName, penaltyScore: member.penaltyScore,
                  avatarUri: member.avatarUri, premiumExpiresAtUtcMs: member.uid === profile.uid
                    ? profile.premiumExpiresAtUtcMs : member.premiumExpiresAtUtcMs }))}
              state={billScreenState}
              pendingPaymentMemberUid={billActions.pendingPayment.current?.memberUid}
              isMarkingPayment={billActions.isMarkingPayment}
              paymentError={billActions.paymentError}
              onMarkPaid={(uid, publicationId, revision) => { void billActions.handleMarkPayment(uid, publicationId, revision); }}
              onRetryPayment={() => { void billActions.handleMarkPayment(); }}
              actorUid={profile.uid}
              onPayShare={() => setCurrentScreen('08-vietqr-settlement')}
              isOnline={groupIsOnline}
              isPublishing={billActions.isPublishingBill}
              pendingTotalVnd={billActions.pendingBillCommand.current?.command.totalBillVnd}
              pendingShareOverrides={billActions.pendingBillCommand.current?.command.shareOverrides}
              isApplyingOverride={billActions.isApplyingBillOverride}
              hasPendingOverride={billActions.pendingBillOverride.current != null}
              publishError={billActions.billPublishError}
              overrideError={billActions.billOverrideError}
              onPublish={(amount, overrides, evidencePath) => { void billActions.handlePublishBill(amount, overrides, evidencePath); }}
              onApplyOverrides={(overrides, revision) => { void billActions.handleApplyBillOverrides(overrides, revision); }}
              onRetry={() => { void billActions.handleRetryPublishedBill(); }}
              onRetryPublish={() => { void billActions.handlePublishBill(); }}
              onRetryOverride={() => { void billActions.handleApplyBillOverrides(); }}
              onBack={() => setCurrentScreen('13-group-summary')}
            />
          ) : <Text accessibilityRole="alert">Waiting for finalized room scores…</Text>
        ) : <ScrollView
          key={currentScreen}
          style={styles.mainBodyScrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: (currentScreen === '06-group-active' ? 132 : currentScreen === '13-group-summary' ? 220 : 115) + insets.bottom },
            currentScreen === '05-group-lobby' ? styles.lobbyScrollContent : null,
            currentScreen === '06-group-active' ? styles.activeSessionScrollContent : null,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps={currentScreen === '12-join-room' ? 'handled' : 'never'}
          automaticallyAdjustKeyboardInsets={currentScreen === '12-join-room'}
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
              void soloSyncWorker.current?.retrySession(soloSummary.sessionId);
            }}
            onNewFocus={() => {
              setSoloSummaryPendingView(false);
              setCurrentScreen('02-solo-select');
            }}
          />
        )}

        {currentScreen === '05-group-lobby' && (
          <GroupLobbyScreen
            currentUserId={profile.uid}
            currentUserPremiumExpiresAtUtcMs={profile.premiumExpiresAtUtcMs}
            onOpenHistory={() => { setGroupHistoryInitialRoomId(undefined); setCurrentScreen('15-group-history'); }}
            recentSessions={lobbyDashboard.recentSessions}
            recentMemberPreviews={lobbyDashboard.recentMemberPreviews}
            recentSessionsState={lobbyDashboard.recentSessionsState}
            actionableSessions={lobbyDashboard.actionableSessions}
            actionableSessionsState={lobbyDashboard.actionableSessionsState}
            actionableErrorMessage={lobbyDashboard.actionableErrorMessage}
            actionableHasMore={lobbyDashboard.actionableHasMore}
            isLoadingMoreActionable={lobbyDashboard.isLoadingMoreActionable}
            onOpenRecentSession={roomId => { setGroupHistoryInitialRoomId(roomId); setCurrentScreen('15-group-history'); }}
            onRetryRecentSessions={() => { void lobbyDashboard.loadRecentSessions(); }}
            onOpenActionableSession={item => { void openActionableGroupSession(item); }}
            onRetryActionableSessions={() => { void lobbyDashboard.loadActionableSessions(); }}
            onLoadMoreActionableSessions={() => { void lobbyDashboard.loadMoreActionableSessions(); }}
            room={lobbyRoom ? {
              roomId: lobbyRoom.roomId, pin: lobbyRoom.pin, invitation: lobbyRoom.invitation,
              hostUid: lobbyRoom.hostUid,
              createdAt: 'createdAt' in lobbyRoom ? lobbyRoom.createdAt : lobbyRoom.roomCreatedAt,
              localCacheSaved: lobbyRoom.localCacheSaved,
            } : null}
            isCreating={roomEntry.isCreatingRoom}
            errorMessage={roomEntry.roomCreateError}
            onCancelCreate={roomEntry.cancelRoomCreateAndJoin}
            lobbyState={roomLobbyState}
            isHost={lobbyRoom?.hostUid === profile.uid}
            isStarting={roomStart.isStartingRoom}
            isLeaving={lobbyMembership.isLeaving}
            leaveError={lobbyMembership.leaveError}
            onLeaveRoom={lobbyMembership.confirmLeave}
            onRemoveMember={lobbyMembership.confirmRemoveMember}
            removingMemberUid={lobbyMembership.removingMemberUid}
            removeError={lobbyMembership.removeError}
            startError={roomStart.roomStartError}
            onStartRoom={() => { void roomStart.startRoom(); }}
            onCreateRoom={() => { void roomEntry.handleCreateRoom(); }}
            onJoinRoom={() => roomEntry.openJoinRoom(() => {
              lobbyMembership.clearLeaveError();
              lobbyMembership.clearRemoveError();
            })}
          />
        )}

        {currentScreen === '12-join-room' && (
          <JoinRoomScreen
            result={joinedRoom}
            isJoining={roomEntry.isJoiningRoom}
            errorMessage={roomEntry.roomJoinError}
            onJoin={(pin) => { void roomEntry.handleJoinRoom(pin); }}
            onCancel={roomEntry.cancelRoomJoin}
            onOpenLobby={() => { setCurrentScreen('05-group-lobby'); }}
          />
        )}

        {currentScreen === '06-group-active' && (
          groupRoomSnapshot
            ? <GroupActiveScreen snapshot={groupRoomSnapshot} elapsedSeconds={groupTimerSeconds}
                detection={groupDetection} isOnline={groupIsOnline} syncMessage={groupSyncMessage}
                pendingSyncCount={groupSyncPendingCount}
                actorUid={profile.uid} currentUserPremiumExpiresAtUtcMs={profile.premiumExpiresAtUtcMs} openEarlyExitRequests={openEarlyExitRequests}
                isRequestingEarlyExit={votingActions.isRequestingEarlyExit} decidingEarlyExit={votingActions.decidingEarlyExit}
                earlyExitError={votingActions.earlyExitError} onRequestEarlyExit={() => { void votingActions.handleRequestEarlyExit(); }}
                onDecideEarlyExit={(request, decision) => { void votingActions.handleDecideEarlyExit(request, decision); }}
                terminationVoteState={terminationVoteState} isOpeningTerminationVote={votingActions.isOpeningTerminationVote}
                isCastingTerminationVote={votingActions.isCastingTerminationVote} terminationVoteError={votingActions.terminationVoteError}
                onOpenTerminationVote={() => { void votingActions.handleOpenTerminationVote(); }}
                onCastTerminationVote={choice => { void votingActions.handleCastTerminationVote(choice); }}
                isCompletingRoom={roomCompletion.isCompletingRoom} completionError={roomCompletion.roomCompletionError}
                onCompleteRoom={() => { void roomCompletion.handleCompleteRoom(); }} />
            : <Text accessibilityRole="alert">Waiting for the active room snapshot…</Text>
        )}

        {currentScreen === '13-group-summary' && (
          groupSummarySnapshot
            ? <GroupSummaryScreen snapshot={groupSummarySnapshot} actorUid={profile.uid}
                currentUserPremiumExpiresAtUtcMs={profile.premiumExpiresAtUtcMs}
                isOnline={groupIsOnline} isSyncing={roomCompletion.isAcknowledgingRoom}
                isFinalizingOverride={roomCompletion.isFinalizingRoomOverride}
                errorMessage={roomCompletion.roomAcknowledgmentError}
                overrideErrorMessage={roomCompletion.roomOverrideError}
                onSyncAndAcknowledge={() => { void roomCompletion.handleAcknowledgeRoomSync(); }}
                onFinalizeWithOverride={uids => { void roomCompletion.handleFinalizeRoomOverride(uids); }}
                billState={billScreenState}
                onOpenBillAllocation={() => setCurrentScreen('07-bill-allocation')}
                onOpenSettlementDetails={() => {
                  const ownMember = groupSummarySnapshot.members.find(member => member.uid === profile.uid);
                  if (!ownMember) return;
                  setSettlementDetailsMode(ownMember.role === 'HOST' ? 'host' : 'member');
                  setCurrentScreen('14-settlement-details');
                }}
                onOpenGroupHistory={() => {
                  setGroupHistoryInitialRoomId(groupSummarySnapshot.roomId);
                  setCurrentScreen('15-group-history');
                }}
                onReturnToGroupHome={() => {
                  setCreatedRoom(null);
                  setJoinedRoom(null);
                  setCurrentScreen('05-group-lobby');
                }} />
            : <Text accessibilityRole="alert">Waiting for the completed room and reconciliation state…</Text>
        )}

        {currentScreen === '14-settlement-details' && groupSummarySnapshot
          && groupSummarySnapshot.reconciliationStatus === 'FINALIZED' ? (
          <SettlementDetailsScreen
            roomId={groupSummarySnapshot.roomId}
            mode={settlementDetailsMode}
            repository={settlementDetailsRepository}
            bankDirectory={settlementBankDirectory}
            onContinueToBill={() => setCurrentScreen('07-bill-allocation')}
            onSaved={() => {
              setCurrentScreen('07-bill-allocation');
            }}
            onBack={() => setCurrentScreen('13-group-summary')}
          />
        ) : null}

        {currentScreen === '08-vietqr-settlement' && groupSummarySnapshot && (
          <VietQRSettlementScreen roomId={groupSummarySnapshot.roomId} roomPin={groupSummarySnapshot.pin}
            actorUid={profile.uid} member={groupSummarySnapshot.members.find(member => member.uid === profile.uid)}
            billState={billScreenState} detailsState={paymentDetailsState} isOnline={groupIsOnline} bankDirectory={settlementBankDirectory}
            bankAppDirectory={settlementBankAppDirectory}
            onRefresh={() => {
              setPaymentDetailsState({ kind: 'loading' });
              setPaymentDetailsRevision(revision => revision + 1);
              setBillListenerRevision(revision => revision + 1);
            }}
            onBack={() => setCurrentScreen('07-bill-allocation')} />
        )}

        {currentScreen === '09-activation' && <PremiumScreen key={profile.uid} uid={profile.uid} api={premiumApi}
          expiresAtUtcMs={profile.premiumExpiresAtUtcMs} bankDirectory={settlementBankDirectory} bankAppDirectory={settlementBankAppDirectory} />}

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
        pendingGroupSyncCount={groupSyncPendingCount}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  authLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loginGate: { flex: 1, position: 'relative' },
  loginGateContent: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  container: {
    flex: 1,
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
  },
  lobbyScrollContent: { paddingTop: 28 },
  activeSessionScrollContent: { paddingTop: 28 },
});
