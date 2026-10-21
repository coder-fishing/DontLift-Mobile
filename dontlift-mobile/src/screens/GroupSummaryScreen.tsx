import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
  errorMessage?: string;
  onSyncAndAcknowledge: () => void;
  onReturnToGroupHome: () => void;
};

export function GroupSummaryScreen({ snapshot, actorUid, isOnline, isSyncing, errorMessage,
  onSyncAndAcknowledge, onReturnToGroupHome }: Props) {
  const ownMember = snapshot.members.find(member => member.uid === actorUid);
  const acknowledged = ownMember?.syncAcknowledgedAtUtcMs != null;
  const pendingMembers = snapshot.members.filter(member => member.syncAcknowledgedAtUtcMs == null);
  const isHost = ownMember?.role === 'HOST';
  const finalized = snapshot.reconciliationStatus === 'FINALIZED';

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
          <Text style={styles.count}>{finalized ? 'ALL SYNCED' : `${snapshot.pendingMemberCount ?? pendingMembers.length} pending`}</Text>
          <Text style={styles.body}>{finalized ? 'Scores are locked for this room.' : 'Bill settlement stays locked until every member confirms.'}</Text>
        </View>
      </GlassCard>

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

      {isHost && !finalized ? (
        <GlassCard style={styles.rosterCard}>
          <Text style={styles.sectionTitle}>Waiting for members</Text>
          {pendingMembers.length === 0 ? (
            <Text style={styles.body}>All member acknowledgments are arriving. The summary will update automatically.</Text>
          ) : pendingMembers.map(member => (
            <View key={member.uid} style={styles.pendingRow}>
              <View style={styles.pendingDot} />
              <Text style={styles.name}>{member.displayName || 'Participant'}</Text>
              {member.uid === actorUid ? <Text style={styles.body}>You</Text> : null}
            </View>
          ))}
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
      {finalized ? <Text style={styles.finalNote}>The room scores are final. Bill settlement is handled in a later slice.</Text> : null}
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
