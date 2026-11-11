import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '../components/GlassCard';
import { Colors } from '../constants/theme';
import { formatTime } from '../constants';
import { rankGroupMembers } from '../features/rooms/group-active-domain';
import type { RoomLobbySnapshot } from '../features/rooms/room-listener';
import type { ForegroundDetectionViewState } from '../features/solo/foreground-detection-controller';
import type { EarlyExitDecision, EarlyExitRequest } from '../features/rooms/early-exit-repository';
import type { TerminationChoice } from '../features/rooms/termination-vote-repository';
import type { TerminationVoteState } from '../features/rooms/termination-vote-listener';

type Props = {
  snapshot: RoomLobbySnapshot;
  elapsedSeconds: number;
  detection: ForegroundDetectionViewState;
  isOnline: boolean;
  syncMessage?: string;
  pendingSyncCount?: number;
  actorUid: string;
  openEarlyExitRequests: EarlyExitRequest[];
  isRequestingEarlyExit: boolean;
  decidingEarlyExit: { requestId: string; decision: EarlyExitDecision } | null;
  earlyExitError?: string;
  onRequestEarlyExit: () => void;
  onDecideEarlyExit: (request: EarlyExitRequest, decision: EarlyExitDecision) => void;
  terminationVoteState?: TerminationVoteState;
  isOpeningTerminationVote?: boolean;
  isCastingTerminationVote?: boolean;
  terminationVoteError?: string;
  onOpenTerminationVote?: () => void;
  onCastTerminationVote?: (choice: TerminationChoice) => void;
  isCompletingRoom?: boolean;
  completionError?: string;
  onCompleteRoom?: () => void;
};

export function GroupActiveScreen({ snapshot, elapsedSeconds, detection, isOnline, syncMessage, pendingSyncCount = 0, actorUid,
  openEarlyExitRequests, isRequestingEarlyExit, decidingEarlyExit, earlyExitError,
  onRequestEarlyExit, onDecideEarlyExit,
  terminationVoteState = { vote: null, ownBallot: null, error: false },
  isOpeningTerminationVote = false, isCastingTerminationVote = false, terminationVoteError,
  onOpenTerminationVote = () => undefined, onCastTerminationVote = () => undefined,
  isCompletingRoom = false, completionError, onCompleteRoom = () => undefined }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const members = rankGroupMembers(snapshot.members);
  const ownMember = snapshot.members.find(member => member.uid === actorUid);
  const isHost = ownMember?.role === 'HOST';
  const ownRequest = openEarlyExitRequests.find(request => request.memberUid === actorUid);
  const vote = terminationVoteState.vote;
  const ownBallot = terminationVoteState.ownBallot?.voteId === vote?.voteId ? terminationVoteState.ownBallot : null;
  const voteSecondsLeft = vote?.openedAtUtcMs == null ? null
    : Math.max(0, Math.ceil((vote.openedAtUtcMs + 30_000 - now) / 1_000));
  const hasOpenVote = vote?.status === 'OPEN';
  const voteHasExpired = hasOpenVote && voteSecondsLeft === 0;
  // Giờ thiết bị chỉ để tham khảo; Rules quyết định còn được bỏ phiếu/mở vote mới.
  const canParticipate = snapshot.status === 'ACTIVE' && ownMember?.status === 'ACTIVE';
  const canOpenVote = canParticipate && (!vote || vote.status === 'OPEN');
  const canCastVote = hasOpenVote && voteSecondsLeft !== null && voteSecondsLeft > 0 && canParticipate;
  const recordingWarning = detection.persistenceError
    ? getRecordingWarning(detection.persistenceError)
    : null;
  const syncWarning = getVisibleSyncWarning(syncMessage);
  const confirmEarlyExitRequest = () => Alert.alert(
    'Request early exit?',
    'Your score will freeze at current time.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Request', onPress: onRequestEarlyExit },
    ],
  );
  const confirmTerminationVote = () => Alert.alert(
    'End session early?',
    'Everyone still active must vote Yes within 30 seconds. Bill settlement will be skipped.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start vote', onPress: onOpenTerminationVote },
    ],
  );
  const confirmRoomCompletion = () => Alert.alert(
    'End this group session?',
    'The room will close at server time. Everyone must sync their saved session data before final scores are locked.',
    [
      { text: 'Keep session open', style: 'cancel' },
      { text: 'End session', style: 'destructive', onPress: onCompleteRoom },
    ],
  );
  const sessionControls = (
    <GlassCard style={styles.controlsCard}>
      <View style={styles.controlsContent}>
        <Text style={styles.sectionTitle}>Session controls</Text>
        {hasOpenVote ? (
          <>
            <Text style={styles.controlSubheading}>Vote to end session</Text>
            {voteHasExpired ? (
              <Text style={[styles.voteResult, vote.yesVoteCount >= vote.eligibleVoterCount && styles.safeText]}>
                {vote.yesVoteCount >= vote.eligibleVoterCount
                  ? 'All members agreed · ending the session'
                  : 'Voting window ended · session continues'}
              </Text>
            ) : voteSecondsLeft === null ? (
              <Text style={styles.body}>Checking vote timing…</Text>
            ) : (
              <View style={styles.voteSummary}>
                <Text accessibilityLabel={`Voting closes in ${voteSecondsLeft} seconds`} style={styles.voteCountdown}>
                  Ends in {voteSecondsLeft}s
                </Text>
                <Text style={styles.voteCount}>{vote.yesVoteCount} / {vote.eligibleVoterCount} Yes</Text>
              </View>
            )}
            {voteHasExpired && vote.yesVoteCount < vote.eligibleVoterCount ? (
              <View style={styles.expiredVoteRow}>
                <Text style={styles.body}>Yes votes: {vote.yesVoteCount} / {vote.eligibleVoterCount}</Text>
                {ownBallot ? <Text style={styles.ballotBadge}>You voted {ownBallot.choice === 'YES' ? 'Yes' : 'No'}</Text> : null}
              </View>
            ) : null}
            {!voteHasExpired && ownBallot ? (
              <View style={styles.ballotRow}>
                <Text style={styles.ballotBadge}>You voted {ownBallot.choice === 'YES' ? 'Yes' : 'No'}</Text>
              </View>
            ) : null}
            {!ownBallot && canCastVote ? (
              <View style={styles.actionRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Vote yes to end session" disabled={!isOnline || isCastingTerminationVote}
                  onPress={() => onCastTerminationVote('YES')}
                  style={[styles.actionButton, styles.rowAction, (!isOnline || isCastingTerminationVote) && styles.disabled]}>
                  {isCastingTerminationVote ? <ActivityIndicator color={Colors.light.onPrimary} /> : null}
                  <Text style={styles.actionText}>Yes</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Vote no to continue session" disabled={!isOnline || isCastingTerminationVote}
                  onPress={() => onCastTerminationVote('NO')}
                  style={[styles.secondaryButton, (!isOnline || isCastingTerminationVote) && styles.disabled]}>
                  <Text style={styles.secondaryActionText}>No</Text>
                </Pressable>
              </View>
            ) : null}
            {voteHasExpired && canOpenVote ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Initiate termination vote" disabled={!isOnline || isOpeningTerminationVote}
                onPress={confirmTerminationVote}
                style={[styles.voteStartButton, (!isOnline || isOpeningTerminationVote) && styles.disabled]}>
                {isOpeningTerminationVote ? <ActivityIndicator color={Colors.light.primary} /> : null}
                <Text style={styles.voteStartText}>Start another vote</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            {vote?.status === 'CANCELLED' ? <Text style={styles.controlSubheading}>Vote ended</Text> : null}
            {vote?.status === 'CANCELLED' ? <Text style={styles.body}>This room was cancelled by unanimous vote.</Text> : null}
            {canOpenVote ? (
              <>
                <Pressable accessibilityRole="button" accessibilityLabel="Initiate termination vote" disabled={!isOnline || isOpeningTerminationVote}
                  onPress={confirmTerminationVote}
                  style={[styles.voteStartButton, (!isOnline || isOpeningTerminationVote) && styles.disabled]}>
                  {isOpeningTerminationVote ? <ActivityIndicator color={Colors.light.primary} /> : null}
                  <Text style={styles.voteStartText}>Vote to end session</Text>
                </Pressable>
                <Text style={styles.body}>Requires every active member to agree within 30 seconds.</Text>
              </>
            ) : null}
            {!vote && !canParticipate ? <Text style={styles.body}>Only active members can start an early-end vote.</Text> : null}
          </>
        )}
        {terminationVoteState.error || terminationVoteError ? (
          <Text accessibilityRole="alert" style={styles.error}>{terminationVoteError || 'Could not load the current vote. Reconnect and reopen the room to retry.'}</Text>
        ) : null}
        {!isOnline && canParticipate ? <Text style={styles.body}>Connect to the internet to participate in a vote.</Text> : null}
        {isHost && snapshot.status === 'ACTIVE' ? (
          <>
            <View style={styles.controlDivider} />
            <View style={styles.controlCopy}>
              <Text style={styles.controlSubheading}>Finish without a vote</Text>
              <Text style={styles.body}>Final scores stay pending until all members sync.</Text>
            </View>
            {completionError ? <Text accessibilityRole="alert" style={styles.error}>{completionError}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="End group session" disabled={!isOnline || isCompletingRoom}
              onPress={confirmRoomCompletion}
              style={[styles.endButton, (!isOnline || isCompletingRoom) && styles.disabled]}>
              {isCompletingRoom ? <ActivityIndicator accessibilityLabel="Ending group session" color={Colors.light.error} /> : null}
              <Text style={styles.endActionText}>{isCompletingRoom ? 'Ending session…' : 'End group session now'}</Text>
            </Pressable>
            {!isOnline ? <Text style={styles.body}>Connect to the internet to end the room.</Text> : null}
          </>
        ) : null}
      </View>
    </GlassCard>
  );
  const orientationLabel = { UNKNOWN: 'Checking position…', FACE_DOWN: 'Face down', LIFTED: 'Phone lifted', INVALID: 'Position unavailable' }[detection.orientation] ?? 'Position unavailable';
  return (
    <View style={styles.container}>
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroContent}>
          <View style={styles.timerHeading}>
            <Text style={styles.eyebrow}>Time elapsed</Text>
            <ConnectionIndicator isOnline={isOnline} />
          </View>
          <View style={styles.timerReadout}>
            <Text accessibilityLabel="Elapsed group session time" style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
            {ownMember?.status === 'EARLY_EXIT' ? null : (
              <View accessible accessibilityLabel={`Phone status: ${orientationLabel}`} style={styles.phoneStatus}>
                {detection.orientation === 'LIFTED' ? <Ionicons name="alert-circle" size={16} color={Colors.light.warning} /> : null}
                {detection.orientation === 'FACE_DOWN' ? <Ionicons name="checkmark-circle" size={16} color={Colors.light.success} /> : null}
                <Text style={[
                  styles.orientation,
                  detection.orientation === 'FACE_DOWN' ? styles.safeText : null,
                  detection.orientation === 'LIFTED' ? styles.warningText : null,
                ]}>{orientationLabel}</Text>
              </View>
            )}
            {!isOnline ? <Text style={styles.timerNotice}>Offline · showing saved room data</Text> : null}
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.metrics}>
            <Metric
              value={String(ownMember?.status === 'EARLY_EXIT' ? ownMember.liftCount : detection.violationsCount)}
              label="Confirmed lifts"
            />
            <View style={styles.metricDivider} />
            <Metric
              value={formatTime(ownMember?.status === 'EARLY_EXIT' ? ownMember.violationDurationSeconds : detection.violationDurationSeconds)}
              label="Time away"
            />
          </View>
          {ownMember?.status === 'EARLY_EXIT' ? (
            <Text accessibilityLabel={`Saved penalty score: ${ownMember.penaltyScore} points`} style={styles.savedScore}>
              Saved score · {ownMember.penaltyScore} pts
            </Text>
          ) : (
            detection.isGraceActive ? <Text style={styles.notice}>Grace period · {detection.graceSeconds}s</Text> : null
          )}
          {syncWarning ? (
            <View accessibilityLiveRegion="polite" style={styles.syncMessage}>
              <Ionicons
                name={/could not|failed/i.test(syncWarning) ? 'alert-circle-outline' : 'cloud-upload-outline'}
                size={15}
                color={/could not|failed/i.test(syncWarning) ? Colors.light.warning : Colors.light.textSecondary}
                accessibilityElementsHidden
              />
              <Text style={[styles.rosterCaption, /could not|failed/i.test(syncWarning) && styles.warningText]}>{syncWarning}</Text>
            </View>
          ) : null}
        </View>
      </GlassCard>

      {ownMember?.status !== 'EARLY_EXIT' && recordingWarning ? (
        <View accessibilityRole="alert" style={styles.warningBox}>
          <View style={styles.warningHeading}>
            <Ionicons name="alert-circle-outline" size={19} color={Colors.light.error} accessibilityElementsHidden />
            <Text style={styles.warningTitle}>{recordingWarning.title}</Text>
          </View>
          <Text style={styles.warningDescription}>{recordingWarning.description}</Text>
        </View>
      ) : null}

      {ownMember?.status === 'EARLY_EXIT' ? (
        <GlassCard style={styles.exitCard}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>You left the active session</Text>
            <Text style={styles.body}>Your confirmed activity through the approved cutoff can still sync before the room is finalized.</Text>
          </View>
        </GlassCard>
      ) : null}

      {isHost && openEarlyExitRequests.length > 0 ? (
        <View style={styles.exitRequests}>
          <Text style={styles.sectionTitle}>Early exit requests</Text>
          {openEarlyExitRequests.map(request => {
            const member = snapshot.members.find(candidate => candidate.uid === request.memberUid);
            const busy = decidingEarlyExit !== null;
            const isCurrentRequest = decidingEarlyExit?.requestId === request.requestId;
            return (
              <GlassCard key={request.memberUid} style={styles.requestCard}>
                <View style={styles.cardContent}>
                  <Text style={styles.name}>{member?.displayName || 'Participant'} wants to leave early</Text>
                  <View style={styles.actionRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Approve early exit request" disabled={busy || !isOnline}
                      onPress={() => onDecideEarlyExit(request, 'APPROVE')}
                      style={[styles.actionButton, styles.rowAction, (busy || !isOnline) && styles.disabled]}>
                      {isCurrentRequest && decidingEarlyExit?.decision === 'APPROVE'
                        ? <ActivityIndicator accessibilityLabel="Processing approval" color={Colors.light.onPrimary} /> : null}
                      <Text style={styles.actionText}>Approve</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Deny early exit request" disabled={busy || !isOnline}
                      onPress={() => onDecideEarlyExit(request, 'DENY')}
                      style={[styles.secondaryButton, (busy || !isOnline) && styles.disabled]}>
                      {isCurrentRequest && decidingEarlyExit?.decision === 'DENY'
                        ? <ActivityIndicator accessibilityLabel="Processing denial" color={Colors.light.primary} /> : null}
                      <Text style={styles.secondaryActionText}>Deny</Text>
                    </Pressable>
                  </View>
                </View>
              </GlassCard>
            );
          })}
          {earlyExitError ? <Text accessibilityRole="alert" style={styles.error}>{earlyExitError}</Text> : null}
        </View>
      ) : null}

      <View style={styles.leaderboard}>
        <View style={styles.rosterHeading}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Members · {members.length}</Text>
          <Text accessibilityLabel="Scoring rule: lowest score wins" style={styles.ruleText}>Lowest score wins</Text>
        </View>
        <View style={styles.rosterPanel}>
          {members.length === 0 ? <Text style={styles.emptyRoster}>Waiting for members…</Text> : members.map((member, index) => (
            <View key={member.uid} style={[styles.memberRow, index > 0 && styles.memberDivider]}>
              <View style={[styles.avatarRankWrap, index === 0 && styles.winnerAvatarWrap]}>
                <SessionAvatar name={member.displayName} uri={snapshot.members.find(candidate => candidate.uid === member.uid)?.avatarUri} />
                <Text accessibilityLabel={'Rank ' + (index + 1)} style={[styles.rankBadge, index === 0 && styles.winnerRankBadge]}>{index + 1}</Text>
              </View>
              <View style={styles.memberDetails}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.name}>{member.displayName || 'Participant'}</Text>
                  {member.uid === actorUid ? <Text style={styles.youBadge}>YOU</Text> : null}
                </View>
                <View style={styles.memberLiftLine}>
                  <Text style={styles.body}>{member.liftCount} room lifts</Text>
                  {member.uid === actorUid && pendingSyncCount > 0 ? (
                    <View accessibilityLabel={`${pendingSyncCount} local violations waiting to sync`} style={styles.pendingMemberBadge}>
                      <Ionicons name="cloud-upload-outline" size={13} color={Colors.light.warning} accessibilityElementsHidden />
                      <Text style={styles.pendingMemberText}>{pendingSyncCount} pending</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.score, index === 0 && styles.winnerScore]}>{member.penaltyScore} pts</Text>
            </View>
          ))}
          <View style={styles.rosterFooter}>
            <Ionicons name="information-circle-outline" size={15} color={Colors.light.textSecondary} accessibilityElementsHidden />
            <Text style={styles.rosterCaption}>Scores update as members sync.</Text>
          </View>
        </View>
      </View>

      {!isHost && ownMember?.role === 'MEMBER' && ownMember.status === 'ACTIVE' ? (
        <GlassCard style={styles.exitCard}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Leave the group session early?</Text>
            <Text style={styles.body}>The Host must approve. Your membership and score history stay in the room.</Text>
            {earlyExitError ? <Text accessibilityRole="alert" style={styles.error}>{earlyExitError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Request early exit"
              disabled={isRequestingEarlyExit || Boolean(ownRequest) || !isOnline}
              onPress={confirmEarlyExitRequest}
              style={[styles.actionButton, (isRequestingEarlyExit || Boolean(ownRequest) || !isOnline) && styles.disabled]}
            >
              {isRequestingEarlyExit ? <ActivityIndicator color={Colors.light.onPrimary} /> : null}
              <Text style={styles.actionText}>{ownRequest ? 'Request sent · waiting for Host' : 'Request to leave'}</Text>
            </Pressable>
            {!isOnline ? <Text style={styles.body}>Connect to the internet to send this request.</Text> : null}
          </View>
        </GlassCard>
      ) : null}

      {sessionControls}

    </View>
  );
}

function ConnectionIndicator({ isOnline }: { isOnline: boolean }) {
  const [opacity] = React.useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!isOnline) {
      opacity.setValue(1);
      return undefined;
    }
    let active = true;
    let pulse: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduceMotion => {
      if (!active || reduceMotion) return;
      pulse = Animated.loop(Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      pulse.start();
    }).catch(() => undefined);
    return () => {
      active = false;
      pulse?.stop();
      opacity.setValue(1);
    };
  }, [isOnline, opacity]);

  return (
    <View accessible accessibilityLabel={isOnline ? 'Room connection online' : 'Room connection offline'} style={[styles.connectionPill, !isOnline && styles.offlinePill]}>
      <View style={[styles.connectionHalo, !isOnline && styles.offlineHalo]}>
        <Animated.View style={[styles.connectionDot, !isOnline && styles.offlineDot, { opacity }]} />
      </View>
      <Text style={styles.connection}>{isOnline ? 'Online' : 'Offline'}</Text>
    </View>
  );
}

function getRecordingWarning(error: string): { title: string; description: string } {
  if (error.includes('Could not load this room')) {
    return {
      title: 'Could not load local violation history',
      description: 'Local totals may be incomplete. The leaderboard shows the last synced scores.',
    };
  }
  if (error.includes('accelerometer')) {
    return {
      title: 'Phone position is unavailable',
      description: error,
    };
  }
  if (error.includes('background transition')) {
    return {
      title: 'Could not save a background transition',
      description: 'Some time away from the app may not count in this session.',
    };
  }
  if (error.includes('violation')) {
    return {
      title: 'Could not save local activity',
      description: 'Your latest violation may be missing from local totals. DontLift will retry automatically.',
    };
  }
  return { title: 'Local recording needs attention', description: error };
}

function getVisibleSyncWarning(message?: string): string | undefined {
  if (!message) return undefined;
  if (/waiting to sync|eligible violations are saved on this device/i.test(message)) return undefined;
  return message;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>;
}

function SessionAvatar({ name, uri }: { name: string; uri?: string }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const initials = words.length > 1
    ? `${Array.from(words[0])[0]}${Array.from(words[words.length - 1])[0]}`
    : Array.from(words[0] || '?').slice(0, 2).join('');
  return <View style={styles.avatar}>
    {uri && failedUri !== uri ? <Image source={{ uri }} cachePolicy="memory-disk" contentFit="cover" style={styles.avatarImage}
      onError={() => setFailedUri(uri)} accessibilityLabel={`${name || 'Participant'}'s avatar`} />
      : <Text style={styles.avatarInitials}>{initials.toLocaleUpperCase()}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 24 },
  heroCard: { padding: 18 },
  heroContent: { gap: 12 },
  timerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { color: Colors.light.textSecondary, fontSize: 13, fontWeight: '700' },
  connectionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.light.roomStatusPill },
  offlinePill: { backgroundColor: Colors.light.backgroundElement },
  connectionHalo: { width: 12, height: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.onlineIndicatorRing },
  offlineHalo: { backgroundColor: Colors.light.glassBorder },
  connectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.light.onlineIndicator },
  offlineDot: { backgroundColor: Colors.light.textSecondary },
  connection: { color: Colors.light.success, fontSize: 12, fontWeight: '700' },
  timer: { color: Colors.light.text, fontSize: 64, lineHeight: 72, fontWeight: '800', fontVariant: ['tabular-nums'], textAlign: 'center' },
  timerReadout: { alignItems: 'center', gap: 4 },
  timerNotice: { color: Colors.light.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.light.border },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 42, alignSelf: 'center', backgroundColor: Colors.light.border },
  phoneStatus: { minHeight: 32, flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.glassBorder, backgroundColor: Colors.light.glassSurface },
  savedScore: { color: Colors.light.textSecondary, fontSize: 12, fontWeight: '600' },
  cardContent: { gap: 12 },
  orientation: { color: Colors.light.textSecondary, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  safeText: { color: Colors.light.success },
  warningText: { color: Colors.light.warning },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4 },
  metricValue: { color: Colors.light.text, fontSize: 28, lineHeight: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricLabel: { color: Colors.light.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  warningBox: { gap: 7, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: Colors.light.roomLeaveBorder, backgroundColor: Colors.light.roomLeaveSurface },
  warningHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warningTitle: { color: Colors.light.error, fontSize: 14, lineHeight: 20, fontWeight: '800', flex: 1 },
  warningDescription: { color: Colors.light.text, fontSize: 13, lineHeight: 19, paddingLeft: 27 },
  sectionTitle: { color: Colors.light.text, fontSize: 14, fontWeight: '800' },
  body: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  notice: { color: Colors.light.primary, fontSize: 13, fontWeight: '700' },
  syncMessage: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  error: { color: Colors.light.error, fontSize: 13 },
  leaderboard: { gap: 10 },
  rosterHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rosterPanel: { backgroundColor: Colors.light.groupHomeSessionSurface, borderRadius: 22, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.light.groupHomeSessionBorder },
  rosterCaption: { color: Colors.light.textSecondary, fontSize: 12, lineHeight: 17, flexShrink: 1 },
  rosterFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.light.border },
  ruleText: { color: Colors.light.textSecondary, fontSize: 12, fontWeight: '500' },
  emptyRoster: { color: Colors.light.textSecondary, fontSize: 14, paddingVertical: 20 },
  exitCard: { padding: 16, gap: 9 },
  controlsCard: { padding: 16 },
  controlsContent: { gap: 9 },
  controlSubheading: { color: Colors.light.text, fontSize: 13, fontWeight: '700' },
  voteSummary: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  voteCountdown: { color: Colors.light.textSecondary, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  voteCount: { color: Colors.light.textSecondary, fontSize: 13, fontWeight: '600' },
  voteResult: { color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  expiredVoteRow: { minHeight: 32, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ballotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  ballotBadge: { overflow: 'hidden', borderRadius: 9, backgroundColor: Colors.light.backgroundElement, color: Colors.light.textSecondary, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '700' },
  controlDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.light.border, marginTop: 2 },
  controlCopy: { gap: 3 },
  exitRequests: { gap: 8 },
  requestCard: { padding: 14, gap: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  rowAction: { flex: 1 },
  actionButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.light.primary },
  endButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'transparent' },
  endActionText: { color: Colors.light.error, fontWeight: '700', flexShrink: 1, textAlign: 'left' },
  voteStartButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.light.backgroundSelected },
  voteStartText: { color: Colors.light.primary, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  secondaryButton: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  actionText: { color: Colors.light.onPrimary, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
  secondaryActionText: { color: Colors.light.text, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  memberRow: { minHeight: 76, alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 12 },
  memberDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.light.border },
  avatarRankWrap: { position: 'relative', padding: 2, borderRadius: 23, borderWidth: 1, borderColor: Colors.light.border },
  winnerAvatarWrap: { borderColor: Colors.light.success, backgroundColor: Colors.light.successSurface },
  avatar: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', backgroundColor: Colors.light.roomMemberAvatar, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { color: Colors.light.roomMemberAccent, fontSize: 13, fontWeight: '800' },
  memberNameRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  youBadge: { color: Colors.light.primary, backgroundColor: Colors.light.backgroundSelected, fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  rankBadge: { position: 'absolute', left: -5, bottom: -3, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, overflow: 'hidden', backgroundColor: Colors.light.backgroundSelected, color: Colors.light.primary, fontSize: 10, lineHeight: 17, fontWeight: '900', textAlign: 'center' },
  winnerRankBadge: { backgroundColor: Colors.light.successSurface, color: Colors.light.success },
  memberDetails: { flex: 1, minWidth: 0, gap: 3 },
  name: { color: Colors.light.text, fontSize: 14, fontWeight: '800' },
  memberLiftLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  pendingMemberBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, backgroundColor: Colors.light.warningSurface },
  pendingMemberText: { color: Colors.light.warning, fontSize: 10, fontWeight: '700' },
  score: { color: Colors.light.text, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },
  winnerScore: { color: Colors.light.success },
});
