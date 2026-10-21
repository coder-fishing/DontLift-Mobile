import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { Colors } from '../constants/theme';
import { formatTime } from '../constants';
import { rankGroupMembers } from '../features/rooms/group-active-domain';
import type { RoomLobbySnapshot } from '../features/rooms/room-listener';

type Props = {
  snapshot: RoomLobbySnapshot;
  actorUid: string;
  isOnline: boolean;
  isSyncing: boolean;
  isFinalizingOverride: boolean;
  errorMessage?: string;
  overrideErrorMessage?: string;
  onSyncAndAcknowledge: () => void;
  onFinalizeWithOverride: (unsyncedMemberUids: string[]) => void;
  onReturnToGroupHome: () => void;
};

export function GroupSummaryScreen({ snapshot, actorUid, isOnline, isSyncing, errorMessage,
  isFinalizingOverride, overrideErrorMessage, onSyncAndAcknowledge, onFinalizeWithOverride,
  onReturnToGroupHome }: Props) {
  const ownMember = snapshot.members.find(member => member.uid === actorUid);
  const acknowledged = ownMember?.syncAcknowledgedAtUtcMs != null;
  const pendingMembers = snapshot.members.filter(member => member.syncAcknowledgedAtUtcMs == null);
  const pendingCount = snapshot.pendingMemberCount ?? pendingMembers.length;
  const rosterMatchesPendingCount = pendingMembers.length === pendingCount;
  const isHost = ownMember?.role === 'HOST';
  const finalized = snapshot.reconciliationStatus === 'FINALIZED';
  const hostOverrideFinalized = finalized && snapshot.finalizationReason === 'HOST_OVERRIDE';
  const requestHostOverride = () => Alert.alert(
    'Finalize without waiting?',
    'Some Members have not synced. Late violations will not affect payment.',
    [
      { text: 'Keep waiting', style: 'cancel' },
      { text: 'Finalize scores', style: 'destructive', onPress: () => onFinalizeWithOverride(pendingMembers.map(member => member.uid)) },
    ],
  );

  // Các panel dùng GlassCard của concept đã duyệt để tách trạng thái server, hành động sync và bảng điểm.
  return (
    <View style={styles.container}>
      <GlassCard style={styles.summaryCard}>
        <Text style={styles.eyebrow}>GROUP SESSION COMPLETE</Text>
        <Text style={styles.title}>{finalized ? 'Final scores are ready' : 'Sync the final session data'}</Text>
        {snapshot.endedAtUtcMs != null ? (
          <Text style={styles.body}>Ended {new Date(snapshot.endedAtUtcMs).toLocaleString()}</Text>
        ) : (
          <Text style={styles.body}>Confirming the room end time with Firebase…</Text>
        )}
        <View accessibilityRole="summary" style={styles.countRow}>
          <Text style={styles.count}>{finalized
            ? hostOverrideFinalized ? `${snapshot.pendingMemberCount ?? pendingMembers.length} not synced` : 'ALL SYNCED'
            : `${snapshot.pendingMemberCount ?? pendingMembers.length} pending`}</Text>
          <Text style={styles.body}>{finalized
            ? hostOverrideFinalized ? 'The Host finalized scores. Late lifts will not affect payment.' : 'Scores are locked for this room.'
            : 'Bill settlement stays locked until every member confirms or the Host finalizes.'}</Text>
        </View>
      </GlassCard>

      {hostOverrideFinalized ? (
        <GlassCard style={styles.rosterCard}>
          <Text style={styles.sectionTitle}>Members not synced at finalization</Text>
          <Text style={styles.body}>This list reflects the room roster the Host saw when confirming.</Text>
          {pendingMembers.map(member => (
            <View key={member.uid} style={styles.pendingRow}>
              <View style={styles.pendingDot} />
              <Text style={styles.name}>{member.displayName || 'Participant'}</Text>
              {member.uid === actorUid ? <Text style={styles.body}>You</Text> : null}
            </View>
          ))}
        </GlassCard>
      ) : null}

      {!finalized && ownMember ? (
        <GlassCard style={styles.syncCard}>
          <Text style={styles.sectionTitle}>{acknowledged ? 'Your data is synced' : 'Your final sync'}</Text>
          <Text style={styles.body}>
            {acknowledged
              ? `Waiting for ${snapshot.pendingMemberCount ?? pendingMembers.length} ${isHost ? 'member(s)' : 'participant(s)'} to finish.`
              : 'We will send saved eligible lifts before confirming your score.'}
          </Text>
          {!acknowledged ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sync saved session data and confirm"
              disabled={!isOnline || isSyncing || snapshot.status !== 'COMPLETED'}
              onPress={onSyncAndAcknowledge}
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed,
                (!isOnline || isSyncing || snapshot.status !== 'COMPLETED') && styles.disabled]}
            >
              {isSyncing ? <ActivityIndicator accessibilityLabel="Syncing session data" color={Colors.light.onPrimary} /> : null}
              <Text style={styles.actionText}>{isSyncing ? 'Syncing…' : 'Sync and confirm'}</Text>
            </Pressable>
          ) : null}
          {!isOnline ? <Text style={styles.body}>Connect to the internet to sync and confirm.</Text> : null}
          {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
        </GlassCard>
      ) : null}

      {isHost && !finalized && pendingCount > 0 ? (
        <GlassCard style={styles.rosterCard}>
          <Text style={styles.sectionTitle}>Waiting for sync</Text>
          {pendingMembers.length === 0 ? (
            <Text style={styles.body}>Refreshing the pending roster. The summary will update automatically.</Text>
          ) : pendingMembers.map(member => (
            <View key={member.uid} style={styles.pendingRow}>
              <View style={styles.pendingDot} />
              <Text style={styles.name}>{member.displayName || 'Participant'}</Text>
              {member.uid === actorUid ? <Text style={styles.body}>You</Text> : null}
            </View>
          ))}
          {rosterMatchesPendingCount ? (
            <>
              <Text style={styles.body}>Finalizing now freezes scores. Late lifts from these members will stay in history and will not affect payment.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Finalize scores without waiting for pending members"
                accessibilityState={{ disabled: !isOnline || isFinalizingOverride }}
                disabled={!isOnline || isFinalizingOverride}
                onPress={requestHostOverride}
                style={({ pressed }) => [styles.overrideButton, pressed && styles.pressed,
                  (!isOnline || isFinalizingOverride) && styles.disabled]}
              >
                {isFinalizingOverride ? <ActivityIndicator accessibilityLabel="Finalizing room scores" color={Colors.light.onPrimary} /> : null}
                <Text style={styles.actionText}>{isFinalizingOverride ? 'Finalizing…' : 'Finalize anyway'}</Text>
              </Pressable>
              {!isOnline ? <Text style={styles.body}>Connect to the internet to finalize scores.</Text> : null}
              {overrideErrorMessage ? <Text accessibilityRole="alert" style={styles.error}>{overrideErrorMessage}</Text> : null}
            </>
          ) : <Text style={styles.body}>The pending count and member list are updating. Wait for the room snapshot before finalizing.</Text>}
        </GlassCard>
      ) : null}

      <View style={styles.scoreList}>
        <Text style={styles.sectionTitle}>{finalized ? 'Final leaderboard' : 'Current synced scores'}</Text>
        {rankGroupMembers(snapshot.members).map((member, index) => (
          <GlassCard key={member.uid} style={styles.scoreRow}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.scoreDetails}>
              <Text style={styles.name}>{member.displayName || 'Participant'}{member.uid === actorUid ? ' · You' : ''}</Text>
              <Text style={styles.body}>{member.liftCount} lifts · {formatTime(member.violationDurationSeconds)}</Text>
            </View>
            <Text style={styles.score}>{member.penaltyScore} pts</Text>
          </GlassCard>
        ))}
      </View>
      {finalized ? <Text style={styles.finalNote}>{hostOverrideFinalized
        ? 'The Host finalized the scores before every member synced. Late eligible lifts stay in history and do not change these scores or payment.'
        : 'The room scores are final. Bill settlement is handled in a later slice.'}</Text> : null}
      {finalized ? (
        <Pressable accessibilityRole="button" onPress={onReturnToGroupHome} style={({ pressed }) => [styles.homeButton, pressed && styles.pressed]}>
          <Text style={styles.homeButtonText}>Return to group home</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 24 },
  summaryCard: { gap: 10, padding: 20 },
  eyebrow: { color: Colors.light.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: Colors.light.text, fontSize: 24, fontWeight: '900' },
  sectionTitle: { color: Colors.light.text, fontSize: 15, fontWeight: '800' },
  body: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  countRow: { gap: 4, borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 12 },
  count: { color: Colors.light.primary, fontSize: 17, fontWeight: '900' },
  syncCard: { gap: 10 },
  rosterCard: { gap: 10 },
  pendingRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.light.textSecondary },
  name: { flex: 1, color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  actionButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.light.primary },
  overrideButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.error, backgroundColor: Colors.light.error },
  actionText: { color: Colors.light.onPrimary, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  error: { color: Colors.light.error, fontSize: 13 },
  scoreList: { gap: 8 },
  scoreRow: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 12 },
  rank: { width: 24, color: Colors.light.primary, textAlign: 'center', fontSize: 16, fontWeight: '900' },
  scoreDetails: { flex: 1, gap: 3 },
  score: { color: Colors.light.text, fontSize: 14, fontWeight: '900' },
  finalNote: { paddingHorizontal: 4, color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  homeButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  homeButtonText: { color: Colors.light.text, fontWeight: '800' },
});
