import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { formatTime } from '../constants';
import type { PhoneOrientation } from '../features/sensors/phone-down-engine';

interface SoloTimerScreenProps {
  mode: 'COUNTDOWN' | 'STOPWATCH';
  selectedDuration: number;
  secondsLeft: number;
  orientation: PhoneOrientation;
  isGraceActive: boolean;
  isViolationActive: boolean;
  graceSeconds: number;
  violationsCount: number;
  violationDurationSeconds: number;
  detectionError?: string;
  completionError?: string;
  onEndSession: () => void;
  onFinishSession: () => void;
  onCancelSession: () => void;
  isCancelling: boolean;
  isCompletingSession: boolean;
}

export function SoloTimerScreen({
  mode,
  selectedDuration,
  secondsLeft,
  orientation,
  isGraceActive,
  isViolationActive,
  graceSeconds,
  violationsCount,
  violationDurationSeconds,
  detectionError,
  completionError,
  onEndSession,
  onFinishSession,
  onCancelSession,
  isCancelling,
  isCompletingSession,
}: SoloTimerScreenProps) {
  const isCountdown = mode === 'COUNTDOWN';
  const isFaceDown = orientation === 'FACE_DOWN';
  const isAwayFromFaceDown = orientation === 'LIFTED' || orientation === 'INVALID';
  const orientationLabel = orientation === 'FACE_DOWN'
    ? 'Face down'
    : orientation === 'LIFTED'
      ? 'Lifted'
      : orientation === 'INVALID'
        ? 'Unstable sensor'
        : 'Checking position';
  return (
    <View style={styles.container}>
      {/* Top Status Bar */}
      <GlassCard style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusDotRow}>
            <View
              style={[
                styles.pulseDot,
                { backgroundColor: isAwayFromFaceDown ? '#DC2626' : isFaceDown ? '#2563EB' : '#94A3B8' },
              ]}
            />
            <View>
              <Text style={styles.statusTitle}>
                {isViolationActive
                  ? 'Violation recorded'
                  : isGraceActive
                    ? 'Phone lift detected'
                    : isFaceDown
                      ? 'Phone-down detection active'
                      : orientation === 'UNKNOWN'
                        ? 'Reading phone position'
                        : 'Phone is not face-down'}
              </Text>
              <Text
                style={[
                  styles.statusSub,
                  { color: isAwayFromFaceDown ? '#DC2626' : isFaceDown ? '#2563EB' : '#64748B' },
                ]}
              >
                {isViolationActive ? 'VIOLATION ACTIVE' : isGraceActive ? 'GRACE PERIOD' : orientationLabel.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.orientationBadge}>
            <Text style={styles.orientationText}>
              {orientationLabel}
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* Main Timer Dial */}
      <GlassCard style={styles.timerDialCard}>
        <View style={styles.doNotLiftPill}>
          <Text style={styles.doNotLiftText}>DO NOT LIFT PHONE</Text>
        </View>

        <View
          style={[
            styles.timerRing,
            (isGraceActive || isViolationActive) && { borderColor: '#EF4444', shadowColor: '#EF4444' },
          ]}
        >
          <Text style={styles.timerNumber}>{formatTime(secondsLeft)}</Text>
          <Text style={styles.intervalSub}>
            {isCountdown ? `${selectedDuration}:00 SOLO INTERVAL` : 'OPEN-ENDED SOLO SESSION'}
          </Text>
        </View>

        <View style={styles.stillnessRow}>
          <View style={[styles.soundWave, { height: 10 }]} />
          <View style={[styles.soundWave, { height: 18 }]} />
          <View style={[styles.soundWave, { height: 6 }]} />
          <View style={[styles.soundWave, { height: 22 }]} />
          <View style={[styles.soundWave, { height: 12 }]} />
          <Text style={styles.stillnessText}>Deep Stillness Mode</Text>
        </View>
      </GlassCard>

      {/* Grace Alert if Lifted */}
      {(isGraceActive || isViolationActive) && (
        <View style={styles.graceBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.graceTitle}>{isViolationActive ? 'Violation recorded' : 'Lift detected'}</Text>
            <Text style={styles.graceSub}>
              {isViolationActive ? 'Place the phone face-down to end the violation' : 'Place the phone face-down within 3 seconds'}
            </Text>
          </View>
          {isGraceActive && <View style={styles.graceCircle}>
            <Text style={styles.graceCircleText}>{graceSeconds}s</Text>
          </View>}
        </View>
      )}

      <View style={styles.actions}>
        {detectionError && <Text accessibilityRole="alert" style={styles.detectionError}>{detectionError}</Text>}
        {completionError && <Text accessibilityRole="alert" style={styles.detectionError}>{completionError}</Text>}

        <PrimaryButton
          title={isCompletingSession ? 'Saving session…' : completionError ? 'Retry save' : isCountdown ? 'Finish early' : 'Finish session'}
          onPress={onFinishSession}
          disabled={isCompletingSession || isCancelling}
          style={{ marginTop: 8 }}
        />

        <PrimaryButton
          title="Cancel session"
          variant="danger"
          onPress={onCancelSession}
          disabled={isCancelling || isCompletingSession}
          style={{ marginTop: 8 }}
        />

        <PrimaryButton
          title="Back to Solo Focus"
          variant="secondary"
          onPress={onEndSession}
          disabled={isCancelling || isCompletingSession}
          style={{ marginTop: 8 }}
        />
      </View>

      {/* Violations logged */}
      <GlassCard style={styles.violationsCard}>
        <View style={styles.violationHeader}>
          <Text style={styles.violationTitle}>Violations Logged ({violationsCount})</Text>
          <Text style={styles.violationStatus}>
            {violationsCount === 0 ? 'Clean session' : `${violationsCount * 10 + violationDurationSeconds} points`}
          </Text>
        </View>
        <Text style={styles.violationNote}>
          {violationsCount === 0
            ? 'No violations recorded yet'
            : `${violationsCount} violations · ${formatTime(violationDurationSeconds)} total`}
        </Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  statusCard: {
    padding: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusSub: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  orientationBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  orientationText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  timerDialCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  doNotLiftPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  doNotLiftText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  timerRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 6,
    borderColor: '#2563EB',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
  },
  timerNumber: {
    fontSize: 46,
    fontWeight: '900',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  intervalSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
  },
  stillnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 20,
  },
  soundWave: {
    width: 3,
    backgroundColor: '#2563EB',
    borderRadius: 2,
  },
  stillnessText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginLeft: 6,
  },
  graceBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  graceTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#991B1B',
  },
  graceSub: {
    fontSize: 11,
    color: '#7F1D1D',
    marginTop: 2,
  },
  graceCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  graceCircleText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  actions: {
    width: '100%',
  },
  detectionError: {
    color: '#991B1B',
    fontSize: 12,
    marginBottom: 8,
  },
  violationsCard: {
    padding: 14,
    gap: 4,
  },
  violationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  violationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  violationStatus: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  violationNote: {
    fontSize: 11,
    color: '#64748B',
  },
});
