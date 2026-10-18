import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Colors } from '../constants/theme';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { SensorAvailabilityPanel } from '../components/SensorAvailabilityPanel';
import type { SensorAvailabilityState } from '../features/sensors/sensor-adapter';
import type { SoloSession } from '../features/solo/session-controller';

interface SoloSelectScreenProps {
  selectedDuration: number;
  selectedMode: 'COUNTDOWN' | 'STOPWATCH';
  onSelectDuration: (mins: number) => void;
  onSelectMode: (mode: 'COUNTDOWN' | 'STOPWATCH') => void;
  onStartSession: (mode: 'COUNTDOWN' | 'STOPWATCH', mins: number) => void;
  onContinueSession: () => void;
  onCancelSession: () => void;
  isStarting: boolean;
  isCancelling: boolean;
  startError?: string;
  activeSession?: SoloSession | null;
  sensorAvailability: SensorAvailabilityState;
  onRetrySensorCheck: () => void;
  onOpenSettings: () => void;
}

export function SoloSelectScreen({
  selectedDuration,
  selectedMode,
  onSelectDuration,
  onSelectMode,
  onStartSession,
  onContinueSession,
  onCancelSession,
  isStarting,
  isCancelling,
  startError,
  activeSession,
  sensorAvailability,
  onRetrySensorCheck,
  onOpenSettings,
}: SoloSelectScreenProps) {
  // Màn Solo đang dùng backdrop và GlassCard sáng; giữ foreground cùng palette để chữ luôn tương phản.
  const colors = Colors.light;
  // Màn chọn có thể được mở lại sau timer; khôi phục custom từ lựa chọn đang giữ ở màn cha.
  const [customMinutes, setCustomMinutes] = useState<number>(() =>
    [25, 45, 60].includes(selectedDuration) ? 90 : selectedDuration);
  const [showCustomStepper, setShowCustomStepper] = useState<boolean>(() =>
    ![25, 45, 60].includes(selectedDuration));
  const canStartSession = sensorAvailability.kind === 'ready';
  const choicesLocked = isStarting || isCancelling || Boolean(activeSession);
  const isCountdown = selectedMode === 'COUNTDOWN';

  return (
    <View style={styles.container}>
      <View style={styles.titleSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Solo Focus Mode</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Select discipline interval before placing phone face-down.
        </Text>
      </View>

      {activeSession ? (
        <GlassCard style={styles.activeSessionCard}>
          <Text style={[styles.activeSessionTitle, { color: colors.text }]}>Active session saved</Text>
          <Text style={[styles.activeSessionBody, { color: colors.textSecondary }]}>
            Continue your saved {activeSession.mode === 'COUNTDOWN'
              ? `${activeSession.durationSeconds / 60}-minute Countdown`
              : 'Stopwatch'} session from its current time.
          </Text>
          <PrimaryButton
            title={`Continue ${activeSession.mode === 'COUNTDOWN' ? 'Countdown' : 'Stopwatch'}`}
            onPress={onContinueSession}
            disabled={isStarting || isCancelling}
            accessibilityHint="Return to the active Solo timer"
            style={styles.cancelSessionButton}
          />
          <PrimaryButton
            title="Cancel session"
            variant="danger"
            onPress={onCancelSession}
            disabled={isStarting}
            style={styles.cancelSessionButton}
          />
        </GlassCard>
      ) : null}

      <View style={styles.modeSelector} accessibilityRole="tablist">
        {([
          { mode: 'COUNTDOWN' as const, title: 'Countdown Timer' },
          { mode: 'STOPWATCH' as const, title: 'Open-ended Stopwatch' },
        ]).map(({ mode, title }) => {
          const selected = selectedMode === mode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="tab"
              disabled={choicesLocked}
              accessibilityState={{ selected, disabled: choicesLocked }}
              onPress={() => onSelectMode(mode)}
              style={[styles.modeOption, selected && styles.modeOptionActive]}
            >
              <Text style={[styles.modeText, selected && styles.modeTextActive]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 4 Interval Cards */}
      <View style={[styles.cardsGrid, !isCountdown && styles.cardsGridDisabled]}>
        {[
          { duration: 25, title: 'Pomodoro Sprint', desc: 'Standard block', tag: 'Recommended' },
          { duration: 45, title: 'Deep Work Flow', desc: 'Cognitive peak', tag: 'Standard' },
          { duration: 60, title: 'Total Immersion', desc: 'Complex builds', tag: 'Intense' },
          { duration: customMinutes, title: 'Custom Stepper', desc: '±5m Stepper', tag: 'Variable' },
        ].map((item, idx) => {
          const isCustom = idx === 3;
          const isSelected = isCustom
            ? showCustomStepper
            : selectedDuration === item.duration && !showCustomStepper;

          return (
            <Pressable
              key={idx}
              disabled={!isCountdown || choicesLocked}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: !isCountdown || choicesLocked }}
              onPress={() => {
                if (isCustom) {
                  setShowCustomStepper(true);
                  onSelectDuration(customMinutes);
                } else {
                  setShowCustomStepper(false);
                  onSelectDuration(item.duration);
                }
              }}
              style={[
                styles.card,
                {
                  backgroundColor: Colors.light.authFormSurface,
                  borderColor: isSelected ? colors.authAccent : Colors.light.glassBorder,
                  shadowColor: Colors.light.glassShadow,
                },
                isSelected && styles.cardActive,
              ]}
            >
              <View style={styles.cardTop}>
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>{item.tag}</Text>
                </View>
                <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                  {isSelected && <Text style={styles.checkText}>✓</Text>}
                </View>
              </View>

              <Text style={styles.cardDuration}>
                {item.duration}
                <Text style={[styles.durationUnit, { color: colors.text }]}>m</Text>
              </Text>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Stepper adjustment row if custom */}
      {isCountdown && showCustomStepper && (
        <GlassCard style={styles.stepperCard}>
          <Text style={[styles.stepperTitle, { color: colors.text }]}>Adjust Custom Interval</Text>
          <View style={styles.stepperControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease duration by 5 minutes"
              disabled={choicesLocked || customMinutes <= 5}
              accessibilityState={{ disabled: choicesLocked || customMinutes <= 5 }}
              hitSlop={8}
              onPress={() => {
                const next = Math.max(5, customMinutes - 5);
                setCustomMinutes(next);
                onSelectDuration(next);
              }}
              style={styles.stepperBtn}
            >
              <Text style={styles.stepperBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValText}>{customMinutes}m</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase duration by 5 minutes"
              disabled={choicesLocked || customMinutes >= 180}
              accessibilityState={{ disabled: choicesLocked || customMinutes >= 180 }}
              hitSlop={8}
              onPress={() => {
                const next = Math.min(180, customMinutes + 5);
                setCustomMinutes(next);
                onSelectDuration(next);
              }}
              style={styles.stepperBtn}
            >
              <Text style={styles.stepperBtnText}>+</Text>
            </Pressable>
          </View>
        </GlassCard>
      )}

      <SensorAvailabilityPanel
        state={sensorAvailability}
        onRetry={onRetrySensorCheck}
        onOpenSettings={onOpenSettings}
      />

      {startError ? <Text accessibilityRole="alert" style={styles.startError}>{startError}</Text> : null}

      <PrimaryButton
        title={isStarting
          ? 'Saving session…'
          : isCancelling
            ? 'Cancelling session…'
          : activeSession
            ? `Continue ${activeSession.mode === 'COUNTDOWN' ? 'Countdown' : 'Stopwatch'}`
            : isCountdown
              ? `Start ${selectedDuration}m Solo Focus Session`
              : 'Start Stopwatch'}
        onPress={() => onStartSession(selectedMode, selectedDuration)}
        disabled={!canStartSession || isStarting || isCancelling}
        accessibilityState={{ disabled: !canStartSession || isStarting || isCancelling, busy: isStarting || isCancelling }}
        accessibilityHint={canStartSession ? undefined : 'The session starts after the accelerometer check is ready'}
        style={!canStartSession ? styles.startDisabled : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  startDisabled: {
    opacity: 0.55,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.84)',
  },
  modeOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modeOptionActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  modeText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeTextActive: {
    color: '#004AC6',
    fontWeight: '800',
  },
  cardsGridDisabled: {
    opacity: 0.4,
  },
  startError: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: 4,
  },
  activeSessionCard: {
    gap: 4,
    padding: 14,
  },
  activeSessionTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  activeSessionBody: {
    fontSize: 11,
    lineHeight: 16,
  },
  cancelSessionButton: {
    marginTop: 8,
  },
  titleSection: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    width: '48%',
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
  },
  cardActive: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tagPill: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2563EB',
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardDuration: {
    fontSize: 32,
    fontWeight: '900',
    color: '#2563EB',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  durationUnit: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  cardDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  stepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  stepperTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  stepperValText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#2563EB',
    minWidth: 36,
    textAlign: 'center',
  },
  readinessCard: {
    padding: 14,
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gyroBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gyroIcon: {
    fontSize: 16,
  },
  gyroTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  gyroSub: {
    fontSize: 10,
    color: '#065F46',
    fontWeight: '600',
    marginTop: 1,
  },
  armedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  armedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
  },
});
