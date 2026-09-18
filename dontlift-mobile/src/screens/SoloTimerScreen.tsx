import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { formatTime } from '../constants';

interface SoloTimerScreenProps {
  selectedDuration: number;
  secondsLeft: number;
  isPhoneGrounded: boolean;
  isGraceActive: boolean;
  graceSeconds: number;
  violationsCount: number;
  onTogglePhoneLift: () => void;
  onEndSession: () => void;
}

export function SoloTimerScreen({
  selectedDuration,
  secondsLeft,
  isPhoneGrounded,
  isGraceActive,
  graceSeconds,
  violationsCount,
  onTogglePhoneLift,
  onEndSession,
}: SoloTimerScreenProps) {
  return (
    <View style={styles.container}>
      {/* Top Status Bar */}
      <GlassCard style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusDotRow}>
            <View
              style={[
                styles.pulseDot,
                { backgroundColor: isPhoneGrounded ? '#2563EB' : '#DC2626' },
              ]}
            />
            <View>
              <Text style={styles.statusTitle}>
                {isPhoneGrounded ? 'Phone-Down Detection: Active' : 'Phone Lifted!'}
              </Text>
              <Text
                style={[
                  styles.statusSub,
                  { color: isPhoneGrounded ? '#2563EB' : '#DC2626' },
                ]}
              >
                {isPhoneGrounded ? 'AMBIENT GYRO LOCKED' : 'BREACH IN PROGRESS'}
              </Text>
            </View>
          </View>
          <View style={styles.orientationBadge}>
            <Text style={styles.orientationText}>
              {isPhoneGrounded ? 'Flat Surface' : 'Off Table'}
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
            isGraceActive && { borderColor: '#EF4444', shadowColor: '#EF4444' },
          ]}
        >
          <Text style={styles.timerNumber}>{formatTime(secondsLeft)}</Text>
          <Text style={styles.intervalSub}>{selectedDuration}:00 SOLO INTERVAL</Text>
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
      {isGraceActive && (
        <View style={styles.graceBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.graceTitle}>🚨 Lift Detected!</Text>
            <Text style={styles.graceSub}>Place phone face-down immediately</Text>
          </View>
          <View style={styles.graceCircle}>
            <Text style={styles.graceCircleText}>{graceSeconds}s</Text>
          </View>
        </View>
      )}

      {/* Simulation Button */}
      <View style={styles.actions}>
        <PrimaryButton
          title={isPhoneGrounded ? 'Elevator Simulation (Simulate Lift)' : 'Put Phone Face-Down'}
          variant={isPhoneGrounded ? 'secondary' : 'danger'}
          onPress={onTogglePhoneLift}
        />

        <PrimaryButton
          title="End Session"
          variant="danger"
          onPress={onEndSession}
          style={{ marginTop: 8 }}
        />
      </View>

      {/* Violations logged */}
      <GlassCard style={styles.violationsCard}>
        <View style={styles.violationHeader}>
          <Text style={styles.violationTitle}>Violations Logged ({violationsCount})</Text>
          <Text style={styles.violationStatus}>
            {violationsCount === 0 ? '✓ Clean Session' : `⚠️ ${violationsCount * 10} Pts`}
          </Text>
        </View>
        <Text style={styles.violationNote}>
          {violationsCount === 0
            ? 'No penalties recorded yet • Streak protected'
            : `${violationsCount} lift breaches recorded in SQLite log`}
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
