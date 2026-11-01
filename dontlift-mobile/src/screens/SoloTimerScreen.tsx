import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { SoloTimerDial } from '../components/SoloTimerDial';
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
  onFinishSession: () => void;
  onCancelSession: () => void;
  isCancelling: boolean;
  isCompletingSession: boolean;
  isRecoveringBackground?: boolean;
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
  onFinishSession,
  onCancelSession,
  isCancelling,
  isCompletingSession,
  isRecoveringBackground = false,
}: SoloTimerScreenProps) {
  const isCountdown = mode === 'COUNTDOWN';
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
      <View style={[
        styles.statusBanner,
        isViolationActive ? styles.violationBanner : isGraceActive ? styles.graceBanner : styles.readyBanner,
      ]}>
        <View style={styles.statusRow}>
          <View style={styles.statusDotRow}>
            <View
              style={[
                styles.pulseDot,
                { backgroundColor: isViolationActive ? '#DC2626' : isGraceActive ? '#D97706' : isAwayFromFaceDown ? '#DC2626' : '#2563EB' },
              ]}
            />
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>
                {isViolationActive
                  ? 'Violation recorded'
                  : isGraceActive
                    ? 'Phone lift detected'
                    : 'Focus session active'}
              </Text>
              <Text style={[
                styles.statusSub,
                isViolationActive ? styles.violationText : isGraceActive ? styles.graceText : styles.readyText,
              ]}>
                {isViolationActive
                  ? 'Place your phone face-down to end the violation.'
                  : isGraceActive
                    ? `Place your phone face-down within ${graceSeconds}s.`
                    : orientation === 'UNKNOWN'
                      ? 'Checking that your phone is face-down.'
                      : orientationLabel === 'Face down'
                        ? 'Phone is face-down. Stay focused.'
                        : 'Place your phone face-down to stay focused.'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <GlassCard style={styles.timerDialCard}>
        <SoloTimerDial
          mode={mode}
          selectedDuration={selectedDuration}
          secondsLeft={secondsLeft}
          isViolationActive={isViolationActive}
        />
        <View style={styles.stillnessRow}>
          <View style={[styles.soundWave, { height: 10 }]} />
          <View style={[styles.soundWave, { height: 18 }]} />
          <View style={[styles.soundWave, { height: 6 }]} />
          <View style={[styles.soundWave, { height: 22 }]} />
          <View style={[styles.soundWave, { height: 12 }]} />
          <Text style={styles.stillnessText}>Deep Stillness Mode</Text>
        </View>
      </GlassCard>

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

      <View style={styles.actions}>
        {detectionError ? <Text accessibilityRole="alert" style={styles.detectionError}>{detectionError}</Text> : null}
        {completionError ? <Text accessibilityRole="alert" style={styles.detectionError}>{completionError}</Text> : null}

        <PrimaryButton
          title={isRecoveringBackground ? 'Restoring session…' : isCompletingSession ? 'Saving session…' : completionError ? 'Retry save' : isCountdown ? 'Finish early' : 'Finish session'}
          onPress={onFinishSession}
          disabled={isRecoveringBackground || isCompletingSession || isCancelling}
          style={styles.finishButton}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel session"
          accessibilityState={{ disabled: isRecoveringBackground || isCancelling || isCompletingSession }}
          disabled={isRecoveringBackground || isCancelling || isCompletingSession}
          onPress={onCancelSession}
          style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
        >
          <Text style={styles.cancelButtonText}>Cancel session</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  statusBanner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 18,
  },
  violationBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: 'rgba(239,68,68,0.36)',
  },
  graceBanner: {
    backgroundColor: '#FFF7ED',
    borderColor: 'rgba(217,119,6,0.24)',
  },
  readyBanner: {
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderColor: 'rgba(255,255,255,0.84)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusCopy: {
    flex: 1,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusSub: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  violationText: { color: '#7F1D1D' },
  graceText: { color: '#9A3412' },
  readyText: { color: '#475569' },
  timerDialCard: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  stillnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 16,
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
  actions: {
    width: '100%',
    gap: 2,
    marginTop: 2,
    marginBottom: 8,
  },
  finishButton: {
    marginTop: 0,
  },
  detectionError: {
    color: '#991B1B',
    fontSize: 12,
    marginBottom: 8,
  },
  cancelButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  cancelButtonPressed: {
    backgroundColor: 'rgba(185,28,28,0.06)',
  },
  cancelButtonText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '700',
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
