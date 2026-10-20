import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { Colors } from '../constants/theme';
import { formatTime } from '../constants';
import { rankGroupMembers } from '../features/rooms/group-active-domain';
import type { RoomLobbySnapshot } from '../features/rooms/room-listener';
import type { ForegroundDetectionViewState } from '../features/solo/foreground-detection-controller';

type Props = {
  snapshot: RoomLobbySnapshot;
  elapsedSeconds: number;
  detection: ForegroundDetectionViewState;
  isOnline: boolean;
  syncMessage?: string;
};

export function GroupActiveScreen({ snapshot, elapsedSeconds, detection, isOnline, syncMessage }: Props) {
  const members = rankGroupMembers(snapshot.members);
  return (
    <View style={styles.container}>
      <GlassCard style={styles.timerCard}>
        <Text style={styles.eyebrow}>GROUP SESSION • {snapshot.status}</Text>
        <Text accessibilityLabel="Elapsed group session time" style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
        <Text style={styles.body}>{isOnline ? 'Connected to the live room' : 'Offline · violations are saved on this device'}</Text>
      </GlassCard>

      <GlassCard style={styles.captureCard}>
        <Text style={styles.sectionTitle}>Your phone</Text>
        <Text style={styles.body}>Position: {detection.orientation.replace('_', ' ').toLowerCase()}</Text>
        <Text style={styles.body}>Confirmed lifts: {detection.violationsCount}</Text>
        <Text style={styles.body}>Violation time: {formatTime(detection.violationDurationSeconds)}</Text>
        {detection.isGraceActive && <Text style={styles.notice}>Grace period · {detection.graceSeconds}s</Text>}
        {detection.persistenceError && <Text accessibilityRole="alert" style={styles.error}>{detection.persistenceError}</Text>}
        {syncMessage && <Text style={styles.notice}>{syncMessage}</Text>}
      </GlassCard>

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
  memberRow: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 12 },
  rank: { color: Colors.light.primary, fontSize: 16, fontWeight: '900', width: 24, textAlign: 'center' },
  memberDetails: { flex: 1, gap: 3 },
  name: { color: Colors.light.text, fontSize: 14, fontWeight: '800' },
  score: { color: Colors.light.text, fontSize: 14, fontWeight: '900' },
});
