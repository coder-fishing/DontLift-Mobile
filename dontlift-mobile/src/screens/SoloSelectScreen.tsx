import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';

interface SoloSelectScreenProps {
  selectedDuration: number;
  onSelectDuration: (mins: number) => void;
  onStartSession: (mins: number) => void;
}

export function SoloSelectScreen({
  selectedDuration,
  onSelectDuration,
  onStartSession,
}: SoloSelectScreenProps) {
  const [customMinutes, setCustomMinutes] = useState<number>(90);
  const [showCustomStepper, setShowCustomStepper] = useState<boolean>(false);

  return (
    <View style={styles.container}>
      <View style={styles.titleSection}>
        <Text style={styles.sectionTitle}>Solo Focus Mode</Text>
        <Text style={styles.sectionDesc}>
          Select discipline interval before placing phone face-down.
        </Text>
      </View>

      {/* 4 Interval Cards */}
      <View style={styles.cardsGrid}>
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
            <TouchableOpacity
              key={idx}
              activeOpacity={0.8}
              onPress={() => {
                if (isCustom) {
                  setShowCustomStepper(true);
                  onSelectDuration(customMinutes);
                } else {
                  setShowCustomStepper(false);
                  onSelectDuration(item.duration);
                }
              }}
              style={[styles.card, isSelected ? styles.cardActive : styles.cardInactive]}
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
                <Text style={styles.durationUnit}>m</Text>
              </Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stepper adjustment row if custom */}
      {showCustomStepper && (
        <GlassCard style={styles.stepperCard}>
          <Text style={styles.stepperTitle}>Adjust Custom Interval</Text>
          <View style={styles.stepperControls}>
            <TouchableOpacity
              onPress={() => {
                const next = Math.max(5, customMinutes - 5);
                setCustomMinutes(next);
                onSelectDuration(next);
              }}
              style={styles.stepperBtn}
            >
              <Text style={styles.stepperBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepperValText}>{customMinutes}m</Text>
            <TouchableOpacity
              onPress={() => {
                const next = Math.min(180, customMinutes + 5);
                setCustomMinutes(next);
                onSelectDuration(next);
              }}
              style={styles.stepperBtn}
            >
              <Text style={styles.stepperBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      )}

      {/* Gyroscope Readiness */}
      <GlassCard style={styles.readinessCard}>
        <View style={styles.readinessRow}>
          <View style={styles.gyroBadge}>
            <Text style={styles.gyroIcon}>🔄</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.gyroTitle}>Phone-Down Detection Ready</Text>
            <Text style={styles.gyroSub}>50Hz Gyroscope Active • 3.0s Grace Window</Text>
          </View>
          <View style={styles.armedBadge}>
            <Text style={styles.armedBadgeText}>ARMED</Text>
          </View>
        </View>
      </GlassCard>

      <PrimaryButton
        title={`Start ${selectedDuration}m Solo Focus Session`}
        onPress={() => onStartSession(selectedDuration)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
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
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
  },
  cardActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  cardInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderColor: 'rgba(255, 255, 255, 0.9)',
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
