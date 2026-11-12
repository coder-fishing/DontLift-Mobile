import React from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { RoomInviteCard } from '../components/RoomInviteCard';
import { RoomRoster } from '../components/RoomRoster';
import { GroupHomeDashboard, type ActionableSessionsState, type RecentSessionsState } from '../components/GroupHomeDashboard';
import type { GroupHistoryEntry } from '../features/history/group-history-model';
import type { GroupActionableSession, GroupRoomRosterPreview } from '../features/history/group-history-repository';
import type { RoomLobbyState } from '../features/rooms/room-listener';

type LobbyRoom = { roomId: string; pin: string; invitation: string; hostUid: string; hostDisplayName?: string; createdAt: string | null; localCacheSaved: boolean };

interface GroupLobbyScreenProps {
  room: LobbyRoom | null;
  isCreating: boolean;
  errorMessage?: string;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onCancelCreate: () => void;
  lobbyState?: RoomLobbyState | null;
  isHost?: boolean;
  isStarting?: boolean;
  startError?: string;
  onStartRoom?: () => void;
  onOpenHistory?: () => void;
  onLeaveRoom?: () => void;
  isLeaving?: boolean;
  leaveError?: string;
  onRemoveMember?: (uid: string, displayName: string) => void;
  removingMemberUid?: string;
  removeError?: string;
  recentSessions?: GroupHistoryEntry[];
  recentMemberPreviews?: Record<string, GroupRoomRosterPreview | null>;
  recentSessionsState?: RecentSessionsState;
  onOpenRecentSession?: (roomId: string) => void;
  onRetryRecentSessions?: () => void;
  actionableSessions?: GroupActionableSession[];
  actionableSessionsState?: ActionableSessionsState;
  actionableErrorMessage?: string;
  actionableHasMore?: boolean;
  isLoadingMoreActionable?: boolean;
  onOpenActionableSession?: (item: GroupActionableSession) => void;
  onRetryActionableSessions?: () => void;
  onLoadMoreActionableSessions?: () => void;
}

export function GroupLobbyScreen({ room, isCreating, errorMessage, onCreateRoom, onJoinRoom, onCancelCreate, lobbyState, isHost, isStarting, startError, onStartRoom, onOpenHistory, onLeaveRoom, isLeaving, leaveError, onRemoveMember, removingMemberUid, removeError, recentSessions = [], recentMemberPreviews = {}, recentSessionsState = 'loading', onOpenRecentSession, onRetryRecentSessions, actionableSessions = [], actionableSessionsState = 'loading', actionableErrorMessage, actionableHasMore = false, isLoadingMoreActionable = false, onOpenActionableSession, onRetryActionableSessions, onLoadMoreActionableSessions }: GroupLobbyScreenProps) {
  const visibleLobbyState = lobbyState?.snapshot && lobbyState.snapshot.roomId !== room?.roomId ? null : lobbyState;
  const busy = Boolean(isLeaving || isStarting || removingMemberUid);
  const canLeaveRoom = Boolean(onLeaveRoom && visibleLobbyState?.kind === 'live' && visibleLobbyState.snapshot.status === 'WAITING');

  if (!room) {
    return (
      <GroupHomeDashboard
        isCreating={isCreating}
        errorMessage={errorMessage}
        recentSessions={recentSessions}
        recentMemberPreviews={recentMemberPreviews}
        recentSessionsState={recentSessionsState}
        actionableSessions={actionableSessions}
        actionableSessionsState={actionableSessionsState}
        actionableErrorMessage={actionableErrorMessage}
        actionableHasMore={actionableHasMore}
        isLoadingMoreActionable={isLoadingMoreActionable}
        onCreateRoom={onCreateRoom}
        onJoinRoom={onJoinRoom}
        onCancelCreate={onCancelCreate}
        onOpenHistory={onOpenHistory}
        onOpenRecentSession={onOpenRecentSession}
        onRetryRecentSessions={onRetryRecentSessions}
        onOpenActionableSession={onOpenActionableSession}
        onRetryActionableSessions={onRetryActionableSessions}
        onLoadMoreActionableSessions={onLoadMoreActionableSessions}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <Text style={styles.title}>Your room is ready</Text>
        <Text style={styles.body}>Share the PIN or QR code to invite friends.</Text>
      </View>

      <RoomInviteCard pin={room.pin} invitation={room.invitation} />

      {!visibleLobbyState || visibleLobbyState.kind === 'loading' ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={Colors.light.primary} />
          <Text style={styles.body}>Loading members…</Text>
        </View>
      ) : null}
      {visibleLobbyState?.kind === 'cached' ? <Text style={styles.stateMessage}>Showing saved members. Live updates resume when connected.</Text> : null}
      {visibleLobbyState?.kind === 'error' ? <Text accessibilityRole="alert" style={styles.error}>Could not update members. Showing the latest saved list.</Text> : null}
      {visibleLobbyState?.snapshot ? (
        <RoomRoster
          members={visibleLobbyState.snapshot.members}
          participantCount={visibleLobbyState.snapshot.participantCount}
          isActive={visibleLobbyState.snapshot.status === 'ACTIVE'}
          hostUid={visibleLobbyState.snapshot.hostUid}
          isLive={visibleLobbyState.kind === 'live'}
          onRemoveMember={isHost && !isLeaving && !isStarting && visibleLobbyState.kind === 'live'
            && visibleLobbyState.snapshot.status === 'WAITING' ? onRemoveMember : undefined}
          removingMemberUid={removingMemberUid}
        />
      ) : null}

      {isHost && onStartRoom && visibleLobbyState?.kind === 'live' && visibleLobbyState.snapshot.status === 'WAITING' ? (
        <View style={styles.startAction}>
          {startError ? <Text accessibilityRole="alert" style={styles.error}>{startError}</Text> : null}
          <PrimaryButton
            title={isStarting ? 'Starting…' : 'Start Session'}
            icon={isStarting ? <ActivityIndicator color={Colors.light.onPrimary} /> : <Ionicons name="play" size={17} color={Colors.light.onPrimary} />}
            onPress={onStartRoom}
            disabled={busy}
          />
        </View>
      ) : null}
      {!isHost && visibleLobbyState?.kind === 'live' && visibleLobbyState.snapshot.status === 'WAITING' ? (
        <View style={styles.waitingNotice}>
          <Ionicons name="hourglass-outline" size={18} color={Colors.light.primary} />
          <Text style={styles.waitingText}>Waiting for the Host to start the session</Text>
        </View>
      ) : null}

      {!room.localCacheSaved && room.createdAt === null ? <Text accessibilityRole="alert" style={styles.stateMessage}>Room created. Finishing the save on this device.</Text> : null}
      {!room.localCacheSaved && room.createdAt !== null ? <Text accessibilityRole="alert" style={styles.error}>Room created, but could not save it on this device.</Text> : null}
      {leaveError ? <Text accessibilityRole="alert" style={styles.error}>{leaveError}</Text> : null}
      {removeError ? <Text accessibilityRole="alert" style={styles.error}>{removeError}</Text> : null}

      <View style={styles.footerActions}>
        <View style={[styles.footerColumn, !canLeaveRoom ? styles.footerColumnFull : null]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share Invite"
            accessibilityState={{ disabled: Boolean(isLeaving) }}
            style={({ pressed }) => [styles.footerButton, styles.shareButton, pressed ? styles.pressed : null]}
            disabled={Boolean(isLeaving)}
            onPress={() => { void Share.share({ message: `Join my DontLift room ${room.pin}: ${room.invitation}` }); }}
          >
            <View pointerEvents="none" style={styles.footerContent}>
              <Ionicons name="share-outline" size={19} color={Colors.light.primary} />
              <Text numberOfLines={1} style={styles.shareText}>Share Invite</Text>
            </View>
          </Pressable>
        </View>
        {canLeaveRoom ? (
          <View style={styles.footerColumn}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Leave Room"
              accessibilityState={{ disabled: busy, busy: Boolean(isLeaving) }}
              disabled={busy}
              onPress={onLeaveRoom}
              style={({ pressed }) => [styles.footerButton, styles.leaveButton, pressed ? styles.pressed : null]}
            >
              <View pointerEvents="none" style={styles.footerContent}>
                <Ionicons name="exit-outline" size={19} color={Colors.light.error} />
                <Text numberOfLines={1} style={styles.leaveText}>{isLeaving ? 'Leaving…' : 'Leave Room'}</Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  intro: { alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: 2 },
  title: { color: Colors.light.text, fontSize: 24, lineHeight: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  body: { color: Colors.light.roomSecondaryText, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  loadingState: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateMessage: { color: Colors.light.roomSecondaryText, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  error: { color: Colors.light.error, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  startAction: { gap: 8 },
  waitingNotice: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 14, borderRadius: 17, backgroundColor: Colors.light.roomUtilitySurface, borderWidth: 1, borderColor: Colors.light.glassBorder },
  waitingText: { color: Colors.light.roomSecondaryText, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  footerActions: { width: '100%', flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-between', gap: 12, paddingTop: 2 },
  footerColumn: { flex: 1, minWidth: 0 },
  footerColumnFull: { flexBasis: '100%' },
  footerButton: { width: '100%', minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 99, borderWidth: 1 },
  footerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareButton: { backgroundColor: Colors.light.roomShareSurface, borderColor: Colors.light.roomShareBorder },
  leaveButton: { backgroundColor: Colors.light.roomLeaveSurface, borderColor: Colors.light.roomLeaveBorder },
  shareText: { color: Colors.light.primary, fontSize: 13, fontWeight: '700' },
  leaveText: { color: Colors.light.error, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.74 },
});
