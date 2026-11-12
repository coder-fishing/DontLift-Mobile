import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { GlassCard } from '../components/GlassCard';
import { Colors } from '../constants/theme';
import { formatTime } from '../constants';
import { rankGroupMembers } from '../features/rooms/group-active-domain';
import type { RoomLobbyMember, RoomLobbySnapshot } from '../features/rooms/room-listener';
import type { PublishedBillState } from '../features/settlement/published-bill-listener';

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
  onOpenSettlementDetails: () => void;
  onOpenGroupHistory: () => void;
  billState: PublishedBillState;
  onOpenBillAllocation: () => void;
  onReturnToGroupHome: () => void;
};

function getMemberInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return `${Array.from(words[0])[0]}${Array.from(words[words.length - 1])[0]}`.toUpperCase();
  }
  return Array.from(words[0] || '?').slice(0, 2).join('').toUpperCase();
}

function MemberAvatar({ member }: { member: RoomLobbyMember }) {
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  const avatarBackground = member.role === 'HOST' ? Colors.light.roomHostAvatar : Colors.light.roomMemberAvatar;
  const avatarAccent = member.role === 'HOST' ? Colors.light.roomHostAccent : Colors.light.roomMemberAccent;
  return (
    <View style={[styles.avatar, { backgroundColor: avatarBackground }]}>
      {member.avatarUri && failedImageUri !== member.avatarUri ? (
        <Image
          source={{ uri: member.avatarUri }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={member.avatarUri}
          transition={0}
          style={styles.avatarImage}
          onError={() => setFailedImageUri(member.avatarUri ?? null)}
          accessibilityLabel={`${member.displayName || 'Participant'} avatar`}
        />
      ) : (
        <Text style={[styles.avatarInitials, { color: avatarAccent }]}>{getMemberInitials(member.displayName)}</Text>
      )}
    </View>
  );
}

function MemberSyncStatus({ acknowledged, finalizedByOverride }: { acknowledged: boolean; finalizedByOverride: boolean }) {
  const label = acknowledged ? 'Synced' : finalizedByOverride ? 'Not synced at finalization' : 'Waiting to sync';
  const color = acknowledged ? Colors.light.success : Colors.light.warning;
  const icon = acknowledged ? 'checkmark-circle-outline' : finalizedByOverride ? 'alert-circle-outline' : 'time-outline';
  return (
    <View style={styles.syncStatus}>
      <Ionicons name={icon} size={15} color={color} accessibilityElementsHidden />
      <Text style={[styles.syncStatusText, { color }]}>{label}</Text>
    </View>
  );
}

export function GroupSummaryScreen({ snapshot, actorUid, isOnline, isSyncing, errorMessage,
  isFinalizingOverride, overrideErrorMessage, onSyncAndAcknowledge, onFinalizeWithOverride,
  onOpenSettlementDetails, onOpenGroupHistory, billState, onOpenBillAllocation, onReturnToGroupHome }: Props) {
  const ownMember = snapshot.members.find(member => member.uid === actorUid);
  const isHost = ownMember?.role === 'HOST';
  const finalized = snapshot.reconciliationStatus === 'FINALIZED';
  const hostOverrideFinalized = finalized && snapshot.finalizationReason === 'HOST_OVERRIDE';
  const eligibleMembers = snapshot.members.filter(member => ['ACTIVE', 'EARLY_EXIT'].includes(member.status));
  const pendingMembers = eligibleMembers.filter(member => member.syncAcknowledgedAtUtcMs == null);
  const pendingCountValue = snapshot.pendingMemberCount;
  const authoritativePendingCount = typeof pendingCountValue === 'number' && Number.isInteger(pendingCountValue)
    ? pendingCountValue : null;
  const hasAuthoritativePendingCount = authoritativePendingCount !== null;
  const pendingRosterMatchesCount = hasAuthoritativePendingCount && pendingMembers.length === authoritativePendingCount;
  // Early-exit members remain eligible to submit their events and acknowledge through the room-end cutoff.
  const memberByUid = new Map(snapshot.members.map(member => [member.uid, member]));
  const rankedMembers = rankGroupMembers(eligibleMembers, ['ACTIVE', 'EARLY_EXIT'])
    .map(member => memberByUid.get(member.uid))
    .filter((member): member is RoomLobbyMember => member !== undefined);
  const showHostControls = isHost && !finalized && (
    authoritativePendingCount == null || authoritativePendingCount > 0 || !pendingRosterMatchesCount
  );

  const requestHostOverride = () => Alert.alert(
    'Finalize without waiting?',
    'Some Members have not synced. Late violations will not affect payment.',
    [
      { text: 'Keep waiting', style: 'cancel' },
      { text: 'Finalize scores', style: 'destructive', onPress: () => onFinalizeWithOverride(pendingMembers.map(member => member.uid)) },
    ],
  );

  const summaryCount = finalized
    ? hostOverrideFinalized
      ? hasAuthoritativePendingCount ? `${authoritativePendingCount} not synced at finalization` : 'Host finalized early'
      : 'ALL MEMBERS SYNCED'
    : hasAuthoritativePendingCount
      ? `${authoritativePendingCount} ${authoritativePendingCount === 1 ? 'member' : 'members'} pending`
      : 'Checking member sync status';
  const summaryBody = finalized
    ? hostOverrideFinalized
      ? 'The Host finalized before every member synced. Late eligible lifts do not change the final scores or payment.'
      : 'Every member synced. Scores are locked for this room.'
    : hasAuthoritativePendingCount
      ? 'Bill settlement stays locked until every member syncs or the Host confirms an early finalization.'
      : 'Bill settlement stays locked while the room sync status is being confirmed.';

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.eyebrow}>GROUP SESSION COMPLETE</Text>
        <Text style={styles.title}>{finalized ? 'Final scores are ready' : 'Confirm your final session data'}</Text>
        {snapshot.endedAtUtcMs != null ? (
          <Text style={styles.body}>Ended {new Date(snapshot.endedAtUtcMs).toLocaleString()}</Text>
        ) : (
          <Text style={styles.body}>Confirming the room end time…</Text>
        )}
        <View accessibilityRole="summary" style={styles.summaryStatus}>
          <View style={[styles.summaryDot, finalized && !hostOverrideFinalized ? styles.summaryDotSuccess : null]} />
          <View style={styles.summaryStatusCopy}>
            <Text style={[styles.count, hostOverrideFinalized ? styles.countWarning : null]}>{summaryCount}</Text>
            <Text style={styles.body}>{summaryBody}</Text>
          </View>
        </View>
      </View>

      <View style={styles.leaderboardCard}>
        <View style={styles.leaderboardHeader}>
          <Text style={styles.sectionTitle}>{finalized ? 'Final scores' : 'Member sync'} · {rankedMembers.length}</Text>
          <Text style={styles.rankingHint}>Lowest score wins</Text>
        </View>
        {rankedMembers.length === 0 ? (
          <Text style={styles.body}>No member results are available in this room snapshot.</Text>
        ) : rankedMembers.map((member, index) => {
          const isOwnMember = member.uid === actorUid;
          const acknowledged = member.syncAcknowledgedAtUtcMs != null;
          const showOwnSyncAction = isOwnMember && !acknowledged && !finalized;
          return (
            <View key={member.uid} testID={`leaderboard-row-${member.uid}`} style={[styles.memberRowContainer, index > 0 && styles.memberRowDivider]}>
              <View style={styles.memberRow}>
                <View style={styles.identityColumn}>
                  <View style={styles.avatarRankWrap}>
                  <MemberAvatar member={member} />
                    <View testID={`rank-badge-${member.uid}`} style={[styles.rankBadge, index === 0 && styles.topRankBadge]}>
                      <Text style={[styles.rankBadgeText, index === 0 && styles.topRankBadgeText]}>{index + 1}</Text>
                    </View>
                  </View>
                  <View testID={`member-details-${member.uid}`} style={styles.memberDetails}>
                    <View style={styles.nameLine}>
                      <Text style={styles.name}>{member.displayName || 'Participant'}</Text>
                      {isOwnMember ? <Text style={styles.youBadge}>You</Text> : null}
                    </View>
                    <Text style={styles.memberMeta}>{member.liftCount} lifts · {formatTime(member.violationDurationSeconds)}</Text>
                    {!showOwnSyncAction ? <MemberSyncStatus acknowledged={acknowledged} finalizedByOverride={hostOverrideFinalized} /> : null}
                  </View>
                </View>
                <Text style={[styles.score, index === 0 && styles.topScore]}>{member.penaltyScore} pts</Text>
              </View>
              {showOwnSyncAction ? (
                <View testID={`member-action-${member.uid}`} style={styles.memberActionArea}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sync saved session data and confirm"
                    accessibilityState={{ disabled: !isOnline || isSyncing || snapshot.status !== 'COMPLETED', busy: isSyncing }}
                    disabled={!isOnline || isSyncing || snapshot.status !== 'COMPLETED'}
                    onPress={onSyncAndAcknowledge}
                    style={[styles.syncButton, (!isOnline || isSyncing || snapshot.status !== 'COMPLETED') ? styles.disabled : null]}
                  >
                    {isSyncing ? <ActivityIndicator accessibilityLabel="Syncing session data" color={Colors.light.onPrimary} size="small" /> : <Ionicons name="cloud-upload-outline" size={16} color={Colors.light.onPrimary} />}
                    <Text style={styles.syncButtonText}>{isSyncing ? 'Syncing…' : 'Sync & confirm'}</Text>
                  </Pressable>
                  {!isOnline ? <Text style={styles.inlineHint}>Connect to the internet to sync and confirm.</Text> : null}
                </View>
              ) : null}
              {showOwnSyncAction && errorMessage ? (
                <View testID={`sync-error-panel-${member.uid}`} style={styles.errorPanel}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.light.error} accessibilityElementsHidden />
                  <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
        <View style={styles.leaderboardFooter}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.light.textSecondary} accessibilityElementsHidden />
          <Text style={styles.footerText}>{finalized ? 'Final scores are locked for this room.' : 'Scores update as members sync.'}</Text>
        </View>

      {hostOverrideFinalized ? (
        <View style={styles.hostActions}>
          <Text style={styles.sectionTitle}>Members not synced at finalization</Text>
          <Text style={styles.body}>This list reflects the room roster the Host saw when confirming.</Text>
          {pendingMembers.map(member => (
            <View key={member.uid} style={styles.pendingMember}>
              <View style={styles.pendingDot} />
              <Text style={styles.pendingName}>{member.displayName || 'Participant'}</Text>
              {member.uid === actorUid ? <Text style={styles.youBadge}>You</Text> : null}
            </View>
          ))}
          {pendingMembers.length === 0 ? <Text style={styles.body}>No unacknowledged members are present in the current roster snapshot.</Text> : null}
        </View>
      ) : null}

      {showHostControls ? (
        <View style={styles.hostActions}>
          <Text style={styles.sectionTitle}>Host actions</Text>
          {authoritativePendingCount == null ? (
            <Text style={styles.body}>Checking the room pending count. Finalization is unavailable until the room state is confirmed.</Text>
          ) : !pendingRosterMatchesCount ? (
            <Text style={styles.body}>The pending count and member list are updating. Wait for the latest room snapshot before finalizing.</Text>
          ) : (
            <>
              <Text style={styles.body}>Finalize current scores now. Members who have not synced may have eligible late lifts excluded from final scores and payment.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Finalize scores without waiting for pending members"
                accessibilityState={{ disabled: !isOnline || isFinalizingOverride, busy: isFinalizingOverride }}
                disabled={!isOnline || isFinalizingOverride}
                onPress={requestHostOverride}
                style={[styles.overrideButton, (!isOnline || isFinalizingOverride) ? styles.disabled : null]}
              >
                {isFinalizingOverride ? <ActivityIndicator accessibilityLabel="Finalizing room scores" color={Colors.light.error} size="small" /> : null}
                <Text style={styles.overrideButtonText}>{isFinalizingOverride ? 'Finalizing…' : 'Finalize anyway'}</Text>
              </Pressable>
              {!isOnline ? <Text style={styles.inlineHint}>Connect to the internet to finalize scores.</Text> : null}
              {overrideErrorMessage ? <Text accessibilityRole="alert" style={styles.error}>{overrideErrorMessage}</Text> : null}
            </>
          )}
        </View>
      ) : null}
      </View>

      {finalized ? <Text style={styles.finalNote}>{hostOverrideFinalized
        ? 'The Host finalized the scores before every member synced. Late eligible lifts stay in history and do not change these scores or payment.'
        : 'The room scores are final. The Host can now publish the room bill split.'}</Text> : null}
      {ownMember && snapshot.status === 'COMPLETED' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View this session in group history"
          onPress={onOpenGroupHistory}
          style={styles.historyButton}
        >
          <Text style={styles.historyButtonText}>View Group History</Text>
        </Pressable>
      ) : null}
      {finalized && !isHost ? (
        <GlassCard style={styles.billCard}>
          <Text style={styles.sectionTitle}>Room bill</Text>
          <Text style={styles.body}>{billState.kind === 'published' ? 'The Host published the final shares.'
            : billState.kind === 'cached' ? 'A saved copy is available; reconnect to confirm the current result.'
              : billState.kind === 'error' ? 'Could not check the room bill. Try again.'
                : billState.kind === 'loading' ? 'Checking whether the Host has published shares…'
                  : 'Waiting for the Host to publish shares.'}</Text>
          {billState.kind === 'published' || (billState.kind === 'cached' && billState.bill) || billState.kind === 'error' ? (
            <Pressable accessibilityRole="button" onPress={onOpenBillAllocation}
              style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>{billState.kind === 'error' ? 'Check bill status' : 'View bill breakdown'}</Text>
            </Pressable>
          ) : null}
        </GlassCard>
      ) : null}
      {finalized && ownMember ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isHost ? 'Enter or update payment details' : 'View Host payment details'}
          onPress={onOpenSettlementDetails}
          style={styles.settlementButton}
        >
          <Text style={styles.settlementButtonText}>{isHost ? 'Enter payment details' : 'View Host payment details'}</Text>
        </Pressable>
      ) : null}
      {finalized ? (
        <Pressable accessibilityRole="button" onPress={onReturnToGroupHome} style={styles.homeButton}>
          <Text style={styles.homeButtonText}>Return to group home</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 24 },
  summaryCard: { gap: 8, marginTop: 12, paddingHorizontal: 4, paddingVertical: 4 },
  eyebrow: { color: Colors.light.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: Colors.light.text, fontSize: 23, lineHeight: 28, fontWeight: '800' },
  body: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  summaryStatus: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 12 },
  summaryDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5, backgroundColor: Colors.light.warning },
  summaryDotSuccess: { backgroundColor: Colors.light.success },
  summaryStatusCopy: { flex: 1, gap: 3 },
  count: { color: Colors.light.text, fontSize: 16, fontWeight: '800' },
  countWarning: { color: Colors.light.warning },
  leaderboardCard: { gap: 0, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  leaderboardHeader: { minHeight: 42, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingBottom: 6 },
  sectionTitle: { color: Colors.light.text, fontSize: 16, fontWeight: '800' },
  rankingHint: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: '#F1F5F9', color: '#475569', fontSize: 12, fontWeight: '700' },
  memberRowContainer: { gap: 10, paddingVertical: 14 },
  memberRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.light.border },
  identityColumn: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarRankWrap: { width: 48, height: 48, position: 'relative', flexShrink: 0 },
  rankBadge: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: Colors.light.backgroundSelected, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rankBadgeText: { color: Colors.light.primary, fontSize: 10, lineHeight: 12, fontWeight: '800' },
  topRankBadge: { backgroundColor: Colors.light.successSurface },
  topRankBadgeText: { color: Colors.light.success },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: Colors.light.glassBorder, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 12, fontWeight: '800' },
  memberDetails: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 4 },
  nameLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, color: Colors.light.text, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  youBadge: { overflow: 'hidden', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: Colors.light.backgroundSelected, color: Colors.light.primary, fontSize: 10, lineHeight: 14, fontWeight: '800' },
  memberMeta: { color: Colors.light.textSecondary, fontSize: 12, lineHeight: 17 },
  syncStatus: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  syncStatusText: { flexShrink: 1, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  memberActionArea: { gap: 8, marginTop: 2, marginBottom: 2, marginLeft: 58 },
  syncButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 2, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#2563EB' },
  syncButtonText: { color: Colors.light.onPrimary, fontSize: 13, fontWeight: '800' },
  inlineHint: { color: Colors.light.textSecondary, fontSize: 12, lineHeight: 17 },
  errorPanel: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 2, borderRadius: 12, padding: 10, backgroundColor: '#FEF2F2' },
  score: { flexShrink: 0, maxWidth: 94, color: Colors.light.text, textAlign: 'right', fontSize: 14, lineHeight: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  topScore: { color: Colors.light.success },
  leaderboardFooter: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.light.border, marginTop: 14, paddingTop: 10 },
  footerText: { color: Colors.light.textSecondary, fontSize: 12, lineHeight: 17 },
  hostActions: { gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.light.border },
  pendingMember: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.light.warning },
  pendingName: { flex: 1, minWidth: 0, color: Colors.light.text, fontSize: 13, fontWeight: '700' },
  overrideButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: Colors.light.error, backgroundColor: '#FEF2F2' },
  overrideButtonText: { color: Colors.light.error, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  error: { color: Colors.light.error, fontSize: 12, lineHeight: 17 },
  finalNote: { paddingHorizontal: 4, color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  billCard: { gap: 10, padding: 16 },
  historyButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.glassSurface },
  historyButtonText: { color: Colors.light.primary, fontWeight: '800' },
  secondaryAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  secondaryActionText: { color: Colors.light.primary, fontWeight: '800' },
  settlementButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.light.primary },
  settlementButtonText: { color: Colors.light.onPrimary, fontWeight: '800' },
  homeButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  homeButtonText: { color: Colors.light.text, fontWeight: '800' },
});
