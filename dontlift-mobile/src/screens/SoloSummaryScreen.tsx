import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { formatTime } from '../constants';
import { Colors } from '../constants/theme';
import type { SoloSessionSummary } from '../features/solo/summary-service';

interface SoloSummaryScreenProps {
  summary: SoloSessionSummary;
  onNewFocus: () => void;
}

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <GlassCard style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </GlassCard>
  );
}

export function SoloSummaryScreen({ summary, onNewFocus }: SoloSummaryScreenProps) {
  const hasNoConfirmedViolations = summary.liftCount === 0 && summary.violationDurationSeconds === 0;
  const completedAt = new Date(summary.completedAt).toLocaleString();

  return (
    <View style={styles.container}>
      <GlassCard style={styles.summaryCard}>
        <Text style={[styles.eyebrow, hasNoConfirmedViolations && styles.cleanEyebrow]}>
          {hasNoConfirmedViolations ? 'NO CONFIRMED LIFTS' : 'SESSION COMPLETE'}
        </Text>
        <Text style={styles.title}>Session complete</Text>
        <Text style={styles.subtitle}>
          {hasNoConfirmedViolations
            ? 'No phone lifts were confirmed during this session.'
            : 'Good work finishing your focus session.'}
        </Text>
        <Text style={styles.completedAt}>{completedAt}</Text>
      </GlassCard>

      <View style={styles.metricsGrid}>
        <SummaryMetric label="Focus time" value={formatTime(summary.durationSeconds)} detail={summary.mode === 'COUNTDOWN' ? 'Countdown' : 'Stopwatch'} />
        <SummaryMetric label="Confirmed lifts" value={String(summary.liftCount)} detail="After the 3-second grace period" />
        <SummaryMetric label="Away time" value={formatTime(summary.violationDurationSeconds)} detail="Total confirmed violation time" />
        <SummaryMetric label="Penalty score" value={`${summary.penaltyScore} pts`} detail="10 points per lift + seconds away" />
      </View>

      <PrimaryButton title="Start another session" onPress={onNewFocus} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  summaryCard: {
    alignItems: 'flex-start',
    padding: 20,
    gap: 7,
  },
  eyebrow: {
    color: Colors.light.authAccent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cleanEyebrow: {
    color: Colors.light.primary,
  },
  title: {
    color: Colors.light.text,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: Colors.light.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  completedAt: {
    color: Colors.light.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  metricsGrid: {
    gap: 10,
  },
  metricCard: {
    padding: 14,
    gap: 3,
  },
  metricLabel: {
    color: Colors.light.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    color: Colors.light.text,
    fontSize: 24,
    fontWeight: '800',
  },
  metricDetail: {
    color: Colors.light.textSecondary,
    fontSize: 12,
  },
});
