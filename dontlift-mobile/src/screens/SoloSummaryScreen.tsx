import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { formatTime } from '../constants';
import { Colors } from '../constants/theme';
import type { SoloSessionSummary } from '../features/solo/summary-service';

interface SoloSummaryScreenProps {
  summary: SoloSessionSummary;
  syncStatus: 'syncing' | 'pending' | 'synced' | 'failed';
  onRetrySync: () => void;
  onNewFocus: () => void;
}

type MetricVariant = 'focus' | 'neutral' | 'penalty';

function SummaryMetric({
  label,
  value,
  detail,
  variant = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  variant?: MetricVariant;
}) {
  return (
    <View style={[styles.metricCard, styles[`${variant}MetricCard`]]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, variant === 'penalty' && styles.penaltyValue]}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function formatCompletedAt(value: string): string {
  const completedAt = new Date(value);
  if (!Number.isFinite(completedAt.getTime())) return 'Completion time unavailable';

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isSameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
  const dateLabel = isSameDay(completedAt, now)
    ? 'Today'
    : isSameDay(completedAt, yesterday)
      ? 'Yesterday'
      : completedAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(completedAt.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
      });
  const timeLabel = completedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateLabel} · ${timeLabel}`;
}

export function SoloSummaryScreen({ summary, syncStatus, onRetrySync, onNewFocus }: SoloSummaryScreenProps) {
  const hasNoConfirmedViolations = summary.liftCount === 0 && summary.violationDurationSeconds === 0;
  const effectiveFocusSeconds = Math.max(0, summary.durationSeconds - summary.violationDurationSeconds);
  const awayTime = formatTime(summary.violationDurationSeconds);
  const focusMessage = hasNoConfirmedViolations
    ? 'No phone lifts were confirmed after the 3-second grace period.'
    : `You focused for ${formatTime(effectiveFocusSeconds)} and spent ${awayTime} away.`;
  const canRetrySync = syncStatus === 'pending' || syncStatus === 'failed';
  const syncTitle = syncStatus === 'synced'
    ? 'Summary synced'
    : syncStatus === 'syncing'
      ? 'Syncing summary'
      : 'Saved on this device';
  const syncDetail = syncStatus === 'synced'
    ? 'Your summary is backed up to your account.'
    : syncStatus === 'failed'
      ? 'Could not sync. Your summary is safe on this device.'
      : syncStatus === 'pending'
        ? 'It will sync when a connection is available.'
        : 'Sending your latest session details.';

  return (
    <View style={styles.container}>
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, hasNoConfirmedViolations ? styles.cleanEyebrow : styles.completeEyebrow]}>
              {hasNoConfirmedViolations ? 'NO CONFIRMED LIFTS' : 'SOLO SESSION'}
            </Text>
            <Text accessibilityRole="header" style={styles.title}>Session complete</Text>
            <Text style={styles.subtitle}>{focusMessage}</Text>
          </View>
          <View style={[styles.statusMark, hasNoConfirmedViolations ? styles.cleanMark : styles.sessionMark]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons
              name={hasNoConfirmedViolations ? 'checkmark' : 'phone-portrait-outline'}
              size={23}
              color={hasNoConfirmedViolations ? Colors.light.success : Colors.light.primary}
            />
          </View>
        </View>
        <View style={styles.datePill}>
          <Ionicons name="time-outline" size={14} color={Colors.light.textSecondary} />
          <Text style={styles.completedAt}>{formatCompletedAt(summary.completedAt)}</Text>
        </View>
      </GlassCard>

      <View style={styles.metricsGrid}>
        <View style={styles.metricRow}>
          <SummaryMetric
            label="Focus time"
            value={formatTime(effectiveFocusSeconds)}
            detail={`of ${formatTime(summary.durationSeconds)} total`}
            variant="focus"
          />
          <SummaryMetric
            label="Away time"
            value={awayTime}
            detail="Confirmed time away"
          />
        </View>
        <View style={styles.metricRow}>
          <SummaryMetric
            label="Confirmed lifts"
            value={String(summary.liftCount)}
            detail="After the 3-second grace period"
          />
          <SummaryMetric
            label="Penalty score"
            value={`${summary.penaltyScore} pts`}
            detail="10 per lift + seconds away"
            variant="penalty"
          />
        </View>
      </View>

      <View style={[
        styles.syncBanner,
        syncStatus === 'failed' && styles.syncFailed,
        syncStatus === 'synced' && styles.syncComplete,
      ]}>
        <View style={styles.syncIdentity}>
          <View style={[
            styles.syncIcon,
            syncStatus === 'failed' && styles.syncIconFailed,
            syncStatus === 'synced' && styles.syncIconComplete,
          ]}>
            {syncStatus === 'syncing'
              ? <ActivityIndicator size="small" color={Colors.light.primary} />
              : <Ionicons
                name={syncStatus === 'synced' ? 'checkmark' : syncStatus === 'failed' ? 'cloud-offline-outline' : 'cloud-upload-outline'}
                size={16}
                color={syncStatus === 'failed' ? Colors.light.error : syncStatus === 'synced' ? Colors.light.success : Colors.light.textSecondary}
              />}
          </View>
          <View style={styles.syncCopy}>
            <Text style={styles.syncTitle}>{syncTitle}</Text>
            <Text style={styles.syncDetail}>{syncDetail}</Text>
          </View>
        </View>
        {canRetrySync ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry syncing summary"
            onPress={onRetrySync}
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>

      <PrimaryButton title="Start another focus session" onPress={onNewFocus} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  heroCard: {
    alignItems: 'stretch',
    padding: 16,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  cleanEyebrow: { color: '#065F46' },
  completeEyebrow: { color: Colors.light.primary },
  title: {
    color: Colors.light.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  statusMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanMark: { backgroundColor: Colors.light.successSurface },
  sessionMark: { backgroundColor: Colors.light.backgroundSelected },
  datePill: {
    alignSelf: 'flex-start',
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  completedAt: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  metricsGrid: {
    gap: 10,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 118,
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: 'rgba(255,255,255,0.84)',
  },
  focusMetricCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  neutralMetricCard: {},
  penaltyMetricCard: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  metricLabel: {
    color: '#475569',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  metricValue: {
    color: Colors.light.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginVertical: 4,
  },
  penaltyValue: { color: '#BE123C' },
  metricDetail: {
    color: '#475569',
    fontSize: 11,
    lineHeight: 15,
  },
  syncBanner: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.68)',
  },
  syncFailed: {
    borderColor: '#FECDD3',
    backgroundColor: '#FFF7F7',
  },
  syncComplete: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  syncIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  syncIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  syncIconFailed: { backgroundColor: '#FFE4E6' },
  syncIconComplete: { backgroundColor: '#DCFCE7' },
  syncCopy: { flex: 1, minWidth: 0 },
  syncTitle: {
    color: Colors.light.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  syncDetail: {
    color: '#475569',
    fontSize: 10,
    lineHeight: 14,
  },
  retryButton: {
    minWidth: 54,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  retryButtonPressed: { backgroundColor: 'rgba(37,99,235,0.08)' },
  retryText: {
    color: Colors.light.primary,
    fontSize: 12,
    fontWeight: '800',
  },
});
