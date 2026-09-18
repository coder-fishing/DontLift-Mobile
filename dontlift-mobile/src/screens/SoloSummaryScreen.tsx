import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';

interface SoloSummaryScreenProps {
  selectedDuration: number;
  streakDays: number;
  onNewFocus: () => void;
}

export function SoloSummaryScreen({
  selectedDuration,
  streakDays,
  onNewFocus,
}: SoloSummaryScreenProps) {
  return (
    <View style={styles.container}>
      {/* Success Banner */}
      <GlassCard style={styles.successCard}>
        <View style={styles.trophyCircle}>
          <Text style={styles.trophyEmoji}>🏆</Text>
        </View>
        <Text style={styles.successTitle}>Session Completed!</Text>
        <Text style={styles.successSub}>
          {selectedDuration}m 00s Focus Interval • Flawless discipline maintained
        </Text>
      </GlassCard>

      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        <GlassCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Discipline Rate</Text>
          <Text style={styles.metricValueBlue}>100%</Text>
          <Text style={styles.metricSub}>Full compliance</Text>
        </GlassCard>

        <GlassCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Streak Status</Text>
          <Text style={styles.metricValueSlate}>{streakDays} Days</Text>
          <Text style={styles.metricSub}>Next badge in 24h</Text>
        </GlassCard>

        <GlassCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Violations</Text>
          <Text style={styles.metricValueGreen}>0 Lifts</Text>
          <Text style={styles.metricSub}>Clean Run</Text>
        </GlassCard>

        <GlassCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Penalty Score</Text>
          <Text style={styles.metricValueSlate}>0 pts</Text>
          <Text style={styles.metricSub}>Full deposit safe</Text>
        </GlassCard>
      </View>

      {/* SQLite Telemetry Log */}
      <GlassCard style={styles.logCard}>
        <View style={styles.logHeader}>
          <Text style={styles.logTitle}>SQLite Movement Telemetry Log</Text>
          <View style={styles.eventsBadge}>
            <Text style={styles.eventsBadgeText}>2 Events</Text>
          </View>
        </View>

        <View style={styles.logList}>
          <View style={styles.logItem}>
            <Text style={styles.logTime}>17:40</Text>
            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <Text style={styles.logItemTitle}>Micro-adjustment • Permitted</Text>
              <Text style={styles.logItemSub}>Within 3.0s grace window (1.8s)</Text>
            </View>
            <Text style={styles.logPts}>0 pts</Text>
          </View>

          <View style={styles.logItem}>
            <Text style={styles.logTime}>25:00</Text>
            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <Text style={styles.logItemTitle}>Completed • Grounded</Text>
              <Text style={styles.logItemSub}>Continuous flat sensor lock</Text>
            </View>
            <Text style={styles.logPts}>Valid</Text>
          </View>
        </View>
      </GlassCard>

      {/* Actions */}
      <View style={styles.actions}>
        <PrimaryButton
          title="Share Discipline Card"
          variant="secondary"
          onPress={() => Alert.alert('Share', 'Discipline card summary copied!')}
        />
        <PrimaryButton
          title="Done / New Focus"
          onPress={onNewFocus}
          style={{ marginTop: 8 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  successCard: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  trophyCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  trophyEmoji: {
    fontSize: 24,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  successSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    padding: 14,
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  metricValueBlue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#2563EB',
  },
  metricValueSlate: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  metricValueGreen: {
    fontSize: 26,
    fontWeight: '900',
    color: '#10B981',
  },
  metricSub: {
    fontSize: 10,
    color: '#64748B',
  },
  logCard: {
    padding: 16,
    gap: 12,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  logTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  eventsBadge: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  eventsBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  logList: {
    gap: 10,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    padding: 10,
    borderRadius: 12,
  },
  logTime: {
    fontSize: 11,
    fontWeight: '900',
    color: '#2563EB',
    fontFamily: 'monospace',
  },
  logItemTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  logItemSub: {
    fontSize: 10,
    color: '#64748B',
  },
  logPts: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  actions: {
    width: '100%',
  },
});
