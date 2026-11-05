import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatTime } from '../constants';
import { Colors } from '../constants/theme';
import type { GroupHistoryEntry } from '../features/history/group-history-model';
import type { GroupRoomRosterPreview } from '../features/history/group-history-repository';
import { PrimaryButton } from './PrimaryButton';

export type RecentSessionsState = 'loading' | 'ready' | 'offline' | 'cloud-error' | 'error';

type Props = {
  isCreating: boolean;
  errorMessage?: string;
  recentSessions: GroupHistoryEntry[];
  recentMemberPreviews?: Record<string, GroupRoomRosterPreview | null>;
  recentSessionsState: RecentSessionsState;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onCancelCreate: () => void;
  onOpenHistory?: () => void;
  onOpenRecentSession?: (roomId: string) => void;
  onRetryRecentSessions?: () => void;
};

const statusLabels: Record<GroupHistoryEntry['summary']['status'], string> = {
  COMPLETED: 'Completed',
  EARLY_EXIT: 'Ended early',
  CANCELLED: 'Cancelled',
  ABORTED: 'Interrupted',
};
const RECENT_AVATAR_SLOT_WIDTH = 32 + 3 * (32 - 9);

export function GroupHomeDashboard({ isCreating, errorMessage, recentSessions, recentSessionsState,
  recentMemberPreviews = {}, onCreateRoom, onJoinRoom, onCancelCreate, onOpenHistory, onOpenRecentSession, onRetryRecentSessions }: Props) {
  const sessions = recentSessions.slice(0, 2);
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...Colors.light.groupHomeHeroGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroIcon}>
          <Ionicons name="people" size={21} color={Colors.light.primary} />
        </View>
        <Text style={styles.heroTitle}>Focus together</Text>
        <Text style={styles.heroBody}>Create a room and invite friends with a PIN or QR code.</Text>
        {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
        {isCreating ? (
          <View style={styles.createLoading}>
            <ActivityIndicator accessibilityLabel="Creating room" color={Colors.light.primary} />
            <Text style={styles.heroBody}>Creating your room…</Text>
            <PrimaryButton title="Cancel and Join a Room" variant="secondary" onPress={onCancelCreate} />
          </View>
        ) : (
          <View style={styles.actions}>
            <PrimaryButton title="Create Room" style={styles.inlineAction} onPress={onCreateRoom} />
            <PrimaryButton
              title="Join with PIN"
              variant="secondary"
              style={[styles.inlineAction, styles.joinButton]}
              onPress={onJoinRoom}
            />
          </View>
        )}
      </LinearGradient>

      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Recent Sessions</Text>
          {onOpenHistory ? <Pressable
            accessibilityRole="button"
            accessibilityLabel="View group history"
            onPress={onOpenHistory}
            style={({ pressed }) => [styles.historyButton, pressed ? styles.pressed : null]}
          >
            <Text numberOfLines={1} style={styles.historyText}>History  ›</Text>
          </Pressable> : null}
        </View>

        {recentSessionsState === 'loading' && sessions.length === 0 ? (
          <View accessibilityLabel="Loading recent sessions" style={styles.loadingState}>
            <ActivityIndicator color={Colors.light.primary} />
            <Text style={styles.secondary}>Loading recent sessions…</Text>
          </View>
        ) : null}

        {recentSessionsState === 'offline' ? <Text style={styles.notice}>Offline · showing saved sessions</Text> : null}
        {recentSessionsState === 'cloud-error' ? <Text accessibilityRole="alert" style={styles.notice}>Could not refresh cloud history. Showing saved sessions.</Text> : null}
        {recentSessionsState === 'error' ? (
          <View style={styles.emptyState}>
            <Text accessibilityRole="alert" style={styles.secondary}>Could not load recent sessions.</Text>
            {onRetryRecentSessions ? <Pressable accessibilityRole="button" onPress={onRetryRecentSessions} style={styles.retryButton}>
              <Text style={styles.historyText}>Try again</Text>
            </Pressable> : null}
          </View>
        ) : null}

        {sessions.map(entry => <RecentSessionRow key={entry.summary.roomId} entry={entry}
          memberPreview={recentMemberPreviews[entry.summary.roomId]} onPress={onOpenRecentSession} />)}

        {recentSessionsState !== 'loading' && recentSessionsState !== 'error' && sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No group sessions yet</Text>
            <Text style={styles.secondary}>Completed sessions will appear here.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function RecentSessionRow({ entry, memberPreview, onPress }: {
  entry: GroupHistoryEntry; memberPreview?: GroupRoomRosterPreview | null; onPress?: (roomId: string) => void;
}) {
  const { summary } = entry;
  const completedAt = new Date(summary.completedAtUtcMs);
  const durationSeconds = Math.max(0, Math.floor((summary.completedAtUtcMs - summary.startedAtUtcMs) / 1000));
  const dateLabel = completedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeLabel = completedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const participants = memberPreview?.totalCount ?? 0;
  const accessibilityLabel = `${statusLabels[summary.status]} group session from ${dateLabel} at ${timeLabel}, ${formatTime(durationSeconds)} recorded, ${summary.liftCount} lifts, ${summary.penaltyScore} personal points${participants ? `, ${participants} participants` : ''}`;
  const content = (
    <View style={styles.sessionContent}>
      <View style={styles.sessionLeading}>
        {memberPreview?.members.length ? <MemberAvatarStack preview={memberPreview} /> : (
          <View style={styles.sessionIcon}><Ionicons name="time-outline" size={17} color={Colors.light.primary} /></View>
        )}
      </View>
      <View style={styles.sessionDetails}>
        <Text numberOfLines={1} style={styles.sessionDate}>{dateLabel} · {timeLabel}</Text>
        <Text numberOfLines={1} style={styles.secondary}>{formatTime(durationSeconds)} · {summary.liftCount} lifts · {statusLabels[summary.status]}</Text>
      </View>
      <View style={styles.sessionTrailing}>
        <View style={styles.sessionScore}>
          <Text style={styles.score}>{summary.penaltyScore}</Text>
          <Text style={styles.scoreUnit}>local pts</Text>
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={17} color={Colors.light.textSecondary} /> : null}
      </View>
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => onPress(summary.roomId)}
      style={({ pressed }) => [styles.sessionRow, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.sessionRow}>{content}</View>
  );
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || '?').toUpperCase();
}

function MemberAvatar({ displayName, avatarUri }: { displayName: string; avatarUri?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <View style={styles.memberAvatar}>
      {avatarUri && !imageFailed ? <Image source={{ uri: avatarUri }} contentFit="cover" style={styles.memberAvatarImage}
        onError={() => setImageFailed(true)} accessibilityLabel={`${displayName}'s avatar`} />
        : <Text numberOfLines={1} style={styles.memberAvatarInitials}>{getInitials(displayName)}</Text>}
    </View>
  );
}

function MemberAvatarStack({ preview }: { preview: GroupRoomRosterPreview }) {
  const visible = preview.members.slice(0, 3);
  const overflow = Math.max(0, preview.totalCount - visible.length);
  const size = 32;
  const overlap = 9;
  const itemCount = visible.length + (overflow > 0 ? 1 : 0);
  const width = itemCount ? size + (itemCount - 1) * (size - overlap) : 0;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.memberAvatarStack, { width }]}>
      {visible.map((member, index) => <View key={member.uid} style={[styles.memberAvatarSlot, index > 0 && styles.memberAvatarOverlap]}>
        <MemberAvatar displayName={member.displayName} avatarUri={member.avatarUri} />
      </View>)}
      {overflow > 0 ? <View style={[styles.memberOverflow, styles.memberAvatarOverlap]}>
        <Text numberOfLines={1} style={styles.memberOverflowText}>+{overflow}</Text>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 22 },
  heroCard: {
    alignItems: 'center', gap: 10, padding: 22, borderRadius: 24, overflow: 'hidden',
    borderColor: Colors.light.glassBorder, borderWidth: 1,
    shadowColor: Colors.light.glassShadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14, shadowRadius: 12, elevation: 2,
  },
  heroIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.roomInviteQrSurface },
  heroTitle: { color: Colors.light.text, fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: -0.45, textAlign: 'center' },
  heroBody: { color: Colors.light.roomSecondaryText, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  actions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 4 },
  inlineAction: { flex: 1, width: 0, paddingHorizontal: 8 },
  createLoading: { width: '100%', alignItems: 'center', gap: 12, marginTop: 6 },
  error: { color: Colors.light.error, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  joinButton: { backgroundColor: Colors.light.groupHomeSecondarySurface, borderColor: Colors.light.groupHomeSecondaryBorder, shadowOpacity: 0, elevation: 0 },
  recentSection: { gap: 10 },
  sectionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: Colors.light.text, fontSize: 17, fontWeight: '800' },
  historyButton: { minHeight: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  historyText: { color: Colors.light.primary, fontSize: 14, fontWeight: '700' },
  loadingState: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  notice: { color: Colors.light.roomSecondaryText, fontSize: 12, lineHeight: 17 },
  emptyState: { alignItems: 'center', gap: 5, paddingVertical: 18, paddingHorizontal: 16, borderRadius: 18, backgroundColor: Colors.light.glassSurface },
  emptyTitle: { color: Colors.light.text, fontSize: 15, fontWeight: '700' },
  secondary: { color: Colors.light.roomSecondaryText, fontSize: 12, lineHeight: 18 },
  retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  sessionRow: { width: '100%', minHeight: 72, justifyContent: 'center', padding: 10, borderRadius: 18, backgroundColor: Colors.light.groupHomeSessionSurface, borderWidth: 1, borderColor: Colors.light.groupHomeSessionBorder },
  sessionContent: { width: '100%', minWidth: 0, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 10 },
  sessionLeading: { width: RECENT_AVATAR_SLOT_WIDTH, flexShrink: 0, alignItems: 'flex-start', justifyContent: 'center' },
  sessionIcon: { width: 32, height: 32, flexShrink: 0, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.backgroundSelected },
  memberAvatarStack: { height: 36, flexDirection: 'row', flexShrink: 0, alignItems: 'center', overflow: 'visible' },
  memberAvatarSlot: { width: 32, height: 32, zIndex: 1 },
  memberAvatarOverlap: { marginLeft: -9 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: Colors.light.groupHomeSessionSurface, backgroundColor: Colors.light.roomMemberAvatar, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  memberAvatarImage: { width: '100%', height: '100%' },
  memberAvatarInitials: { color: Colors.light.roomMemberAccent, fontSize: 10, fontWeight: '800' },
  memberOverflow: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: Colors.light.groupHomeSessionSurface, backgroundColor: Colors.light.backgroundElement, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  memberOverflowText: { color: Colors.light.textSecondary, fontSize: 9, fontWeight: '800' },
  sessionDetails: { flex: 1, flexShrink: 1, minWidth: 0, gap: 4 },
  sessionDate: { color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  sessionTrailing: { flexDirection: 'row', flexShrink: 0, alignItems: 'center', gap: 6 },
  sessionScore: { minWidth: 42, alignItems: 'flex-end', justifyContent: 'center', gap: 1 },
  score: { color: Colors.light.primary, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreUnit: { color: Colors.light.roomSecondaryText, fontSize: 9, fontWeight: '700' },
  pressed: { opacity: 0.76 },
});
