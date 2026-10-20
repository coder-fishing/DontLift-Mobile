import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { Colors } from '../constants/theme';
import { formatTime } from '../constants';
import { rankGroupMembers } from '../features/rooms/group-active-domain';
import type { RoomLobbySnapshot } from '../features/rooms/room-listener';
import type { ForegroundDetectionViewState } from '../features/solo/foreground-detection-controller';
import type { EarlyExitDecision, EarlyExitRequest } from '../features/rooms/early-exit-repository';

type Props = {
  snapshot: RoomLobbySnapshot;
  elapsedSeconds: number;
  detection: ForegroundDetectionViewState;
  isOnline: boolean;
  syncMessage?: string;
  actorUid: string;
  openEarlyExitRequests: EarlyExitRequest[];
  isRequestingEarlyExit: boolean;
  decidingEarlyExit: { requestId: string; decision: EarlyExitDecision } | null;
  earlyExitError?: string;
  onRequestEarlyExit: () => void;
  onDecideEarlyExit: (request: EarlyExitRequest, decision: EarlyExitDecision) => void;
};

export function GroupActiveScreen({ snapshot, elapsedSeconds, detection, isOnline, syncMessage, actorUid,
  openEarlyExitRequests, isRequestingEarlyExit, decidingEarlyExit, earlyExitError,
  onRequestEarlyExit, onDecideEarlyExit }: Props) {
  const members = rankGroupMembers(snapshot.members);
  const ownMember = snapshot.members.find(member => member.uid === actorUid);
  const isHost = ownMember?.role === 'HOST';
  const ownRequest = openEarlyExitRequests.find(request => request.memberUid === actorUid);
  const confirmEarlyExitRequest = () => Alert.alert(
    'Request early exit?',
    'Your score will freeze at current time.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Request', onPress: onRequestEarlyExit },
    ],
  );
  return (
    <View style={styles.container}>
      <GlassCard style={styles.timerCard}>
        <Text style={styles.eyebrow}>GROUP SESSION • {snapshot.status}</Text>
        <Text accessibilityLabel="Elapsed group session time" style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
        <Text style={styles.body}>{isOnline ? 'Connected to the live room' : 'Offline · violations are saved on this device'}</Text>
      </GlassCard>

      {ownMember?.status === 'EARLY_EXIT' ? (
        <GlassCard style={styles.captureCard}>
          <Text style={styles.sectionTitle}>Your saved room score</Text>
          <Text style={styles.body}>Confirmed lifts: {ownMember.liftCount}</Text>
          <Text style={styles.body}>Violation time: {formatTime(ownMember.violationDurationSeconds)}</Text>
          <Text style={styles.body}>Penalty score: {ownMember.penaltyScore} pts</Text>
          {syncMessage ? <Text style={styles.notice}>{syncMessage}</Text> : null}
        </GlassCard>
      ) : (
        <GlassCard style={styles.captureCard}>
          <Text style={styles.sectionTitle}>Your phone</Text>
          <Text style={styles.body}>Position: {detection.orientation.replace('_', ' ').toLowerCase()}</Text>
          <Text style={styles.body}>Confirmed lifts: {detection.violationsCount}</Text>
          <Text style={styles.body}>Violation time: {formatTime(detection.violationDurationSeconds)}</Text>
          {detection.isGraceActive && <Text style={styles.notice}>Grace period · {detection.graceSeconds}s</Text>}
          {detection.persistenceError && <Text accessibilityRole="alert" style={styles.error}>{detection.persistenceError}</Text>}
          {syncMessage && <Text style={styles.notice}>{syncMessage}</Text>}
        </GlassCard>
      )}

      {ownMember?.status === 'EARLY_EXIT' ? (
        <GlassCard style={styles.exitCard}>
          <Text style={styles.sectionTitle}>You left the active session</Text>
          <Text style={styles.body}>Your confirmed activity through the approved cutoff can still sync before the room is finalized.</Text>
        </GlassCard>
      ) : null}

      {!isHost && ownMember?.role === 'MEMBER' && ownMember.status === 'ACTIVE' ? (
        <GlassCard style={styles.exitCard}>
          <Text style={styles.sectionTitle}>Leave the group session early?</Text>
          <Text style={styles.body}>The Host must approve. Your membership and score history stay in the room.</Text>
          {earlyExitError ? <Text accessibilityRole="alert" style={styles.error}>{earlyExitError}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Request early exit"
            disabled={isRequestingEarlyExit || Boolean(ownRequest) || !isOnline}
            onPress={confirmEarlyExitRequest}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed, (isRequestingEarlyExit || Boolean(ownRequest) || !isOnline) && styles.disabled]}
          >
            {isRequestingEarlyExit ? <ActivityIndicator color={Colors.light.onPrimary} /> : null}
            <Text style={styles.actionText}>{ownRequest ? 'Request sent · waiting for Host' : 'Request early exit'}</Text>
          </Pressable>
          {!isOnline ? <Text style={styles.body}>Connect to the internet to send this request.</Text> : null}
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
                <Text style={styles.name}>{member?.displayName || 'Participant'} wants to leave early</Text>
                <View style={styles.actionRow}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Approve early exit request" disabled={busy || !isOnline}
                    onPress={() => onDecideEarlyExit(request, 'APPROVE')}
                    style={({ pressed }) => [styles.actionButton, pressed && styles.pressed, (busy || !isOnline) && styles.disabled]}>
                    {isCurrentRequest && decidingEarlyExit?.decision === 'APPROVE'
                      ? <ActivityIndicator accessibilityLabel="Processing approval" color={Colors.light.onPrimary} /> : null}
                    <Text style={styles.actionText}>Approve</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Deny early exit request" disabled={busy || !isOnline}
                    onPress={() => onDecideEarlyExit(request, 'DENY')}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, (busy || !isOnline) && styles.disabled]}>
                    {isCurrentRequest && decidingEarlyExit?.decision === 'DENY'
                      ? <ActivityIndicator accessibilityLabel="Processing denial" color={Colors.light.primary} /> : null}
                    <Text style={styles.secondaryActionText}>Deny</Text>
                  </Pressable>
                </View>
              </GlassCard>
            );
          })}
          {earlyExitError ? <Text accessibilityRole="alert" style={styles.error}>{earlyExitError}</Text> : null}
        </View>
      ) : null}

      <View style={styles.leaderboard}>
        <Text style={styles.sectionTitle}>Penalty leaderboard · lowest score wins</Text>
        {members.length === 0 ? <Text style={styles.body}>Waiting for the live member list…</Text> : members.map((member, index) => (
          <GlassCard key={member.uid} style={styles.memberRow}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.memberDetails}>
              <Text style={styles.name}>{member.displayName || 'Participant'}</Text>
              <Text style={styles.body}>{member.liftCount} confirmed lifts</Text>
            </View>
            <Text style={styles.score}>{member.penaltyScore} pts</Text>
          </GlassCard>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 24 },
  timerCard: { alignItems: 'center', padding: 20, gap: 8 },
  eyebrow: { color: Colors.light.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  timer: { color: Colors.light.text, fontSize: 42, fontWeight: '900', fontVariant: ['tabular-nums'] },
  captureCard: { padding: 16, gap: 7 },
  sectionTitle: { color: Colors.light.text, fontSize: 14, fontWeight: '800' },
  body: { color: Colors.light.textSecondary, fontSize: 13 },
  notice: { color: Colors.light.primary, fontSize: 13, fontWeight: '700' },
  error: { color: Colors.light.error, fontSize: 13 },
  leaderboard: { gap: 8 },
  exitCard: { padding: 16, gap: 9 },
  exitRequests: { gap: 8 },
  requestCard: { padding: 14, gap: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.light.primary },
  secondaryButton: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  actionText: { color: Colors.light.onPrimary, fontWeight: '800' },
  secondaryActionText: { color: Colors.light.text, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  memberRow: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 12 },
  rank: { color: Colors.light.primary, fontSize: 16, fontWeight: '900', width: 24, textAlign: 'center' },
  memberDetails: { flex: 1, gap: 3 },
  name: { color: Colors.light.text, fontSize: 14, fontWeight: '800' },
  score: { color: Colors.light.text, fontSize: 14, fontWeight: '900' },
});
