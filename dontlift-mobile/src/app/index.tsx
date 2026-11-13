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
import { createGroupHistoryRepository, type GroupActionableCursor, type GroupActionableSession, type GroupRoomRosterPreview } from '../features/history/group-history-repository';
import type { GroupHistoryEntry } from '../features/history/group-history-model';
import { createSoloHistoryRepository } from '../features/history/solo-history-repository';
import { GroupLobbyScreen } from '../screens/GroupLobbyScreen';
import type { ActionableSessionsState, RecentSessionsState } from '../components/GroupHomeDashboard';
import { createLobbyLeaveRepository } from '../features/rooms/lobby-leave-repository';
import { GroupActiveScreen } from '../screens/GroupActiveScreen';
import { GroupSummaryScreen } from '../screens/GroupSummaryScreen';
import { BillAllocationScreen } from '../screens/BillAllocationScreen';
import { VietQRSettlementScreen } from '../screens/VietQRSettlementScreen';
import { SettlementDetailsScreen } from '../screens/SettlementDetailsScreen';
import { PremiumScreen } from '../screens/PremiumScreen';
import { createPremiumApi } from '../features/premium/premium-api';
import { HardwareDiagnosticsScreen } from '../screens/HardwareDiagnosticsScreen';
import { useAuthSession } from '../features/auth/auth-session';
import { useSensorAvailability } from '../features/sensors/use-sensor-availability';
import { accelerometerAdapter } from '../features/sensors/sensor-adapter';
import type { RegistrationProfile, RegistrationUser } from '../features/auth/auth-controller';
import type { AuthSessionState } from '../features/auth/auth-session-controller';
import { getConfiguredFirebaseRuntime } from '../features/auth/firebase-adapters';
import { getLocalDatabase } from '../features/local/database';
import { createRoomRepository, persistEarlyExitProjection, persistRoomLobbyProjection, persistTerminalRoomProjection, restoreCachedActiveRoom, RoomCreateError, type CreatedRoom, type RoomCreateCommand, type JoinedRoom, RoomJoinError, roomJoinErrorMessage, RoomStartError, roomStartErrorMessage, type RoomStartCommand } from '../features/rooms/room-repository';
import { listenToRoomLobby, listenToOwnRoomRemoval, type RoomLobbyState, type RoomLobbySnapshot } from '../features/rooms/room-listener';
import { createGroupViolationRepository, GroupViolationError } from '../features/rooms/group-violation-repository';
import { createEarlyExitSyncRetry } from '../features/rooms/early-exit-sync-retry';
import { createEarlyExitCleanupRetry } from '../features/rooms/early-exit-cleanup-retry';
import { createCompletedGroupViolationSyncRetry } from '../features/rooms/completed-group-violation-sync-retry';
import { createGroupCaptureWorkTracker } from '../features/rooms/group-capture-work';
import { createEarlyExitRepository, EarlyExitError, type EarlyExitDecision, type EarlyExitRequest } from '../features/rooms/early-exit-repository';
import { listenToOpenEarlyExitRequests } from '../features/rooms/early-exit-listener';
import { createTerminationVoteRepository, TerminationVoteError, type TerminationChoice } from '../features/rooms/termination-vote-repository';
import { createRoomCompletionRepository, RoomCompletionError } from '../features/rooms/room-completion-repository';
import { shouldNavigateToGroupSummary } from '../features/rooms/group-terminal-navigation';
import { createSettlementDetailsRepository, type SettlementDetailsState } from '../features/settlement/settlement-details-repository';
import { createBankDirectoryRepository } from '../features/settlement/bank-directory';
import { createBankAppDirectoryRepository } from '../features/bank-transfer/bank-app-directory';
import { createProfileRepository } from '../features/profile/profile-repository';
import { createBillRepository, BillRepositoryError, type ApplyBillOverridesCommand, type CalculateBillCommand, type PublishedBill } from '../features/settlement/bill-repository';
import type { BillShareOverride } from '../features/settlement/bill-allocation';
import { createPaymentStatusRepository, PaymentStatusError, type MarkPaymentCommand } from '../features/settlement/payment-status-repository';
import { acceptsBillProgress } from '../features/settlement/payment-status-domain';
import { listenToPublishedBill, type PublishedBillState } from '../features/settlement/published-bill-listener';
import { billPublicationKey, shouldOpenPublishedBillForMember } from '../features/settlement/published-bill-navigation';
import { selectPublishedBillState } from '../features/settlement/published-bill-state';
import { shouldTrackGroupConnectivity } from '../features/settlement/group-connectivity';
import {
  createRoomLivenessRepository, HOST_HEARTBEAT_INTERVAL_MS, HOST_STALE_AFTER_MS, STALE_ROOM_RETRY_MS,
  RoomLivenessError,
} from '../features/rooms/room-liveness-repository';
import { listenToTerminationVote, type TerminationVoteState } from '../features/rooms/termination-vote-listener';
import { roomCreateErrorMessage } from '../features/rooms/room-create-error';
import { JoinRoomScreen } from '../screens/JoinRoomScreen';
import { createBackgroundRecoveryRepository } from '../features/solo/background-recovery';
import { createSessionLifecycleController } from '../features/solo/session-lifecycle-controller';
import {
  createForegroundDetectionController,
  type ForegroundDetectionViewState,
} from '../features/solo/foreground-detection-controller';
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

function earlyExitErrorMessage(error: unknown): string {
  if (!(error instanceof EarlyExitError)) return 'Could not complete the early-exit action. Try again.';
  switch (error.code) {
    case 'unauthenticated': return 'Your sign-in expired. Sign in again and retry.';
    case 'invalid-argument': return 'The early-exit request is invalid.';
    case 'not-found': return 'This room or request no longer exists.';
    case 'failed-precondition': return 'The room or request is no longer in a state that allows this action.';
    case 'permission-denied': return 'Firebase rejected this action. Confirm the room role and deployed Firestore Rules.';
    case 'unavailable': return 'Connect to Firebase and retry. No offline command was queued.';
    case 'already-exists': return 'This request ID was already used for another request.';
    default: return 'Could not complete the early-exit action. Try again.';
  }
}

function billPublishErrorMessage(error: unknown): string {
  if (!(error instanceof BillRepositoryError)) return 'Could not publish the bill split. Reconnect and retry.';
  switch (error.code) {
    case 'unauthenticated': return 'Your sign-in expired. Sign in again and retry.';
    case 'invalid-argument': return 'Enter a whole bill amount of at least 1,000 VND.';
    case 'not-found': return 'This room could not be found.';
    case 'permission-denied': return 'Firebase denied publishing. Confirm the Host role, saved payment details, and deployed Firestore Rules.';
    case 'failed-precondition': return 'Finalize room scores and save payment details before publishing. A room can be published only once.';
    case 'already-exists': return 'This request ID was already used for a different bill.';
    case 'unavailable': return 'Could not confirm the transaction. Reconnect and retry the same request; it is not queued offline.';
  }
}

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
  const profileProjectionSync = useRef<{ uid: string; uri?: string; premiumExpiresAtUtcMs?: number | null; initialized: boolean }>(
    { uid: profile.uid, uri: profile.avatarUri ?? undefined, premiumExpiresAtUtcMs: profile.premiumExpiresAtUtcMs, initialized: false },
  );
  useEffect(() => profileRepository.listen(profile.uid, (canonical, fromCache) => {
    if (!fromCache) {
      acceptCanonicalProfile(canonical);
      const avatarUri = canonical.avatarUri ?? undefined;
      const premiumExpiresAtUtcMs = canonical.premiumExpiresAtUtcMs;
      const previous = profileProjectionSync.current;
      if (previous.uid !== profile.uid || !previous.initialized || previous.uri !== avatarUri
        || previous.premiumExpiresAtUtcMs !== premiumExpiresAtUtcMs) {
        profileProjectionSync.current = { uid: profile.uid, uri: avatarUri, premiumExpiresAtUtcMs, initialized: true };
        void profileRepository.syncProfileToRooms(profile.uid, avatarUri, premiumExpiresAtUtcMs);
      }
    }
  }, () => undefined), [profileRepository, profile.uid, acceptCanonicalProfile]);
  useEffect(() => {
    if (!profile.premiumExpiresAtUtcMs) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = profile.premiumExpiresAtUtcMs! - Date.now();
      if (remaining <= 0) {
        if (profile.isPremium) acceptCanonicalProfile({ ...profile, isPremium: false });
      } else timer = setTimeout(check, Math.min(remaining, 86400000));
    };
    check();
    return () => clearTimeout(timer);
  }, [profile, acceptCanonicalProfile]);
  const handleProfileUpdated = useCallback((canonical: RegistrationProfile) => {
    acceptCanonicalProfile(canonical);
  }, [acceptCanonicalProfile]);
  const groupHistoryRepository = useMemo(() => createGroupHistoryRepository({
    firestore: roomRuntime.firestore, auth: roomRuntime.auth,
  }), [roomRuntime]);
  useEffect(() => {
    let disposed = false;
    void groupHistoryRepository.recoverLocal(profile.uid).catch(() => undefined);
    const retry = async () => {
      try {
        const network = await Network.getNetworkStateAsync();
        if (!disposed && network.isConnected && network.isInternetReachable !== false) {
          await groupHistoryRepository.syncPending(profile.uid);
        }
      } catch { /* Outbox còn bền vững; lần foreground/reconnect sau sẽ thử lại. */ }
    };
    void retry();
    // Worker độc lập selected room/screen; rời history không làm mất trigger retry.
    const network = Network.addNetworkStateListener(() => { void retry(); });
    const lifecycle = AppState.addEventListener('change', state => { if (state === 'active') void retry(); });
    const timer = setInterval(() => { void retry(); }, 30_000);
    return () => { disposed = true; network.remove(); lifecycle.remove(); clearInterval(timer); };
  }, [groupHistoryRepository, profile.uid]);
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
  const earlyExitCutoffCleanupTasks = useRef(new Map<string, Promise<void>>());
  const groupLifecycleCutoffs = useRef(new Map<string, number>());
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomCreateError, setRoomCreateError] = useState<string | undefined>();
  const pendingRoomCommand = useRef<RoomCreateCommand | null>(null);
  const roomCreateAttempt = useRef(0);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState<JoinedRoom | null>(null);
  const [roomJoinError, setRoomJoinError] = useState<string | undefined>();
  const pendingRoomJoinCommand = useRef<{ requestId: string; pin: string } | null>(null);
  const [roomLobbyState, setRoomLobbyState] = useState<RoomLobbyState | null>(null);
  const [recentGroupSessions, setRecentGroupSessions] = useState<GroupHistoryEntry[]>([]);
  const [recentGroupMemberPreviews, setRecentGroupMemberPreviews] = useState<Record<string, GroupRoomRosterPreview | null>>({});
  const [recentSessionsState, setRecentSessionsState] = useState<RecentSessionsState>('loading');
  const recentSessionsRequest = useRef(0);
  const [actionableGroupSessions, setActionableGroupSessions] = useState<GroupActionableSession[]>([]);
  const [actionableSessionsState, setActionableSessionsState] = useState<ActionableSessionsState>('loading');
  const [actionableCursor, setActionableCursor] = useState<GroupActionableCursor | null>(null);
  const [actionableHasMore, setActionableHasMore] = useState(false);
  const [isLoadingMoreActionable, setIsLoadingMoreActionable] = useState(false);
  const [actionableErrorMessage, setActionableErrorMessage] = useState<string>();
  const actionableRequest = useRef(0);
  const pendingGroupActionDestination = useRef<{ roomId: string; action: GroupActionableSession['action'] } | null>(null);
  const [isStartingRoom, setIsStartingRoom] = useState(false);
  const [roomStartError, setRoomStartError] = useState<string | undefined>();
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  const [roomLeaveError, setRoomLeaveError] = useState<string>();
  const leavingLobby = useRef(false);
  const kickingLobby = useRef(false);
  const [removingMemberUid, setRemovingMemberUid] = useState<string>();
  const [roomRemoveError, setRoomRemoveError] = useState<string>();
  const pendingRoomStartCommand = useRef<RoomStartCommand | null>(null);
  const [openEarlyExitRequests, setOpenEarlyExitRequests] = useState<EarlyExitRequest[]>([]);
  const [isRequestingEarlyExit, setIsRequestingEarlyExit] = useState(false);
  const [decidingEarlyExit, setDecidingEarlyExit] = useState<{ requestId: string; decision: EarlyExitDecision } | null>(null);
  const [earlyExitError, setEarlyExitError] = useState<string>();
  const [terminationVoteState, setTerminationVoteState] = useState<TerminationVoteState>({ vote: null, ownBallot: null, error: false });
  const [isOpeningTerminationVote, setIsOpeningTerminationVote] = useState(false);
  const [isCastingTerminationVote, setIsCastingTerminationVote] = useState(false);
  const [terminationVoteError, setTerminationVoteError] = useState<string>();
  const [isCompletingRoom, setIsCompletingRoom] = useState(false);
  const [roomCompletionError, setRoomCompletionError] = useState<string>();
  const [isFinalizingRoomOverride, setIsFinalizingRoomOverride] = useState(false);
  const [roomOverrideError, setRoomOverrideError] = useState<string>();
  const [isAcknowledgingRoom, setIsAcknowledgingRoom] = useState(false);
  const [roomAcknowledgmentError, setRoomAcknowledgmentError] = useState<string>();
  const pendingTerminationVoteOpen = useRef<{ roomId: string; requestId: string } | null>(null);
  const pendingTerminationBallot = useRef<{ roomId: string; voteId: string; requestId: string; choice: TerminationChoice } | null>(null);
  const pendingEarlyExitRequest = useRef<{ roomId: string; requestId: string } | null>(null);
  const pendingRoomCompletion = useRef<{ roomId: string; requestId: string } | null>(null);
  const pendingRoomOverride = useRef<{ roomId: string; requestId: string } | null>(null);
  const pendingRoomAcknowledgment = useRef<{ roomId: string; requestId: string } | null>(null);
  const earlyExitCleanupInFlight = useRef(new Set<string>());
  const groupCaptureWork = useRef(new Map<string, ReturnType<typeof createGroupCaptureWorkTracker>>());
  const lobbyRoom = joinedRoom ?? createdRoom;

  const loadRecentGroupSessions = useCallback(async () => {
    const requestId = ++recentSessionsRequest.current;
    const isCurrent = () => recentSessionsRequest.current === requestId;
    const options = { cursor: null, localPremium: profile.isPremium, serverPremium: profile.isPremium, nowUtcMs: Date.now() } as const;
    setRecentSessionsState('loading');
    try {
      const localPage = await groupHistoryRepository.readPage(profile.uid, { ...options, online: false });
      if (!isCurrent()) return;
      setRecentGroupSessions(localPage.items);
      const localPreviews = await Promise.all(localPage.items.slice(0, 5).map(async entry => [
        entry.summary.roomId,
        await groupHistoryRepository.readRoomRosterPreview(profile.uid, entry.summary.roomId, false),
      ] as const));
      if (!isCurrent()) return;
      setRecentGroupMemberPreviews(previous => ({ ...Object.fromEntries(localPreviews), ...previous }));
      const network = await Network.getNetworkStateAsync();
      if (!isCurrent()) return;
      const online = network.isConnected === true && network.isInternetReachable !== false;
      if (!online) {
        setRecentSessionsState('offline');
        return;
      }
      const page = await groupHistoryRepository.readPage(profile.uid, { ...options, online: true });
      if (!isCurrent()) return;
      setRecentGroupSessions(page.items);
      const remotePreviews = await Promise.all(page.items.slice(0, 5).map(async entry => [
        entry.summary.roomId,
        await groupHistoryRepository.readRoomRosterPreview(profile.uid, entry.summary.roomId, true),
      ] as const));
      if (!isCurrent()) return;
      setRecentGroupMemberPreviews(previous => ({
        ...previous,
        ...Object.fromEntries(remotePreviews.map(([roomId, preview]) => [
          roomId,
          preview ?? previous[roomId] ?? null,
        ])),
      }));
      setRecentSessionsState(page.cloudError ? 'cloud-error' : 'ready');
    } catch {
      if (isCurrent()) setRecentSessionsState('error');
    }
  }, [groupHistoryRepository, profile.isPremium, profile.uid]);

  const loadActionableGroupSessions = useCallback(async () => {
    const requestId = ++actionableRequest.current;
    const isCurrent = () => actionableRequest.current === requestId;
    setActionableErrorMessage(undefined);
    setActionableSessionsState('loading');
    try {
      const savedPage = await groupHistoryRepository.readActionablePage(profile.uid, { online: false, cursor: null });
      if (!isCurrent()) return;
      setActionableGroupSessions(savedPage.items);
      setActionableCursor(savedPage.cursor);
      setActionableHasMore(savedPage.hasMore);
      const network = await Network.getNetworkStateAsync();
      if (!isCurrent()) return;
      if (network.isConnected !== true || network.isInternetReachable === false) {
        setActionableSessionsState('offline');
        return;
      }
      const page = await groupHistoryRepository.readActionablePage(profile.uid, { online: true, cursor: null });
      if (!isCurrent()) return;
      setActionableGroupSessions(page.items);
      setActionableCursor(page.cursor);
      setActionableHasMore(page.hasMore);
      setActionableSessionsState(page.cloudError ? 'cloud-error' : 'ready');
    } catch {
      if (isCurrent()) setActionableSessionsState('error');
    }
  }, [groupHistoryRepository, profile.uid]);

  const loadMoreActionableGroupSessions = useCallback(async () => {
    if (!actionableHasMore || isLoadingMoreActionable || actionableCursor === null) return;
    const requestId = ++actionableRequest.current;
    const isCurrent = () => actionableRequest.current === requestId;
    setIsLoadingMoreActionable(true);
    setActionableErrorMessage(undefined);
    try {
      const network = await Network.getNetworkStateAsync();
      if (!isCurrent()) return;
      if (network.isConnected !== true || network.isInternetReachable === false) {
        setActionableSessionsState('offline');
        return;
      }
      const page = await groupHistoryRepository.readActionablePage(profile.uid, { online: true, cursor: actionableCursor });
      if (!isCurrent()) return;
      setActionableGroupSessions(page.items);
      setActionableCursor(page.cursor);
      setActionableHasMore(page.hasMore);
      setActionableSessionsState(page.cloudError ? 'cloud-error' : 'ready');
    } catch { if (isCurrent()) setActionableSessionsState('cloud-error'); }
    finally { if (isCurrent()) setIsLoadingMoreActionable(false); }
  }, [actionableCursor, actionableHasMore, groupHistoryRepository, isLoadingMoreActionable, profile.uid]);

  const openActionableGroupSession = useCallback(async (selected: GroupActionableSession) => {
    setActionableErrorMessage(undefined);
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
      setActionableErrorMessage(message);
      void loadActionableGroupSessions();
    }
  }, [groupHistoryRepository, loadActionableGroupSessions, profile.uid, roomRepository]);

  useEffect(() => {
    if (currentScreen !== '05-group-lobby' || lobbyRoom) return undefined;
    let active = true;
    void (async () => {
      // Keep the history and actionable queue SQLite passes serialized; both repositories cache server reads locally.
      await loadRecentGroupSessions();
      if (active) await loadActionableGroupSessions();
    })();
    return () => { active = false; recentSessionsRequest.current++; actionableRequest.current++; };
  }, [currentScreen, lobbyRoom?.roomId, loadActionableGroupSessions, loadRecentGroupSessions]);

  useEffect(() => {
    actionableRequest.current++;
    setActionableGroupSessions([]);
    setActionableCursor(null);
    setActionableHasMore(false);
    setActionableSessionsState('loading');
    setActionableErrorMessage(undefined);
  }, [profile.uid]);


  const reconcileGroupLifecycleAtCutoff = useCallback(async (roomId: string, userId: string, cutoffUtcMs: number) => {
    const result = await backgroundRecovery.reconcileAtCutoff({ sessionId: roomId, userId }, cutoffUtcMs);
    if (result === 'needs-review') {
      Alert.alert(
        'Session recovery needs review',
        'Background time could not be verified. No group violation was added for that interval.',
      );
    }
    return result;
  }, []);

  const runEarlyExitCutoffCleanup = useCallback((input: {
    roomId: string;
    userId: string;
    cutoffUtcMs: number;
    startedAtUtcMs: number;
    historySnapshot?: RoomLobbySnapshot;
  }) => {
    // Abort có thể backdate trước earlyExitAt; mọi caller dùng cùng mốc sớm nhất.
    const terminalEnd = input.historySnapshot?.endedAtUtcMs;
    input = { ...input, cutoffUtcMs: terminalEnd == null ? input.cutoffUtcMs : Math.min(input.cutoffUtcMs, terminalEnd) };
    const existingTask = earlyExitCutoffCleanupTasks.current.get(input.roomId);
    if (existingTask) return existingTask;

    const task = (async () => {
      // Chờ capture/recovery đã xếp hàng ghi xong trước khi chốt cutoff.
      await groupCaptureWork.current.get(input.roomId)?.waitForIdle();
      // Đưa candidate nền vào violation/outbox trước khi đóng session cục bộ.
      await reconcileGroupLifecycleAtCutoff(input.roomId, input.userId, input.cutoffUtcMs);
      await groupViolationRepository.finalizeOpenAtRoomEnd({
        roomId: input.roomId, userId: input.userId, endedAtUtcMs: input.cutoffUtcMs,
      });
      await persistEarlyExitProjection(getLocalDatabase(), input);
      groupCaptureWork.current.delete(input.roomId);
    })();
    earlyExitCutoffCleanupTasks.current.set(input.roomId, task);
    const clearTask = () => {
      if (earlyExitCutoffCleanupTasks.current.get(input.roomId) === task) {
        earlyExitCutoffCleanupTasks.current.delete(input.roomId);
      }
    };
    void task.then(clearTask, clearTask);
    return task;
  }, [groupViolationRepository, reconcileGroupLifecycleAtCutoff]);

  useEffect(() => {
    let active = true;
    void restoreCachedActiveRoom(getLocalDatabase(), profile.uid).then(room => {
      if (!active || !room) return;
      setCreatedRoom(current => {
        if (current) return current;
        restoredGroupRoomId.current = room.roomId;
        return room;
      });
    }).catch(() => {
      // Local restore không chặn đăng nhập; listener cloud vẫn có thể được gắn khi người dùng mở lại room.
    });
    return () => { active = false; };
  }, [profile.uid]);

  useEffect(() => {
    let active = true;
    const retry = createCompletedGroupViolationSyncRetry(groupViolationRepository);
    const updateConnectivity = (state: Network.NetworkState) => {
      retry.setOnline(state.isConnected === true && state.isInternetReachable !== false);
    };
    const networkSubscription = Network.addNetworkStateListener(updateConnectivity);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        retry.setOnline(false);
        return;
      }
      void Network.getNetworkStateAsync().then(state => {
        if (active) updateConnectivity(state);
      }).catch(() => retry.setOnline(false));
    });
    void Network.getNetworkStateAsync().then(state => {
      if (active) updateConnectivity(state);
    }).catch(() => retry.setOnline(false));
    return () => {
      active = false;
      networkSubscription.remove();
      appStateSubscription.remove();
      retry.dispose();
    };
  }, [groupViolationRepository]);

  useEffect(() => {
    if (!lobbyRoom) {
      setRoomLobbyState(null);
      setOpenEarlyExitRequests([]);
      return undefined;
    }
    // Giữ listener sống khi đổi tab để Group Active vẫn nhận trạng thái phòng và tiếp tục capture.
    return listenToRoomLobby(roomRuntime.firestore, lobbyRoom.roomId, state => {
      const snapshot = state.snapshot;
      if ((snapshot?.status === 'COMPLETED' || snapshot?.status === 'ABORTED') && snapshot.endedAtUtcMs != null) {
        const ownMember = snapshot.members.find(member => member.uid === profile.uid);
        const cutoffUtcMs = ownMember?.status === 'EARLY_EXIT' && ownMember.earlyExitAtUtcMs != null
          ? Math.min(snapshot.endedAtUtcMs, ownMember.earlyExitAtUtcMs)
          : snapshot.endedAtUtcMs;
        groupLifecycleCutoffs.current.set(lobbyRoom.roomId, cutoffUtcMs);
      } else if (snapshot?.status === 'ACTIVE') {
        const ownMember = snapshot.members.find(member => member.uid === profile.uid);
        if (ownMember?.status === 'EARLY_EXIT' && ownMember.earlyExitAtUtcMs != null) {
          groupLifecycleCutoffs.current.set(lobbyRoom.roomId, ownMember.earlyExitAtUtcMs);
        }
      }
      setRoomLobbyState(state);
      if (snapshot && state.kind === 'live') {
        setCreatedRoom(current => current?.roomId === snapshot.roomId && current.hostUid !== snapshot.hostUid
          ? { ...current, hostUid: snapshot.hostUid } : current);
        setJoinedRoom(current => current?.roomId === snapshot.roomId && current.hostUid !== snapshot.hostUid
          ? { ...current, hostUid: snapshot.hostUid } : current);
      }
    },
      snapshot => persistRoomLobbyProjection(getLocalDatabase(), snapshot, profile.uid));
  }, [lobbyRoom?.roomId, roomRuntime.firestore, profile.uid]);

  useEffect(() => {
    const snapshot = roomLobbyState?.snapshot;
    const ownMember = snapshot?.members.find(member => member.uid === profile.uid);
    if (!lobbyRoom || roomLobbyState?.kind !== 'live' || snapshot?.status !== 'ACTIVE'
      || ownMember?.role !== 'HOST' || ownMember.status !== 'ACTIVE') return undefined;

    let active = true;
    let heartbeatInFlight = false;
    let resumeCheckInFlight = false;
    // Không gửi heartbeat nền; chỉ lần commit thành công mới làm mới liveness server.
    const sendHeartbeat = async () => {
      if (!active || heartbeatInFlight || AppState.currentState !== 'active') return;
      heartbeatInFlight = true;
      try {
        await roomLivenessRepository.sendHostHeartbeat(lobbyRoom.roomId);
      } catch (error) {
        if (__DEV__ && active) {
          const code = error instanceof RoomLivenessError ? error.code : 'unknown';
          console.warn('[room-liveness] heartbeat failed', { code });
        }
      } finally {
        heartbeatInFlight = false;
      }
    };
    const refreshOnResume = async () => {
      if (!active || resumeCheckInFlight || AppState.currentState !== 'active') return;
      resumeCheckInFlight = true;
      try {
        const result = await roomLivenessRepository.abortStaleRoom(lobbyRoom.roomId);
        // Khi Host quay lại sau thời gian stale, không hồi sinh phòng đã được abort.
        if (result === 'aborted' || result === 'terminal') return;
      } catch (error) {
        // Rules từ chối một lần thử sớm; heartbeat kế tiếp dùng server time làm mốc mới.
        if (!(error instanceof RoomLivenessError) || error.code !== 'rejected') {
          if (__DEV__ && active) {
            const code = error instanceof RoomLivenessError ? error.code : 'unknown';
            console.warn('[room-liveness] resume check failed', { code });
          }
          return;
        }
      } finally {
        resumeCheckInFlight = false;
      }
      await sendHeartbeat();
    };
    void refreshOnResume();
    const timer = setInterval(() => { void sendHeartbeat(); }, HOST_HEARTBEAT_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshOnResume();
    });
    const networkSubscription = Network.addNetworkStateListener(state => {
      if (state.isConnected === true && state.isInternetReachable !== false) void refreshOnResume();
    });
    return () => {
      active = false;
      clearInterval(timer);
      appStateSubscription.remove();
      networkSubscription.remove();
    };
  }, [lobbyRoom?.roomId, profile.uid, roomLivenessRepository, roomLobbyState?.kind, roomLobbyState?.snapshot?.status]);

  useEffect(() => {
    const snapshot = roomLobbyState?.snapshot;
    const ownMember = snapshot?.members.find(member => member.uid === profile.uid);
    if (!lobbyRoom || roomLobbyState?.kind !== 'live' || snapshot?.status !== 'ACTIVE'
      || snapshot.startedAtUtcMs == null || ownMember == null || ownMember.role === 'HOST'
      || !['ACTIVE', 'EARLY_EXIT'].includes(ownMember.status)) return undefined;
    const heartbeatAt = snapshot.hostHeartbeatAtUtcMs;
    if (heartbeatAt == null) return undefined;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortInFlight = false;
    const cutoffUtcMs = Math.max(heartbeatAt, snapshot.startedAtUtcMs) + HOST_STALE_AFTER_MS;
    let attemptAbort: () => Promise<void>;
    const retry = () => {
      if (!active) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(attemptAbort, STALE_ROOM_RETRY_MS);
    };
    attemptAbort = async () => {
      if (!active || abortInFlight || AppState.currentState !== 'active') return;
      abortInFlight = true;
      try {
        await roomLivenessRepository.abortStaleRoom(lobbyRoom.roomId);
      } catch (error) {
        if (__DEV__ && active && (!(error instanceof RoomLivenessError) || error.code !== 'rejected')) {
          const code = error instanceof RoomLivenessError ? error.code : 'unknown';
          console.warn('[room-liveness] stale check failed', { code });
        }
        retry();
      } finally {
        abortInFlight = false;
      }
    };
    const remainingMs = cutoffUtcMs - Date.now();
    timer = setTimeout(attemptAbort, Math.max(0, remainingMs) + 1);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void attemptAbort();
    });
    const networkSubscription = Network.addNetworkStateListener(state => {
      if (state.isConnected === true && state.isInternetReachable !== false) void attemptAbort();
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      appStateSubscription.remove();
      networkSubscription.remove();
    };
  }, [lobbyRoom?.roomId, profile.uid, roomLivenessRepository, roomLobbyState?.kind,
    roomLobbyState?.snapshot?.hostHeartbeatAtUtcMs, roomLobbyState?.snapshot?.startedAtUtcMs,
    roomLobbyState?.snapshot?.status]);

  useEffect(() => {
    if (!lobbyRoom) return undefined;
    return listenToOpenEarlyExitRequests(
      roomRuntime.firestore,
      lobbyRoom.roomId,
      requests => { setOpenEarlyExitRequests(requests); setEarlyExitError(undefined); },
      () => setEarlyExitError('Could not load early-exit requests. Reopen the room while connected to retry.'),
    );
  }, [lobbyRoom?.roomId, roomRuntime.firestore]);

  useEffect(() => {
    if (!lobbyRoom) {
      setTerminationVoteState({ vote: null, ownBallot: null, error: false });
      return undefined;
    }
    return listenToTerminationVote(roomRuntime.firestore, lobbyRoom.roomId, profile.uid, state => {
      setTerminationVoteState(state);
      if (!state.error) setTerminationVoteError(undefined);
    });
  }, [lobbyRoom?.roomId, roomRuntime.firestore, profile.uid]);

  useEffect(() => {
    const snapshot = roomLobbyState?.snapshot;
    const isTerminalRoom = snapshot?.status === 'COMPLETED' || snapshot?.status === 'ABORTED' || snapshot?.status === 'CANCELLED';
    if (roomLobbyState && snapshot && isTerminalRoom && snapshot.endedAtUtcMs !== null && snapshot.endedAtUtcMs !== undefined
      && !(snapshot.status === 'CANCELLED' && snapshot.startedAtUtcMs === null)
      && ['live', 'cached'].includes(roomLobbyState.kind)
      && !terminalRoomCleanupInFlight.current.has(snapshot.roomId)) {
      const roomId = snapshot.roomId;
      const endedAtUtcMs = snapshot.endedAtUtcMs;
      const shouldShowSummary = shouldNavigateToGroupSummary({
        roomId: snapshot.roomId, roomStatus: snapshot.status,
        restoredRoomId: restoredGroupRoomId.current,
        isRoomMember: snapshot.members.some(member => member.uid === profile.uid),
      });
      const ownMember = snapshot.members.find(member => member.uid === profile.uid);
      const earlyExitCutoffUtcMs = ownMember?.status === 'EARLY_EXIT' ? ownMember.earlyExitAtUtcMs : null;
      const startedAtUtcMs = snapshot.startedAtUtcMs;
      terminalRoomCleanupInFlight.current.add(roomId);
      // The live Firestore snapshot is sufficient for Summary. Local SQLite
      // projection is best-effort and must never hold navigation on Group Active.
      if (shouldShowSummary) setCurrentScreen('13-group-summary');
      void (async () => {
        try {
          // Không chốt local interval cho tới khi lần ghi capture cuối cùng đã hoàn tất.
          await groupCaptureWork.current.get(roomId)?.waitForIdle();
          if (snapshot.status === 'COMPLETED' || snapshot.status === 'ABORTED' || snapshot.status === 'CANCELLED') {
            // Reconcile candidate nền theo cutoff server trước khi terminal cleanup đóng session.
            const cutoffUtcMs = earlyExitCutoffUtcMs == null
              ? endedAtUtcMs : Math.min(endedAtUtcMs, earlyExitCutoffUtcMs);
            await reconcileGroupLifecycleAtCutoff(roomId, profile.uid, cutoffUtcMs);
          }
          if (earlyExitCutoffUtcMs != null && startedAtUtcMs != null) {
            // Nếu đây là snapshot đầu tiên sau khi Host duyệt, áp cutoff trước giờ kết thúc phòng.
            await runEarlyExitCutoffCleanup({
              roomId, userId: profile.uid, cutoffUtcMs: Math.min(earlyExitCutoffUtcMs, snapshot.endedAtUtcMs!), startedAtUtcMs, historySnapshot: snapshot,
            });
          }
          // Chốt violation đã xác nhận theo mốc kết thúc server, giữ outbox pending cho SL-020 reconciliation.
          await groupViolationRepository.finalizeOpenAtRoomEnd({ roomId, userId: profile.uid, endedAtUtcMs });
          if (snapshot.reconciliationStatus === 'FINALIZED' && snapshot.finalizationReason === 'HOST_OVERRIDE') {
            // Member quay lại sau override vẫn gửi event đủ điều kiện vào history, không mở lại điểm.
            await groupViolationRepository.syncPending(roomId).catch(() => undefined);
          }
          await persistTerminalRoomProjection(getLocalDatabase(), {
            roomId, userId: profile.uid, status: snapshot.status as 'COMPLETED' | 'ABORTED' | 'CANCELLED', endedAtUtcMs,
            reconciliationStatus: snapshot.reconciliationStatus,
            pendingMemberCount: snapshot.pendingMemberCount,
            finalizationReason: snapshot.finalizationReason,
            historySnapshot: snapshot,
          });
          if (restoredGroupRoomId.current === roomId) restoredGroupRoomId.current = null;
          if (snapshot.status !== 'COMPLETED') {
            setCreatedRoom(current => current?.roomId === roomId ? null : current);
            setJoinedRoom(current => current?.roomId === roomId ? null : current);
          }
          if (snapshot.status !== 'COMPLETED') {
            setCurrentScreen(current => current === '06-group-active' ? '05-group-lobby' : current);
          }
        } catch (error) {
          terminalRoomCleanupInFlight.current.delete(roomId);
          if (__DEV__) console.warn('[group-terminal] local projection cleanup failed', error);
        }
      })();
    }
    const ownMembershipCanView = snapshot?.members.some(member => member.uid === profile.uid
      && ['ACTIVE', 'EARLY_EXIT'].includes(member.status)) === true;
    const isRestoredRoom = snapshot?.roomId === restoredGroupRoomId.current && currentScreen === '02-solo-select';
    if (roomLobbyState && snapshot?.status === 'ACTIVE' && snapshot.startedAtUtcMs !== null && ownMembershipCanView
      && ['live', 'cached'].includes(roomLobbyState.kind)
      && (currentScreen === '05-group-lobby' || isRestoredRoom)) {
      setCurrentScreen('06-group-active');
      restoredGroupRoomId.current = null;
    }
  }, [roomLobbyState, currentScreen, profile.uid, groupViolationRepository,
    runEarlyExitCutoffCleanup, reconcileGroupLifecycleAtCutoff]);

  const earlyExitSnapshot = roomLobbyState?.snapshot;
  const earlyExitMember = earlyExitSnapshot?.members.find(member => member.uid === profile.uid);
  const earlyExitCutoffUtcMs = earlyExitMember?.earlyExitAtUtcMs;
  useEffect(() => {
    const snapshot = earlyExitSnapshot;
    const ownMember = earlyExitMember;
    const cutoffUtcMs = earlyExitCutoffUtcMs;
    if (!snapshot || !['ACTIVE', 'COMPLETED', 'CANCELLED', 'ABORTED'].includes(snapshot.status)
      || ownMember?.status !== 'EARLY_EXIT'
      || cutoffUtcMs == null || snapshot.startedAtUtcMs == null
      || earlyExitCleanupInFlight.current.has(snapshot.roomId)) return;

    const roomId = snapshot.roomId;
    const startedAtUtcMs = snapshot.startedAtUtcMs;
    earlyExitCleanupInFlight.current.add(roomId);
    let disposed = false;
    let localCleanupComplete = false;
    let online = false;
    let networkSubscription: ReturnType<typeof Network.addNetworkStateListener> | undefined;
    let cleanupRetryController: ReturnType<typeof createEarlyExitCleanupRetry> | undefined;
    let retryController: ReturnType<typeof createEarlyExitSyncRetry> | undefined;
    const updateConnection = (state: Awaited<ReturnType<typeof Network.getNetworkStateAsync>>) => {
      if (disposed) return;
      online = state.isConnected === true && state.isInternetReachable !== false;
      setGroupIsOnline(online);
      if (online) cleanupRetryController?.retryNow();
      retryController?.setOnline(online);
    };
    cleanupRetryController = createEarlyExitCleanupRetry(
      async () => {
        // Dùng cùng cleanup với terminal path để hai snapshot không chốt sai thứ tự.
        await runEarlyExitCutoffCleanup({ roomId, userId: profile.uid, cutoffUtcMs, startedAtUtcMs, historySnapshot: snapshot });
        if (disposed) return;
      },
      {
        onRetrying: () => setGroupSyncMessage('The room approved your exit, but local session cleanup failed. The app will retry automatically.'),
        onComplete: () => {
          localCleanupComplete = true;
          retryController = createEarlyExitSyncRetry(roomId, groupViolationRepository, {
            onPending: count => {
              setGroupSyncPendingCount(count);
              setGroupSyncMessage(`${count} eligible violation${count === 1 ? '' : 's'} waiting to sync. The app will retry while connected.`);
            },
            onDrained: failed => {
              setGroupSyncPendingCount(0);
              setGroupSyncMessage(failed > 0
                ? `${failed} violation${failed === 1 ? '' : 's'} could not sync and remain saved on this device.`
                : undefined);
            },
            onReconciliation: () => setGroupSyncMessage('A saved violation is waiting for room reconciliation.'),
            onRetrying: () => setGroupSyncMessage('Eligible violations are saved on this device. Sync will retry while connected.'),
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
      if (!localCleanupComplete) earlyExitCleanupInFlight.current.delete(roomId);
      cleanupRetryController?.dispose();
      retryController?.dispose();
      networkSubscription?.remove();
    };
  }, [earlyExitSnapshot?.roomId, earlyExitSnapshot?.status, earlyExitSnapshot?.startedAtUtcMs,
    earlyExitMember?.status, earlyExitCutoffUtcMs, profile.uid, groupViolationRepository, runEarlyExitCutoffCleanup]);

  const handleCreateRoom = async () => {
    if (isCreatingRoom) return;
    const attemptId = ++roomCreateAttempt.current;
    setIsCreatingRoom(true);
    setRoomCreateError(undefined);
    const command = pendingRoomCommand.current ?? roomRepository.createCommand();
    pendingRoomCommand.current = command;
    try {
      const result = await roomRepository.createRoom(profile.displayName, command);
      if (attemptId !== roomCreateAttempt.current) return;
      pendingRoomCommand.current = null;
      setJoinedRoom(null);
      restoredGroupRoomId.current = null;
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
  };

  const cancelRoomCreateAndJoin = () => {
    // Client không thể hủy transaction Firestore đã gửi; bỏ kết quả muộn và giữ requestId để retry lấy lại cùng phòng nếu đã commit.
    roomCreateAttempt.current += 1;
    setIsCreatingRoom(false);
    setRoomCreateError(undefined);
    setJoinedRoom(null);
    setRoomJoinError(undefined);
    pendingRoomJoinCommand.current = null;
    setCurrentScreen('12-join-room');
  };

  useEffect(() => {
    if (!lobbyRoom) return undefined;
    const roomId = lobbyRoom.roomId;
    return listenToOwnRoomRemoval(roomRuntime.firestore, roomId, profile.uid, () => {
      if (leavingLobby.current) return;
      setCreatedRoom(current => current?.roomId === roomId ? null : current);
      setJoinedRoom(current => current?.roomId === roomId ? null : current);
      setRoomLobbyState(current => current?.snapshot?.roomId === roomId ? null : current);
      pendingRoomJoinCommand.current = null;
      pendingRoomStartCommand.current = null;
      pendingRoomCommand.current = null;
      setRoomRemoveError(undefined);
      setCurrentScreen(current => ['05-group-lobby', '12-join-room', '06-group-active'].includes(current) ? '05-group-lobby' : current);
      void getLocalDatabase().then(db => db.runAsync('DELETE FROM room_members WHERE room_id = ? AND uid = ?', roomId, profile.uid))
        .catch(error => { if (__DEV__) console.warn('[room-removal] local cleanup pending', error); });
      Alert.alert('No longer in room', 'You are no longer a member of this room.');
    });
  }, [lobbyRoom?.roomId, roomRuntime.firestore, profile.uid]);

  const handleStartRoom = async () => {
    if (!lobbyRoom || isStartingRoom || leavingLobby.current || kickingLobby.current) return;
    setIsStartingRoom(true);
    setRoomStartError(undefined);
    const command = pendingRoomStartCommand.current?.roomId === lobbyRoom.roomId
      ? pendingRoomStartCommand.current
      : roomRepository.startCommand(lobbyRoom.roomId);
    pendingRoomStartCommand.current = command;
    try {
      await roomRepository.startRoom(command);
      pendingRoomStartCommand.current = null;
    } catch (error) {
      if (!(error instanceof RoomStartError) || error.code !== 'unavailable') pendingRoomStartCommand.current = null;
      if (__DEV__ && error instanceof RoomStartError) {
        console.warn('[room-start] failed', JSON.stringify({ code: error.code, firebaseCode: error.firebaseCode }));
      }
      setRoomStartError(roomStartErrorMessage(error));
    } finally {
      setIsStartingRoom(false);
    }
  };

  const confirmLeaveLobby = () => {
    if (!lobbyRoom || isStartingRoom || leavingLobby.current || kickingLobby.current || roomLobbyState?.kind !== 'live'
      || roomLobbyState.snapshot.status !== 'WAITING') return;
    const roomId = lobbyRoom.roomId;
    const snapshot = roomLobbyState.snapshot;
    const description = snapshot.hostUid === profile.uid
      ? snapshot.participantCount > 1
        ? 'Host duties will pass to the earliest remaining member. The room will stay open.'
        : 'You are the last member. This will close the room.'
      : 'You will leave this lobby. You can join again with the room PIN while it is waiting.';
    Alert.alert('Leave room?', description, [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave Room', style: 'destructive', onPress: () => {
        if (leavingLobby.current || kickingLobby.current) return;
        leavingLobby.current = true;
        setIsLeavingRoom(true);
        setRoomLeaveError(undefined);
        void lobbyLeaveRepository.leave(roomId).then(() => {
          setCreatedRoom(current => current?.roomId === roomId ? null : current);
          setJoinedRoom(current => current?.roomId === roomId ? null : current);
          setRoomLobbyState(null);
          setRoomRemoveError(undefined);
          pendingRoomCommand.current = null;
          pendingRoomJoinCommand.current = null;
          pendingRoomStartCommand.current = null;
          setCurrentScreen('05-group-lobby');
        }).catch(error => {
          const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
          setRoomLeaveError(code.includes('permission-denied')
            ? 'Leave was not allowed. The room may have changed, or the room rules need updating.'
            : code ? 'Could not leave the room. Reconnect and try again.'
              : error instanceof Error ? error.message : 'Could not leave the room. Please retry.');
        }).finally(() => { leavingLobby.current = false; setIsLeavingRoom(false); });
      } },
    ]);
  };

  const confirmRemoveLobbyMember = (memberUid: string, displayName: string) => {
    if (!lobbyRoom || memberUid === profile.uid || isStartingRoom || leavingLobby.current || kickingLobby.current
      || roomLobbyState?.kind !== 'live' || roomLobbyState.snapshot.status !== 'WAITING'
      || roomLobbyState.snapshot.hostUid !== profile.uid) return;
    const roomId = lobbyRoom.roomId;
    Alert.alert('Remove member?', `Remove ${displayName} from this lobby? They can join again with the PIN.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove Member', style: 'destructive', onPress: () => {
        if (kickingLobby.current || leavingLobby.current) return;
        kickingLobby.current = true;
        setRemovingMemberUid(memberUid);
        setRoomRemoveError(undefined);
        void lobbyLeaveRepository.removeMember(roomId, memberUid).catch(error => {
          const isSdkError = typeof error === 'object' && error !== null && 'code' in error;
          setRoomRemoveError(isSdkError ? 'Could not remove this member. Check your connection and host permissions, then retry.'
            : error instanceof Error ? error.message : 'Could not remove this member. Please retry.');
        }).finally(() => { kickingLobby.current = false; setRemovingMemberUid(undefined); });
      } },
    ]);
  };

  const handleCompleteRoom = async () => {
    if (!lobbyRoom || isCompletingRoom) return;
    setIsCompletingRoom(true);
    setRoomCompletionError(undefined);
    const pending = pendingRoomCompletion.current?.roomId === lobbyRoom.roomId
      ? pendingRoomCompletion.current
      : { roomId: lobbyRoom.roomId, requestId: Crypto.randomUUID() };
    pendingRoomCompletion.current = pending;
    try {
      await roomCompletionRepository.completeRoom(pending);
      pendingRoomCompletion.current = null;
      setCurrentScreen('13-group-summary');
    } catch (error) {
      if (!(error instanceof RoomCompletionError) || error.code !== 'unavailable') pendingRoomCompletion.current = null;
      if (__DEV__ && error instanceof RoomCompletionError) {
        console.warn('[room-complete] failed', JSON.stringify({ code: error.code }));
      }
      setRoomCompletionError(error instanceof RoomCompletionError && error.code === 'permission-denied'
        ? 'Firebase rejected room completion. Check the deployed Firestore Rules and Host membership.'
        : error instanceof RoomCompletionError && error.code === 'failed-precondition'
          ? 'This room is no longer active. Refresh the room state and try again.'
          : 'Could not end the room. Reconnect and retry; the request was not queued offline.');
    } finally {
      setIsCompletingRoom(false);
    }
  };

  const handleFinalizeRoomOverride = async (unsyncedMemberUids: string[]) => {
    const snapshot = roomLobbyState?.snapshot;
    const ownMember = snapshot?.members.find(member => member.uid === profile.uid);
    if (!lobbyRoom || !snapshot || snapshot.status !== 'COMPLETED' || ownMember?.role !== 'HOST'
      || isFinalizingRoomOverride) return;
    setIsFinalizingRoomOverride(true);
    setRoomOverrideError(undefined);
    const pending = pendingRoomOverride.current?.roomId === lobbyRoom.roomId
      ? pendingRoomOverride.current
      : { roomId: lobbyRoom.roomId, requestId: Crypto.randomUUID() };
    pendingRoomOverride.current = pending;
    try {
      await roomCompletionRepository.finalizeRoomScores({
        ...pending,
        reason: 'HOST_OVERRIDE',
        confirmedWarning: true,
        unsyncedMemberUids,
      });
      pendingRoomOverride.current = null;
      // Ghi history-only cho violation local còn pending sau khi server đã khóa điểm.
      void groupViolationRepository.syncPending(lobbyRoom.roomId).catch(() => undefined);
    } catch (error) {
      if (!(error instanceof RoomCompletionError) || error.code !== 'unavailable') pendingRoomOverride.current = null;
      if (__DEV__ && error instanceof RoomCompletionError) {
        console.warn('[room-override] failed', JSON.stringify({ code: error.code }));
      }
      setRoomOverrideError(error instanceof RoomCompletionError && error.code === 'permission-denied'
        ? 'Firebase rejected finalization. Check that the Spark Firestore Rules are deployed.'
        : error instanceof RoomCompletionError && error.code === 'failed-precondition'
          ? 'The room state changed. Wait for the latest room snapshot and retry if members are still pending.'
          : error instanceof RoomCompletionError && error.code === 'unavailable'
            ? 'Could not confirm the request with Firebase. Reconnect and retry; the same request will be reused.'
            : 'Could not finalize the room. Your scores have not been changed by this attempt.');
    } finally {
      setIsFinalizingRoomOverride(false);
    }
  };

  const handleAcknowledgeRoomSync = async () => {
    const snapshot = roomLobbyState?.snapshot;
    if (!lobbyRoom || !snapshot || snapshot.status !== 'COMPLETED' || isAcknowledgingRoom) return;
    setIsAcknowledgingRoom(true);
    setRoomAcknowledgmentError(undefined);
    const pending = pendingRoomAcknowledgment.current?.roomId === lobbyRoom.roomId
      ? pendingRoomAcknowledgment.current
      : { roomId: lobbyRoom.roomId, requestId: Crypto.randomUUID() };
    pendingRoomAcknowledgment.current = pending;
    try {
      // Chờ sensor/recovery đã ghi xong, sau đó chốt interval mở tại endedAt và gửi hết outbox đủ điều kiện.
      await groupCaptureWork.current.get(lobbyRoom.roomId)?.waitForIdle();
      if (snapshot.endedAtUtcMs == null) throw new RoomCompletionError('failed-precondition');
      const ownMember = snapshot.members.find(member => member.uid === profile.uid);
      const lifecycleCutoffUtcMs = ownMember?.status === 'EARLY_EXIT' && ownMember.earlyExitAtUtcMs != null
        ? Math.min(snapshot.endedAtUtcMs, ownMember.earlyExitAtUtcMs)
        : snapshot.endedAtUtcMs;
      await reconcileGroupLifecycleAtCutoff(lobbyRoom.roomId, profile.uid, lifecycleCutoffUtcMs);
      if (snapshot.startedAtUtcMs != null) {
        if (ownMember?.status === 'EARLY_EXIT' && ownMember.earlyExitAtUtcMs != null) {
          await runEarlyExitCutoffCleanup({
            roomId: lobbyRoom.roomId, userId: profile.uid,
            cutoffUtcMs: ownMember.earlyExitAtUtcMs, startedAtUtcMs: snapshot.startedAtUtcMs, historySnapshot: snapshot,
          });
        }
      }
      await groupViolationRepository.finalizeOpenAtRoomEnd({
        roomId: lobbyRoom.roomId, userId: profile.uid, endedAtUtcMs: snapshot.endedAtUtcMs,
      });
      await groupViolationRepository.syncPending(lobbyRoom.roomId);
      const pendingCount = await groupViolationRepository.getPendingCount(lobbyRoom.roomId);
      if (pendingCount > 0) throw new RoomCompletionError('failed-precondition');
      await roomCompletionRepository.acknowledgeMemberSync(pending);
      pendingRoomAcknowledgment.current = null;
    } catch (error) {
      if (!(error instanceof RoomCompletionError) || error.code !== 'unavailable') pendingRoomAcknowledgment.current = null;
      if (__DEV__ && error instanceof RoomCompletionError) {
        console.warn('[room-ack] failed', JSON.stringify({ code: error.code }));
      }
      setRoomAcknowledgmentError(error instanceof RoomCompletionError && error.code === 'failed-precondition'
        ? 'Some saved session data is still waiting to sync. Reconnect and retry.'
        : error instanceof RoomCompletionError && error.code === 'permission-denied'
          ? 'Firebase rejected the sync acknowledgment. Check the deployed Firestore Rules.'
          : 'Could not confirm the final sync. Reconnect and retry.');
    } finally {
      setIsAcknowledgingRoom(false);
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
      setCreatedRoom(null);
      restoredGroupRoomId.current = null;
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

  const handleRequestEarlyExit = async () => {
    if (!lobbyRoom || isRequestingEarlyExit) return;
    setIsRequestingEarlyExit(true);
    setEarlyExitError(undefined);
    const pending = pendingEarlyExitRequest.current?.roomId === lobbyRoom.roomId
      ? pendingEarlyExitRequest.current
      : { roomId: lobbyRoom.roomId, requestId: Crypto.randomUUID() };
    pendingEarlyExitRequest.current = pending;
    try {
      await earlyExitRepository.requestEarlyExit({ roomId: lobbyRoom.roomId, requestId: pending.requestId });
      pendingEarlyExitRequest.current = null;
    } catch (error) {
      if (!(error instanceof EarlyExitError) || error.code !== 'unavailable') pendingEarlyExitRequest.current = null;
      setEarlyExitError(earlyExitErrorMessage(error));
    } finally {
      setIsRequestingEarlyExit(false);
    }
  };

  const handleDecideEarlyExit = async (request: EarlyExitRequest, decision: EarlyExitDecision) => {
    if (!lobbyRoom || decidingEarlyExit) return;
    setDecidingEarlyExit({ requestId: request.requestId, decision });
    setEarlyExitError(undefined);
    try {
      await earlyExitRepository.decideEarlyExit({
        roomId: lobbyRoom.roomId, memberUid: request.memberUid, requestId: request.requestId, decision,
      });
    } catch (error) {
      setEarlyExitError(earlyExitErrorMessage(error));
    } finally {
      setDecidingEarlyExit(null);
    }
  };

  const handleOpenTerminationVote = async () => {
    if (!lobbyRoom || isOpeningTerminationVote) return;
    setIsOpeningTerminationVote(true);
    setTerminationVoteError(undefined);
    const pending = pendingTerminationVoteOpen.current?.roomId === lobbyRoom.roomId
      ? pendingTerminationVoteOpen.current : { roomId: lobbyRoom.roomId, requestId: Crypto.randomUUID() };
    pendingTerminationVoteOpen.current = pending;
    try {
      await terminationVoteRepository.open(pending);
      pendingTerminationVoteOpen.current = null;
    } catch (error) {
      if (!(error instanceof TerminationVoteError) || error.code !== 'unavailable') pendingTerminationVoteOpen.current = null;
      setTerminationVoteError(error instanceof TerminationVoteError && error.code === 'permission-denied'
        ? 'Could not start a new vote. The current vote may still be open; wait and try again.'
        : 'Could not start the vote. Reconnect and try again.');
    } finally { setIsOpeningTerminationVote(false); }
  };

  const handleCastTerminationVote = async (choice: TerminationChoice) => {
    if (!lobbyRoom || !terminationVoteState.vote || isCastingTerminationVote) return;
    setIsCastingTerminationVote(true);
    setTerminationVoteError(undefined);
    const currentVote = terminationVoteState.vote;
    const pending = pendingTerminationBallot.current?.roomId === lobbyRoom.roomId
      && pendingTerminationBallot.current.voteId === currentVote.voteId
      && pendingTerminationBallot.current.choice === choice
      ? pendingTerminationBallot.current
      : { roomId: lobbyRoom.roomId, voteId: currentVote.voteId, requestId: Crypto.randomUUID(), choice };
    pendingTerminationBallot.current = pending;
    try {
      await terminationVoteRepository.cast(pending);
      pendingTerminationBallot.current = null;
    } catch (error) {
      if (!(error instanceof TerminationVoteError) || error.code !== 'unavailable') pendingTerminationBallot.current = null;
      setTerminationVoteError(error instanceof TerminationVoteError && error.code === 'permission-denied'
        ? 'Your vote was not accepted. The voting window may have ended; check the room and try again.'
        : 'Could not submit your vote. Reconnect and try again.');
    } finally { setIsCastingTerminationVote(false); }
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
  const [groupTimerSeconds, setGroupTimerSeconds] = useState(0);
  const [groupDetection, setGroupDetection] = useState<ForegroundDetectionViewState>(INITIAL_DETECTION_STATE);
  const [groupIsOnline, setGroupIsOnline] = useState(false);
  const [groupSyncMessage, setGroupSyncMessage] = useState<string>();
  const [groupSyncPendingCount, setGroupSyncPendingCount] = useState(0);
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
  const [committedBill, setCommittedBill] = useState<PublishedBill | null>(null);
  const [isPublishingBill, setIsPublishingBill] = useState(false);
  const [billPublishError, setBillPublishError] = useState<string>();
  const paymentStatusRepository = useMemo(() => createPaymentStatusRepository({
    firestore: roomRuntime.firestore, auth: roomRuntime.auth,
  }), [roomRuntime.firestore, roomRuntime.auth]);
  const [isMarkingPayment, setIsMarkingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string>();
  const pendingPayment = useRef<MarkPaymentCommand | null>(null);
  const [isApplyingBillOverride, setIsApplyingBillOverride] = useState(false);
  const [billOverrideError, setBillOverrideError] = useState<string>();
  const pendingBillCommand = useRef<{ command: CalculateBillCommand; rosterMemberUids: string[] } | null>(null);
  const pendingBillOverride = useRef<{ command: ApplyBillOverridesCommand; rosterMemberUids: string[] } | null>(null);
  const activeBillRoomId = useRef<string | null>(null);
  const latestBillRevision = useRef<{ roomId: string | null; revision: number; paidCount: number }>({ roomId: null, revision: -1, paidCount: 0 });
  const autoOpenedBillPublications = useRef(new Set<string>());

  useEffect(() => {
    activeBillRoomId.current = groupSummarySnapshot?.roomId ?? null;
    latestBillRevision.current = { roomId: activeBillRoomId.current, revision: -1, paidCount: 0 };
    pendingPayment.current = null;
    setIsMarkingPayment(false);
    setPaymentError(undefined);
    pendingBillCommand.current = null;
    pendingBillOverride.current = null;
    setCommittedBill(null);
    setBillPublishError(undefined);
    setBillOverrideError(undefined);
    setIsPublishingBill(false);
    setIsApplyingBillOverride(false);
  }, [groupSummarySnapshot?.roomId]);

  useEffect(() => {
    if (!groupSummarySnapshot || groupSummarySnapshot.reconciliationStatus !== 'FINALIZED') {
      setPublishedBillState({ kind: 'loading' });
      return undefined;
    }
    setPublishedBillState({ kind: 'loading' });
    const roomId = groupSummarySnapshot.roomId;
    return listenToPublishedBill(roomRuntime.firestore, roomId, state => {
      if (activeBillRoomId.current !== roomId) return;
      if (state.kind === 'published') {
        const revision = state.bill.billRevision ?? 0;
        const latest = latestBillRevision.current;
        if (!acceptsBillProgress(state.bill, latest)) return;
        latestBillRevision.current = { roomId, revision, paidCount: state.bill.billPaidCount ?? 0 };
      }
      setPublishedBillState(state);
    });
  }, [groupSummarySnapshot?.roomId, groupSummarySnapshot?.reconciliationStatus, roomRuntime.firestore, billListenerRevision]);

  useEffect(() => {
    const ownMember = groupSummarySnapshot?.members.find(member => member.uid === profile.uid);
    if (publishedBillState.kind === 'published' && publishedBillState.bill.roomId === groupSummarySnapshot?.roomId
      && shouldOpenPublishedBillForMember(publishedBillState, ownMember?.role, currentScreen, autoOpenedBillPublications.current)) {
      // Chỉ tự mở một lần cho mỗi publication; nút Back phải giữ Member ở summary.
      autoOpenedBillPublications.current.add(billPublicationKey(publishedBillState.bill));
      setCurrentScreen('07-bill-allocation');
    }
  }, [publishedBillState, groupSummarySnapshot, profile.uid, currentScreen]);

  useEffect(() => {
    if (publishedBillState.kind === 'published') setCommittedBill(publishedBillState.bill);
    if (publishedBillState.kind === 'published' && pendingPayment.current
      && publishedBillState.bill.shares.some(share => share.uid === pendingPayment.current?.memberUid
        && share.paymentStatus === 'MARKED_AS_PAID')) {
      pendingPayment.current = null;
      setIsMarkingPayment(false);
      setPaymentError(undefined);
    }
    if (publishedBillState.kind === 'published') pendingBillCommand.current = null;
    if (publishedBillState.kind === 'published' && pendingBillOverride.current?.command.requestId === publishedBillState.bill.requestId) {
      pendingBillOverride.current = null;
      setBillOverrideError(undefined);
    }
    if (publishedBillState.kind === 'published' && (publishedBillState.bill.billPaidCount ?? 0) > 0) {
      // Khi payment đã thắng revision race, request override chưa commit sẽ không còn được Rules chấp nhận.
      pendingBillOverride.current = null;
      setIsApplyingBillOverride(false);
    }
  }, [publishedBillState]);

  const billScreenState = selectPublishedBillState(publishedBillState, committedBill, groupSummarySnapshot?.roomId);
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

  useEffect(() => {
    if (!groupCaptureRoomSnapshot) {
      setGroupDetection(INITIAL_DETECTION_STATE);
      return undefined;
    }
    const roomId = groupCaptureRoomSnapshot.roomId;
    const workTracker = createGroupCaptureWorkTracker();
    groupCaptureWork.current.set(roomId, workTracker);
    const controller = createForegroundDetectionController(
      { id: roomId, userId: profile.uid }, groupViolationRepository,
      () => feedbackService.notifyConfirmedViolation(profile.uid),
    );
    let disposed = false;
    let initialized = false;
    let processing = false;
    let lifecyclePending = false;
    let lifecycleReady = false;
    const startupState = AppState.currentState;
    let latestStartupState = startupState;
    const startupTransitions: { state: typeof AppState.currentState; observedAt: ReturnType<typeof backgroundRecovery.captureTime> }[] = [];
    if (startupState !== 'active') {
      startupTransitions.push({ state: startupState, observedAt: backgroundRecovery.captureTime() });
    }
    let lifecycleController: ReturnType<typeof createSessionLifecycleController> | undefined;
    let lastDetectionState = INITIAL_DETECTION_STATE;
    let latestMeasurement: AccelerometerMeasurement | undefined;
    let tickRequested = false;
    let drainWork: Promise<void> = Promise.resolve();

    const refreshPending = async () => {
      try {
        const [pending, failed] = await Promise.all([
          groupViolationRepository.getPendingCount(roomId),
          groupViolationRepository.getFailedCount(roomId),
        ]);
        if (!disposed) {
          setGroupSyncPendingCount(pending);
          setGroupSyncMessage(failed > 0
            ? `${failed} violation${failed === 1 ? '' : 's'} could not sync and remain saved on this device.`
            : pending > 0 ? `${pending} violation${pending === 1 ? '' : 's'} waiting to sync` : undefined);
        }
      } catch {
        if (!disposed) setGroupSyncMessage('Could not check pending sync yet.');
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
                setGroupDetection(next);
                if (lastDetectionState.isViolationActive && !next.isViolationActive) {
                  void groupViolationRepository.syncPending(roomId).then(refreshPending).catch(() => refreshPending());
                }
                lastDetectionState = next;
              }
            } else {
              tickRequested = false;
              const next = await controller.tick(Date.now());
              if (!disposed) {
                setGroupDetection(next);
                if (lastDetectionState.isViolationActive && !next.isViolationActive) {
                  void groupViolationRepository.syncPending(roomId).then(refreshPending).catch(() => refreshPending());
                }
                lastDetectionState = next;
              }
            }
          }
        } catch {
          if (!disposed) setGroupDetection(state => ({
            ...state, persistenceError: 'Could not save the group violation on this device. It will retry automatically.',
          }));
        } finally {
          processing = false;
          if (!disposed && !lifecyclePending && (latestMeasurement || tickRequested)) void drain();
        }
      })());
      return drainWork;
    };

    // Đệm AppState trong lúc mở SQLite/controller để không bỏ mất candidate nếu app chuyển nền sớm.
    const appStateSubscription = AppState.addEventListener('change', state => {
      const wasActive = latestStartupState === 'active';
      latestStartupState = state;
      const observedAt = backgroundRecovery.captureTime();
      if (lifecycleController && lifecycleReady) {
        void workTracker.track(lifecycleController.handleChangeAt(state, observedAt)).catch(() => undefined);
        if (state === 'active') {
          void drain();
          void groupViolationRepository.syncPending(roomId).then(refreshPending).catch(() => refreshPending());
        }
      } else if ((wasActive && state !== 'active') || (!wasActive && state === 'active')) {
        startupTransitions.push({ state, observedAt });
      }
    });

    const initialization = (async () => {
      try {
        const db = await getLocalDatabase();
        // Room ID là khóa chính cục bộ; khi đổi tài khoản, chuyển session đang hoạt động sang chủ tài khoản hiện tại.
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
          roomId, profile.uid, new Date(groupCaptureRoomSnapshot.startedAtUtcMs!).toISOString(),
        );
        const state = await controller.initialize();
        if (disposed) return;
        setGroupDetection(state);
        lastDetectionState = state;
        initialized = true;
        lifecycleController = createSessionLifecycleController({
          session: { sessionId: roomId, userId: profile.uid },
          // Mọi thay đổi kể từ lúc effect bắt đầu được replay từ trạng thái foreground này.
          initialState: 'active',
          repository: {
            begin: input => backgroundRecovery.begin(input),
            reconcile: input => {
              const cutoffUtcMs = groupLifecycleCutoffs.current.get(input.sessionId);
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
            if (detection) { setGroupDetection(detection); lastDetectionState = detection; }
            void groupViolationRepository.syncPending(roomId).then(refreshPending).catch(() => refreshPending());
            if (recovery === 'needs-review') Alert.alert(
              'Session recovery needs review',
              'Background time could not be verified. No group violation was added for that interval.',
            );
          },
          onError: stage => setGroupDetection(current => ({
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
            // Nếu AppState đổi trong lúc recovery đọc SQLite, vòng lặp xử lý mốc vừa được đệm.
            await workTracker.track(lifecycleController.reconcileCurrent());
            continue;
          }
          if (startupTransitions.length === 0) break;
        }
        lifecycleReady = true;
        void drain();
        void refreshPending();
      } catch {
        if (!disposed) setGroupDetection(current => ({ ...current, persistenceError: 'Could not load this room’s local violation history.' }));
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
      setGroupDetection(state => ({ ...state, persistenceError: 'Could not start the accelerometer. Check sensor availability.' }));
    }
    const networkSubscription = Network.addNetworkStateListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setGroupIsOnline(online);
      if (online) void groupViolationRepository.syncPending(roomId).then(refreshPending).catch((error: GroupViolationError) => {
        if (error.code === 'failed-precondition') setGroupSyncMessage('A saved violation is waiting for room reconciliation.');
        else void refreshPending();
      });
    });
    void Network.getNetworkStateAsync().then(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (!disposed) setGroupIsOnline(online);
      if (online) void groupViolationRepository.syncPending(roomId).then(refreshPending).catch(() => refreshPending());
    }).catch(() => { if (!disposed) setGroupIsOnline(false); });

    return () => {
      disposed = true;
      sensorSubscription?.remove();
      if (timer) clearInterval(timer);
      appStateSubscription.remove();
      networkSubscription.remove();
      lifecycleController?.dispose();
    };
  }, [groupCaptureRoomSnapshot?.roomId, profile.uid, groupViolationRepository]);

  const handlePublishBill = async (totalBillVnd?: number, shareOverrides?: BillShareOverride[]) => {
    const snapshot = groupSummarySnapshot;
    const ownMember = snapshot?.members.find(member => member.uid === profile.uid);
    if (!snapshot || snapshot.reconciliationStatus !== 'FINALIZED' || ownMember?.role !== 'HOST'
      || ownMember.status !== 'ACTIVE' || isPublishingBill) return;

    let pending = pendingBillCommand.current;
    if (!pending) {
      if (totalBillVnd == null) return;
      pending = {
        command: { version: 1, requestId: Crypto.randomUUID(), roomId: snapshot.roomId, totalBillVnd,
          ...(shareOverrides?.length ? { shareOverrides: [...shareOverrides].sort((a, b) => a.uid.localeCompare(b.uid)) } : {}) },
        rosterMemberUids: snapshot.members
          .filter(member => member.status === 'ACTIVE' || member.status === 'EARLY_EXIT')
          .map(member => member.uid),
      };
      pendingBillCommand.current = pending;
    } else if (pending.command.roomId !== snapshot.roomId
      || (totalBillVnd != null && pending.command.totalBillVnd !== totalBillVnd)
      || (shareOverrides != null && JSON.stringify([...(pending.command.shareOverrides ?? [])].sort((a, b) => a.uid.localeCompare(b.uid)))
        !== JSON.stringify([...shareOverrides].sort((a, b) => a.uid.localeCompare(b.uid))))) {
      return;
    }

    setIsPublishingBill(true);
    setBillPublishError(undefined);
    try {
      const result = await billRepository.publish(pending.command, pending.rosterMemberUids);
      if (activeBillRoomId.current === pending.command.roomId) {
        pendingBillCommand.current = null;
        if (acceptsBillProgress(result, latestBillRevision.current)) {
          latestBillRevision.current = { roomId: result.roomId, revision: result.billRevision ?? 0, paidCount: result.billPaidCount ?? 0 };
          setCommittedBill(result);
          setPublishedBillState({ kind: 'published', bill: result });
        }
      }
    } catch (error) {
      if (activeBillRoomId.current === pending.command.roomId) setBillPublishError(billPublishErrorMessage(error));
      if (activeBillRoomId.current === pending.command.roomId
        && error instanceof BillRepositoryError && error.code !== 'unavailable') {
        pendingBillCommand.current = null;
      }
    } finally {
      if (activeBillRoomId.current === pending.command.roomId) setIsPublishingBill(false);
    }
  };

  const handleRetryPublishedBill = () => {
    if (!groupSummarySnapshot) return;
    // Listener lỗi đã dừng; retry phải gắn subscription mới để tiếp tục nhận publication realtime.
    setBillListenerRevision(revision => revision + 1);
  };

  const handleApplyBillOverrides = async (overrides?: BillShareOverride[], expectedRevision?: number) => {
    const snapshot = groupSummarySnapshot;
    const ownMember = snapshot?.members.find(member => member.uid === profile.uid);
    if (!snapshot || snapshot.reconciliationStatus !== 'FINALIZED' || ownMember?.role !== 'HOST'
      || ownMember.status !== 'ACTIVE' || isApplyingBillOverride || !groupIsOnline
      || pendingPayment.current || isMarkingPayment) return;
    let pending = pendingBillOverride.current;
    if (!pending) {
      if (!overrides?.length || expectedRevision == null) return;
      pending = {
        command: { version: 1, requestId: Crypto.randomUUID(), roomId: snapshot.roomId, expectedRevision, overrides },
        rosterMemberUids: snapshot.members
          .filter(member => member.status === 'ACTIVE' || member.status === 'EARLY_EXIT')
          .map(member => member.uid),
      };
      pendingBillOverride.current = pending;
    } else if (pending.command.roomId !== snapshot.roomId
      || (expectedRevision != null && pending.command.expectedRevision !== expectedRevision)) return;

    setIsApplyingBillOverride(true);
    setBillOverrideError(undefined);
    try {
      const result = await billRepository.applyOverrides(pending.command, pending.rosterMemberUids);
      if (activeBillRoomId.current === pending.command.roomId) {
        pendingBillOverride.current = null;
        const latest = latestBillRevision.current;
        const resultRevision = result.billRevision ?? 0;
        if (acceptsBillProgress(result, latest)) {
          latestBillRevision.current = { roomId: pending.command.roomId, revision: resultRevision, paidCount: result.billPaidCount ?? 0 };
          setCommittedBill(result);
          setPublishedBillState({ kind: 'published', bill: result });
        }
      }
    } catch (error) {
      if (activeBillRoomId.current === pending.command.roomId) setBillOverrideError(billPublishErrorMessage(error));
      if (activeBillRoomId.current === pending.command.roomId
        && error instanceof BillRepositoryError && error.code !== 'unavailable') {
        pendingBillOverride.current = null;
      }
    } finally {
      if (activeBillRoomId.current === pending.command.roomId) setIsApplyingBillOverride(false);
    }
  };

  const handleMarkPayment = async (memberUid?: string, publicationRequestId?: string, expectedRevision?: number) => {
    const snapshot = groupSummarySnapshot;
    const host = snapshot?.members.find(member => member.uid === profile.uid);
    if (!snapshot || activeBillRoomId.current !== snapshot.roomId || host?.role !== 'HOST' || host.status !== 'ACTIVE'
      || snapshot.reconciliationStatus !== 'FINALIZED' || !groupIsOnline || isMarkingPayment
      || pendingBillOverride.current || isApplyingBillOverride) return;
    let command = pendingPayment.current;
    if (!command) {
      if (!memberUid || !publicationRequestId || expectedRevision == null) return;
      command = { version: 1, requestId: Crypto.randomUUID(), roomId: snapshot.roomId, memberUid,
        targetStatus: 'MARKED_AS_PAID', publicationRequestId, expectedRevision };
      pendingPayment.current = command;
    } else if (command.roomId !== snapshot.roomId || (memberUid && command.memberUid !== memberUid)) return;
    const pending = command;
    setIsMarkingPayment(true);
    setPaymentError(undefined);
    try {
      await paymentStatusRepository.markPaid(pending, groupIsOnline);
      if (activeBillRoomId.current === pending.roomId && pendingPayment.current?.requestId === pending.requestId) {
        // Chỉ subscription xác nhận trạng thái hiển thị; receipt không tự nâng UI thành paid.
        setBillListenerRevision(revision => revision + 1);
      }
    } catch (error) {
      if (activeBillRoomId.current !== pending.roomId || pendingPayment.current?.requestId !== pending.requestId) return;
      const code = error instanceof PaymentStatusError ? error.code : 'unavailable';
      setPaymentError(code === 'unavailable' ? 'Could not confirm the result. Reconnect and retry the saved request.'
        : code === 'failed-precondition' || code === 'already-exists' ? 'The bill or payment status changed. Refresh and review it before confirming again.'
          : code === 'permission-denied' ? 'Payment confirmation was denied. Check the Host role and deployed Firestore Rules.'
            : 'The payment could not be confirmed. Refresh the bill and try again.');
      if (code !== 'unavailable') {
        pendingPayment.current = null;
        setBillListenerRevision(revision => revision + 1);
      }
    } finally {
      if (activeBillRoomId.current === pending.roomId) setIsMarkingPayment(false);
    }
  };

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
              members={groupSummarySnapshot.members
                .filter(member => member.status === 'ACTIVE' || member.status === 'EARLY_EXIT')
                .map(member => ({ uid: member.uid, displayName: member.displayName, penaltyScore: member.penaltyScore,
                  avatarUri: member.avatarUri, premiumExpiresAtUtcMs: member.uid === profile.uid
                    ? profile.premiumExpiresAtUtcMs : member.premiumExpiresAtUtcMs }))}
              state={billScreenState}
              pendingPaymentMemberUid={pendingPayment.current?.memberUid}
              isMarkingPayment={isMarkingPayment}
              paymentError={paymentError}
              onMarkPaid={(uid, publicationId, revision) => { void handleMarkPayment(uid, publicationId, revision); }}
              onRetryPayment={() => { void handleMarkPayment(); }}
              actorUid={profile.uid}
              onPayShare={() => setCurrentScreen('08-vietqr-settlement')}
              isOnline={groupIsOnline}
              isPublishing={isPublishingBill}
              pendingTotalVnd={pendingBillCommand.current?.command.totalBillVnd}
              pendingShareOverrides={pendingBillCommand.current?.command.shareOverrides}
              isApplyingOverride={isApplyingBillOverride}
              hasPendingOverride={pendingBillOverride.current != null}
              publishError={billPublishError}
              overrideError={billOverrideError}
              onPublish={(amount, overrides) => { void handlePublishBill(amount, overrides); }}
              onApplyOverrides={(overrides, revision) => { void handleApplyBillOverrides(overrides, revision); }}
              onRetry={() => { void handleRetryPublishedBill(); }}
              onRetryPublish={() => { void handlePublishBill(); }}
              onRetryOverride={() => { void handleApplyBillOverrides(); }}
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
            currentUserId={profile.uid}
            currentUserPremiumExpiresAtUtcMs={profile.premiumExpiresAtUtcMs}
            onOpenHistory={() => { setGroupHistoryInitialRoomId(undefined); setCurrentScreen('15-group-history'); }}
            recentSessions={recentGroupSessions}
            recentMemberPreviews={recentGroupMemberPreviews}
            recentSessionsState={recentSessionsState}
            actionableSessions={actionableGroupSessions}
            actionableSessionsState={actionableSessionsState}
            actionableErrorMessage={actionableErrorMessage}
            actionableHasMore={actionableHasMore}
            isLoadingMoreActionable={isLoadingMoreActionable}
            onOpenRecentSession={roomId => { setGroupHistoryInitialRoomId(roomId); setCurrentScreen('15-group-history'); }}
            onRetryRecentSessions={() => { void loadRecentGroupSessions(); }}
            onOpenActionableSession={item => { void openActionableGroupSession(item); }}
            onRetryActionableSessions={() => { void loadActionableGroupSessions(); }}
            onLoadMoreActionableSessions={() => { void loadMoreActionableGroupSessions(); }}
            room={lobbyRoom ? {
              roomId: lobbyRoom.roomId, pin: lobbyRoom.pin, invitation: lobbyRoom.invitation,
              hostUid: lobbyRoom.hostUid,
              createdAt: 'createdAt' in lobbyRoom ? lobbyRoom.createdAt : lobbyRoom.roomCreatedAt,
              localCacheSaved: lobbyRoom.localCacheSaved,
            } : null}
            isCreating={isCreatingRoom}
            errorMessage={roomCreateError}
            onCancelCreate={cancelRoomCreateAndJoin}
            lobbyState={roomLobbyState}
            isHost={lobbyRoom?.hostUid === profile.uid}
            isStarting={isStartingRoom}
            isLeaving={isLeavingRoom}
            leaveError={roomLeaveError}
            onLeaveRoom={confirmLeaveLobby}
            onRemoveMember={confirmRemoveLobbyMember}
            removingMemberUid={removingMemberUid}
            removeError={roomRemoveError}
            startError={roomStartError}
            onStartRoom={() => { void handleStartRoom(); }}
            onCreateRoom={() => { void handleCreateRoom(); }}
            onJoinRoom={() => {
              setJoinedRoom(null);
              setRoomLeaveError(undefined);
              setRoomRemoveError(undefined);
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
            onOpenLobby={() => { setCurrentScreen('05-group-lobby'); }}
          />
        )}

        {currentScreen === '06-group-active' && (
          groupRoomSnapshot
            ? <GroupActiveScreen snapshot={groupRoomSnapshot} elapsedSeconds={groupTimerSeconds}
                detection={groupDetection} isOnline={groupIsOnline} syncMessage={groupSyncMessage}
                pendingSyncCount={groupSyncPendingCount}
                actorUid={profile.uid} currentUserPremiumExpiresAtUtcMs={profile.premiumExpiresAtUtcMs} openEarlyExitRequests={openEarlyExitRequests}
                isRequestingEarlyExit={isRequestingEarlyExit} decidingEarlyExit={decidingEarlyExit}
                earlyExitError={earlyExitError} onRequestEarlyExit={() => { void handleRequestEarlyExit(); }}
                onDecideEarlyExit={(request, decision) => { void handleDecideEarlyExit(request, decision); }}
                terminationVoteState={terminationVoteState} isOpeningTerminationVote={isOpeningTerminationVote}
                isCastingTerminationVote={isCastingTerminationVote} terminationVoteError={terminationVoteError}
                onOpenTerminationVote={() => { void handleOpenTerminationVote(); }}
                onCastTerminationVote={choice => { void handleCastTerminationVote(choice); }}
                isCompletingRoom={isCompletingRoom} completionError={roomCompletionError}
                onCompleteRoom={() => { void handleCompleteRoom(); }} />
            : <Text accessibilityRole="alert">Waiting for the active room snapshot…</Text>
        )}

        {currentScreen === '13-group-summary' && (
          groupSummarySnapshot
            ? <GroupSummaryScreen snapshot={groupSummarySnapshot} actorUid={profile.uid}
                currentUserPremiumExpiresAtUtcMs={profile.premiumExpiresAtUtcMs}
                isOnline={groupIsOnline} isSyncing={isAcknowledgingRoom}
                isFinalizingOverride={isFinalizingRoomOverride}
                errorMessage={roomAcknowledgmentError}
                overrideErrorMessage={roomOverrideError}
                onSyncAndAcknowledge={() => { void handleAcknowledgeRoomSync(); }}
                onFinalizeWithOverride={uids => { void handleFinalizeRoomOverride(uids); }}
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
