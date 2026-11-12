import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { SensorAvailabilityPanel } from '../components/SensorAvailabilityPanel';
import { CustomDurationSlider } from '../components/CustomDurationSlider';
import {
  MAX_COUNTDOWN_DURATION_MINUTES,
  MIN_COUNTDOWN_DURATION_MINUTES,
} from '../features/solo/session-controller';
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
  onOpenHistory: () => void;
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
  onOpenHistory,
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
  const [showCustomSlider, setShowCustomSlider] = useState<boolean>(() =>
    ![25, 45, 60].includes(selectedDuration));
  const canStartSession = sensorAvailability.kind === 'ready';
  const choicesLocked = isStarting || isCancelling || Boolean(activeSession);
  const isCountdown = selectedMode === 'COUNTDOWN';
  const durationLabel = selectedDuration >= 60
    ? `${Math.floor(selectedDuration / 60)} hr${selectedDuration % 60 > 0 ? ` ${selectedDuration % 60} min` : ''}`
    : `${selectedDuration} min`;

  return (
    <View style={styles.container}>
      <View style={styles.titleSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Choose your duration</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Set a focus block, then place your phone face-down.
        </Text>
      </View>

      {sensorAvailability.kind === 'ready' ? (
        <View style={styles.statusHistoryRow}>
          <SensorAvailabilityPanel
            state={sensorAvailability}
            onRetry={onRetrySensorCheck}
            onOpenSettings={onOpenSettings}
            compactStyle={styles.sensorReadyCompact}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Open Solo history" onPress={onOpenHistory} style={({ pressed }) => [styles.historyAction, pressed && styles.historyActionPressed]}>
            {/* <Ionicons name="time-outline" size={18} color={colors.primary} /> */}
            <Text style={styles.historyActionText}>Solo history</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <SensorAvailabilityPanel
            state={sensorAvailability}
            onRetry={onRetrySensorCheck}
            onOpenSettings={onOpenSettings}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Open Solo history" onPress={onOpenHistory} style={({ pressed }) => [styles.historyActionUnavailable, pressed && styles.historyActionPressed]}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={styles.historyActionText}>Solo history</Text>
          </Pressable>
        </>
      )}

      {activeSession ? (
        <GlassCard style={styles.activeSessionCard}>
          <Text style={[styles.activeSessionTitle, { color: colors.text }]}>Active session</Text>
          <Text style={[styles.activeSessionBody, { color: colors.textSecondary }]}>
            Continue your {activeSession.mode === 'COUNTDOWN'
              ? `${activeSession.durationSeconds / 60}-minute countdown`
              : 'stopwatch'} session from its current time.
          </Text>
          <PrimaryButton
            title={`Continue ${activeSession.mode === 'COUNTDOWN' ? 'countdown' : 'stopwatch'}`}
            onPress={onContinueSession}
            disabled={isStarting || isCancelling}
            accessibilityHint="Return to the active focus session"
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
          { mode: 'COUNTDOWN' as const, title: 'Countdown timer' },
          { mode: 'STOPWATCH' as const, title: 'Open-ended stopwatch' },
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

      {/* Các lựa chọn thời lượng */}
      <View style={[styles.cardsGrid, !isCountdown && styles.cardsGridDisabled]}>
        {[
          { duration: 25, title: 'Pomodoro Sprint', desc: 'Standard focus block', tag: 'Recommended' },
          { duration: 45, title: 'Deep Work Flow', desc: 'For focused work', tag: 'Standard' },
          { duration: 60, title: 'Total Immersion', desc: 'For complex tasks', tag: 'Intense' },
          { duration: customMinutes, title: 'Custom duration', desc: showCustomSlider ? 'Drag below · 5-min steps' : 'Choose your own block', tag: 'Flexible' },
        ].map((item, idx) => {
          const isCustom = idx === 3;
          const isSelected = isCustom
            ? showCustomSlider
            : selectedDuration === item.duration && !showCustomSlider;

          return (
            <Pressable
              key={item.title}
              disabled={!isCountdown || choicesLocked}
              accessibilityRole="button"
              accessibilityLabel={`${item.duration} minutes, ${item.title}`}
              accessibilityState={{ selected: isSelected, disabled: !isCountdown || choicesLocked }}
              onPress={() => {
                if (isCustom) {
                  setShowCustomSlider(true);
                  onSelectDuration(customMinutes);
                } else {
                  setShowCustomSlider(false);
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
                <Text style={[styles.durationUnit, { color: colors.textSecondary }]}>min</Text>
              </Text>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
            </Pressable>
          );
        })}
      </View>

      {isCountdown && showCustomSlider ? (
        <CustomDurationSlider
          value={customMinutes}
          disabled={choicesLocked}
          onChange={minutes => {
            const next = Math.max(MIN_COUNTDOWN_DURATION_MINUTES, Math.min(MAX_COUNTDOWN_DURATION_MINUTES, minutes));
            setCustomMinutes(next);
            onSelectDuration(next);
          }}
        />
      ) : null}

      {startError ? <Text accessibilityRole="alert" style={styles.startError}>{startError}</Text> : null}

      <PrimaryButton
        title={isStarting
          ? 'Starting session…'
          : isCancelling
            ? 'Cancelling session…'
          : activeSession
            ? `Continue ${activeSession.mode === 'COUNTDOWN' ? 'countdown' : 'stopwatch'}`
            : isCountdown
              ? `Start focus · ${durationLabel}`
              : 'Start stopwatch'}
        onPress={() => onStartSession(selectedMode, selectedDuration)}
        disabled={!canStartSession || isStarting || isCancelling}
        accessibilityState={{ disabled: !canStartSession || isStarting || isCancelling, busy: isStarting || isCancelling }}
        accessibilityHint={canStartSession ? undefined : 'The session can start when the motion sensor is ready'}
        style={[styles.startCallToAction, !canStartSession && styles.startDisabled]}
        icon={<Ionicons name="play" size={18} color="#FFFFFF" />}
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
  startCallToAction: {
    height: 56,
    borderRadius: 22,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 3,
    minHeight: 44,
    padding: 3,
    borderRadius: 999,
    backgroundColor: Colors.light.backgroundElement,
  },
  modeOption: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modeOptionActive: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  modeText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeTextActive: {
    color: Colors.light.primary,
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
  statusHistoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sensorReadyCompact: { flex: 1, paddingHorizontal: 0 },
  historyAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 14 },
  historyActionUnavailable: { minHeight: 44, alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 14 },
  historyActionPressed: { backgroundColor: 'rgba(37,99,235,0.08)' },
  historyActionText: { color: Colors.light.primary, fontSize: 12, fontWeight: '700' },
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
    backgroundColor: 'rgba(37,99,235,0.1)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: { color: Colors.light.primary, fontSize: 10, lineHeight: 14, fontWeight: '800' },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  checkText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  cardDuration: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    color: Colors.light.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  durationUnit: { fontSize: 14, fontWeight: '700' },
  cardTitle: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  cardDesc: { fontSize: 11, lineHeight: 15, marginTop: 2 },
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
