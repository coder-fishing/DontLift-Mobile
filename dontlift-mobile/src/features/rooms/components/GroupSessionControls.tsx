import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../../../components/GlassCard';
import { Colors } from '../../../constants/theme';
import type { RoomLobbySnapshot } from '../room-listener';
import type { TerminationChoice } from '../termination-vote-repository';
import type { TerminationVoteState } from '../termination-vote-listener';

export function GroupSessionControls({
  snapshot,
  actorUid,
  isHost,
  isOnline,
  voteState,
  isOpeningVote,
  isCastingVote,
  voteError,
  isCompleting,
  completionError,
  onOpenVote,
  onCastVote,
  onComplete,
}: {
  snapshot: RoomLobbySnapshot;
  actorUid: string;
  isHost: boolean;
  isOnline: boolean;
  voteState: TerminationVoteState;
  isOpeningVote: boolean;
  isCastingVote: boolean;
  voteError?: string;
  isCompleting: boolean;
  completionError?: string;
  onOpenVote: () => void;
  onCastVote: (choice: TerminationChoice) => void;
  onComplete: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const vote = voteState.vote;
  const ownBallot = voteState.ownBallot?.voteId === vote?.voteId ? voteState.ownBallot : null;
  const voteSecondsLeft = vote?.openedAtUtcMs == null ? null
    : Math.max(0, Math.ceil((vote.openedAtUtcMs + 30_000 - now) / 1_000));
  const hasOpenVote = vote?.status === 'OPEN';
  const voteHasExpired = hasOpenVote && voteSecondsLeft === 0;
  const ownMember = snapshot.members.find(member => member.uid === actorUid);
  const canParticipate = snapshot.status === 'ACTIVE' && ownMember?.status === 'ACTIVE';
  const canOpenVote = canParticipate && (!vote || vote.status === 'OPEN');
  const canCastVote = hasOpenVote && voteSecondsLeft !== null && voteSecondsLeft > 0 && canParticipate;
  const confirmTerminationVote = () => Alert.alert(
    'End session early?',
    'Everyone still active must vote Yes within 30 seconds. Bill settlement will be skipped.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Start vote', onPress: onOpenVote }],
  );
  const confirmRoomCompletion = () => Alert.alert(
    'End this group session?',
    'The room will close at server time. Everyone must sync their saved session data before final scores are locked.',
    [
      { text: 'Keep session open', style: 'cancel' },
      { text: 'End session', style: 'destructive', onPress: onComplete },
    ],
  );

  return (
    <GlassCard style={styles.controlsCard}>
      <View style={styles.controlsContent}>
        <Text style={styles.sectionTitle}>Session controls</Text>
        {hasOpenVote ? (
          <>
            <Text style={styles.controlSubheading}>Vote to end session</Text>
            {voteHasExpired ? (
              <Text style={[styles.voteResult, vote!.yesVoteCount >= vote!.eligibleVoterCount && styles.safeText]}>
                {vote!.yesVoteCount >= vote!.eligibleVoterCount
                  ? 'All members agreed · ending the session'
                  : 'Voting window ended · session continues'}
              </Text>
            ) : voteSecondsLeft === null ? (
              <Text style={styles.body}>Checking vote timing…</Text>
            ) : (
              <View style={styles.voteSummary}>
                <Text accessibilityLabel={`Voting closes in ${voteSecondsLeft} seconds`} style={styles.voteCountdown}>Ends in {voteSecondsLeft}s</Text>
                <Text style={styles.voteCount}>{vote!.yesVoteCount} / {vote!.eligibleVoterCount} Yes</Text>
              </View>
            )}
            {voteHasExpired && vote!.yesVoteCount < vote!.eligibleVoterCount ? (
              <View style={styles.expiredVoteRow}>
                <Text style={styles.body}>Yes votes: {vote!.yesVoteCount} / {vote!.eligibleVoterCount}</Text>
                {ownBallot ? <Text style={styles.ballotBadge}>You voted {ownBallot.choice === 'YES' ? 'Yes' : 'No'}</Text> : null}
              </View>
            ) : null}
            {!voteHasExpired && ownBallot ? (
              <View style={styles.ballotRow}><Text style={styles.ballotBadge}>You voted {ownBallot.choice === 'YES' ? 'Yes' : 'No'}</Text></View>
            ) : null}
            {!ownBallot && canCastVote ? (
              <View style={styles.actionRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Vote yes to end session" disabled={!isOnline || isCastingVote}
                  onPress={() => onCastVote('YES')} style={[styles.actionButton, styles.rowAction, (!isOnline || isCastingVote) && styles.disabled]}>
                  {isCastingVote ? <ActivityIndicator color={Colors.light.onPrimary} /> : null}
                  <Text style={styles.actionText}>Yes</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Vote no to continue session" disabled={!isOnline || isCastingVote}
                  onPress={() => onCastVote('NO')} style={[styles.secondaryButton, (!isOnline || isCastingVote) && styles.disabled]}>
                  <Text style={styles.secondaryActionText}>No</Text>
                </Pressable>
              </View>
            ) : null}
            {voteHasExpired && canOpenVote ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Initiate termination vote" disabled={!isOnline || isOpeningVote}
                onPress={confirmTerminationVote} style={[styles.voteStartButton, (!isOnline || isOpeningVote) && styles.disabled]}>
                {isOpeningVote ? <ActivityIndicator color={Colors.light.primary} /> : null}
                <Text style={styles.voteStartText}>Start another vote</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            {vote?.status === 'CANCELLED' ? <Text style={styles.controlSubheading}>Vote ended</Text> : null}
            {vote?.status === 'CANCELLED' ? <Text style={styles.body}>The session ended by unanimous vote. Opening the session summary…</Text> : null}
            {canOpenVote ? (
              <>
                <Pressable accessibilityRole="button" accessibilityLabel="Initiate termination vote" disabled={!isOnline || isOpeningVote}
                  onPress={confirmTerminationVote} style={[styles.voteStartButton, (!isOnline || isOpeningVote) && styles.disabled]}>
                  {isOpeningVote ? <ActivityIndicator color={Colors.light.primary} /> : null}
                  <Text style={styles.voteStartText}>Vote to end session</Text>
                </Pressable>
                <Text style={styles.body}>Requires every active member to agree within 30 seconds.</Text>
              </>
            ) : null}
            {!vote && !canParticipate ? <Text style={styles.body}>Only active members can start an early-end vote.</Text> : null}
          </>
        )}
        {voteState.error || voteError ? (
          <Text accessibilityRole="alert" style={styles.error}>{voteError || 'Could not load the current vote. Reconnect and reopen the room to retry.'}</Text>
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
            <Pressable accessibilityRole="button" accessibilityLabel="End group session" disabled={!isOnline || isCompleting}
              onPress={confirmRoomCompletion} style={[styles.endButton, (!isOnline || isCompleting) && styles.disabled]}>
              {isCompleting ? <ActivityIndicator accessibilityLabel="Ending group session" color={Colors.light.error} /> : null}
              <Text style={styles.endActionText}>{isCompleting ? 'Ending session…' : 'End group session now'}</Text>
            </Pressable>
            {!isOnline ? <Text style={styles.body}>Connect to the internet to end the room.</Text> : null}
          </>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  controlsCard: { padding: 16 },
  controlsContent: { gap: 9 },
  sectionTitle: { color: Colors.light.text, fontSize: 14, fontWeight: '800' },
  controlSubheading: { color: Colors.light.text, fontSize: 13, fontWeight: '700' },
  voteResult: { color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  safeText: { color: Colors.light.success },
  body: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  voteSummary: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  voteCountdown: { color: Colors.light.textSecondary, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  voteCount: { color: Colors.light.textSecondary, fontSize: 13, fontWeight: '600' },
  expiredVoteRow: { minHeight: 32, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ballotBadge: { overflow: 'hidden', borderRadius: 9, backgroundColor: Colors.light.backgroundElement, color: Colors.light.textSecondary, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '700' },
  ballotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.light.primary },
  rowAction: { flex: 1 },
  disabled: { opacity: 0.5 },
  actionText: { color: Colors.light.onPrimary, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
  secondaryButton: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  secondaryActionText: { color: Colors.light.text, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
  voteStartButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.light.backgroundSelected },
  voteStartText: { color: Colors.light.primary, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  error: { color: Colors.light.error, fontSize: 13 },
  controlDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.light.border, marginTop: 2 },
  controlCopy: { gap: 3 },
  endButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'transparent' },
  endActionText: { color: Colors.light.error, fontWeight: '700', flexShrink: 1, textAlign: 'left' },
});
