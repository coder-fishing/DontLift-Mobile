import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';
import { GlassCard } from '../components/GlassCard';
import { GlassPill } from '../components/GlassPill';
import { SensorAvailabilityPanel } from '../components/SensorAvailabilityPanel';
import type { SensorAvailabilityState } from '../features/sensors/sensor-adapter';

interface HardwareDiagnosticsScreenProps {
  sensorAvailability: SensorAvailabilityState;
  onRetrySensorCheck: () => void;
  onOpenSettings: () => void;
}

export function HardwareDiagnosticsScreen({
  sensorAvailability,
  onRetrySensorCheck,
  onOpenSettings,
}: HardwareDiagnosticsScreenProps) {
  const colors = Colors.light;

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.badgeRow}>
          <GlassPill style={styles.pill}>
            <Text style={[styles.badgeText, { color: colors.authAccent }]}>Diagnostics Mode</Text>
          </GlassPill>
          <Text style={[styles.errCode, { color: colors.textSecondary }]}>SL-005</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Motion sensor availability</Text>
      </View>

      <GlassCard style={styles.heroCard}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>📡</Text>
        </View>
        <Text style={[styles.heroCardTitle, { color: colors.text }]}>Accelerometer check</Text>
        <Text style={[styles.heroCardDesc, { color: colors.textSecondary }]}>DontLift checks that the device can provide a live accelerometer reading before a Solo focus session starts. Gyroscope, light sensor and calibration are not checked here.</Text>
      </GlassCard>

      <SensorAvailabilityPanel
        state={sensorAvailability}
        onRetry={onRetrySensorCheck}
        onOpenSettings={onOpenSettings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  hero: { gap: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  errCode: { fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  heroCard: { alignItems: 'center', paddingVertical: 18, gap: 6 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.light.authGlow, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  icon: { fontSize: 24 },
  heroCardTitle: { fontSize: 15, fontWeight: '800' },
  heroCardDesc: { fontSize: 11, textAlign: 'center', paddingHorizontal: 16, lineHeight: 16 },
});
