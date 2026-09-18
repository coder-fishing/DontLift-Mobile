import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { Participant } from '../types';
import { formatTime } from '../constants';

interface GroupActiveScreenProps {
  participants: Participant[];
  groupTimerSeconds: number;
  groupAlertVisible: boolean;
  groupGraceSeconds: number;
  isHostRole: boolean;
  onEndSession: () => void;
}

export function GroupActiveScreen({
  participants,
  groupTimerSeconds,
  groupAlertVisible,
  groupGraceSeconds,
  isHostRole,
  onEndSession,
}: GroupActiveScreenProps) {
  return (
    <View style={styles.container}>
      {/* Breach Alert */}
      {groupAlertVisible && (
        <View style={styles.breachAlert}>
          <View style={styles.breachLeft}>
            <View style={styles.breachIcon}>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
            </View>
            <View>
              <Text style={styles.breachTitle}>Lift Detected • Sarah Jenkins</Text>
              <Text style={styles.breachSub}>0{groupGraceSeconds}s in Grace Window</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => Alert.alert('Nudge Sent', 'Nudge notification sent to Sarah Jenkins!')}
            style={styles.nudgeBtn}
          >
            <Text style={styles.nudgeBtnText}>🔔 Nudge</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Group Timer */}
      <GlassCard style={styles.timerCard}>
        <View style={styles.timerRing}>
          <Text style={styles.timerText}>{formatTime(groupTimerSeconds)}</Text>
          <Text style={styles.timerSub}>TARGET: 45:00</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Clean Time</Text>
            <Text style={styles.statVal}>31m 20s</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Violations</Text>
            <Text style={[styles.statVal, { color: '#EF4444' }]}>3 Breaches</Text>
          </View>
        </View>
      </GlassCard>

      {/* Leaderboard */}
      <View style={styles.leaderboardSection}>
        <Text style={styles.leaderboardHeader}>Penalty Leaderboard (Lowest pts wins)</Text>

        {participants
          .slice()
          .sort((a, b) => a.lifts - b.lifts)
          .map((p, idx) => (
            <GlassCard key={p.id} style={styles.rankRow}>
              <View style={styles.rankNum}>
                <Text style={styles.rankNumText}>{idx + 1}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.rankName}>{p.name}</Text>
                <Text style={styles.rankLifts}>{p.lifts} lifts logged</Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.rankPts}>{p.lifts * 10 + p.violationSeconds} pts</Text>
                <View
                  style={[
                    styles.rankPill,
                    { backgroundColor: p.lifts === 0 ? '#DCFCE7' : '#FEE2E2' },
                  ]}
                >
                  <Text
                    style={[
                      styles.rankPillText,
                      { color: p.lifts === 0 ? '#166534' : '#991B1B' },
                    ]}
                  >
                    {p.lifts === 0 ? 'CLEAN' : 'PENALTY'}
                  </Text>
                </View>
              </View>
            </GlassCard>
          ))}
      </View>

      {/* Host End Session or Request Early Exit */}
      {isHostRole ? (
        <PrimaryButton
          title="End Session & Allocate Bill"
          onPress={onEndSession}
        />
      ) : (
        <PrimaryButton
          title="Request Early Exit"
          variant="secondary"
          onPress={() => Alert.alert('Exit Request', 'Request submitted to Host.')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  breachAlert: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breachLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breachIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breachTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  breachSub: {
    fontSize: 10,
    color: '#7F1D1D',
  },
  nudgeBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  nudgeBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  timerCard: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 16,
  },
  timerRing: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 5,
    borderColor: '#2563EB',
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 38,
    fontWeight: '900',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timerSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  leaderboardSection: {
    gap: 8,
  },
  leaderboardHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  rankNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
  },
  rankName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  rankLifts: {
    fontSize: 10,
    color: '#64748B',
  },
  rankPts: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
  },
  rankPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  rankPillText: {
    fontSize: 8,
    fontWeight: '800',
  },
});
