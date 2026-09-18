import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { GlassPill } from '../components/GlassPill';
import { PrimaryButton } from '../components/PrimaryButton';

export function HardwareDiagnosticsScreen() {
  const [calibrating, setCalibrating] = useState<boolean>(false);
  const [luxStatus, setLuxStatus] = useState<string>('STANDBY');

  const handleCalibrate = () => {
    setCalibrating(true);
    setTimeout(() => {
      setCalibrating(false);
      setLuxStatus('ACTIVE');
      Alert.alert('✅ Calibration Complete', 'All motion sensors calibrated at 50Hz.');
    }, 1200);
  };

  return (
    <View style={styles.container}>
      {/* Title */}
      <View style={styles.hero}>
        <View style={styles.badgeRow}>
          <GlassPill style={{ paddingVertical: 3 }}>
            <Text style={styles.badgeText}>Diagnostics Mode</Text>
          </GlassPill>
          <Text style={styles.errCode}>ERR_SENS_0x4F</Text>
        </View>
        <Text style={styles.title}>Sensor Diagnostic & Tabletop Leveling</Text>
      </View>

      {/* Hero Card */}
      <GlassCard style={styles.heroCard}>
        <View style={styles.iconCircle}>
          <Text style={{ fontSize: 24 }}>📡</Text>
        </View>
        <Text style={styles.heroCardTitle}>Motion Sensor Telemetry</Text>
        <Text style={styles.heroCardDesc}>
          Continuous accelerometer and 50Hz gyroscope telemetry detecting flat tabletop placement.
        </Text>
      </GlassCard>

      {/* Monitors List */}
      <GlassCard style={styles.monitorsCard}>
        <Text style={styles.monitorsHeader}>Subsystem Telemetry (3 Monitors Active)</Text>

        <View style={styles.monitorRow}>
          <View style={styles.monitorIcon}>
            <Text>⚡</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.monitorTitle}>3-Axis Accelerometer</Text>
            <Text style={styles.monitorSub}>Sampling Rate: 50Hz</Text>
          </View>
          <View style={styles.statusPillGreen}>
            <Text style={styles.statusPillGreenText}>OK</Text>
          </View>
        </View>

        <View style={styles.monitorRow}>
          <View style={styles.monitorIcon}>
            <Text>🔄</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.monitorTitle}>50Hz Precision Gyroscope</Text>
            <Text style={styles.monitorSub}>Yaw, pitch, roll tracking</Text>
          </View>
          <View style={styles.statusPillGreen}>
            <Text style={styles.statusPillGreenText}>OK</Text>
          </View>
        </View>

        <View style={styles.monitorRow}>
          <View style={styles.monitorIcon}>
            <Text>💡</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.monitorTitle}>Ambient Lux Photocell</Text>
            <Text style={styles.monitorSub}>Tabletop screen-down check</Text>
          </View>
          <View style={styles.statusPillBlue}>
            <Text style={styles.statusPillBlueText}>{luxStatus}</Text>
          </View>
        </View>
      </GlassCard>

      <PrimaryButton
        title={calibrating ? 'Calibrating Sensors at 50Hz...' : 'Run Tabletop Sensor Calibration'}
        onPress={handleCalibrate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  hero: {
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  errCode: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    fontFamily: 'monospace',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 6,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(37,99,235,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  heroCardDesc: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 16,
  },
  monitorsCard: {
    padding: 16,
    gap: 12,
  },
  monitorsHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  monitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    padding: 10,
    borderRadius: 12,
  },
  monitorIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monitorTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  monitorSub: {
    fontSize: 10,
    color: '#64748B',
  },
  statusPillGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillGreenText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  statusPillBlue: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillBlueText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
});
