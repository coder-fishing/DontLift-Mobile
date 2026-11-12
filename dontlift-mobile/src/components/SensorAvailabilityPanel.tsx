import React from 'react';
import { Text, View, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { PrimaryButton } from './PrimaryButton';
import type { SensorAvailabilityState } from '../features/sensors/sensor-adapter';

interface SensorAvailabilityPanelProps {
  state: SensorAvailabilityState;
  onRetry: () => void;
  onOpenSettings: () => void;
  compactStyle?: ViewStyle;
}

function describeState(state: SensorAvailabilityState) {
  switch (state.kind) {
    case 'checking':
      return { title: 'Checking motion sensor…', detail: 'Waiting for a live motion reading.', action: 'Checking…', disabled: true };
    case 'ready':
      return { title: 'Accelerometer ready', detail: 'A live motion reading was received. You can start a focus session.', action: 'Check again', disabled: false };
    case 'permission-denied':
      return state.canAskAgain
        ? { title: 'Motion permission needed', detail: 'Allow motion access so DontLift can check the accelerometer before focus.', action: 'Allow motion access', disabled: false }
        : { title: 'Motion permission is blocked', detail: 'Enable motion access for DontLift in system settings, then check again.', action: 'Open settings', disabled: false };
    case 'unavailable':
      return { title: 'Accelerometer unavailable', detail: 'This device cannot provide accelerometer readings. A focus session cannot start.', action: 'Check again', disabled: false };
    case 'error':
      return { title: 'Could not read the accelerometer', detail: 'The sensor did not respond. Retry the check before starting focus.', action: 'Retry sensor check', disabled: false };
  }
}

export function SensorAvailabilityPanel({ state, onRetry, onOpenSettings, compactStyle }: SensorAvailabilityPanelProps) {
  const colors = Colors.light;
  const description = describeState(state);
  const isReady = state.kind === 'ready';

  if (isReady) {
    return (
      <View accessibilityRole="text" style={[styles.readyRow, compactStyle]}>
        <View style={styles.readyBadge}>
          <Ionicons name="checkmark" size={14} color={colors.success} />
        </View>
        <Text style={[styles.readyText, { color: colors.textSecondary }]}>Motion sensor ready</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.statusBadge, { backgroundColor: isReady ? colors.successSurface : colors.backgroundSelected }]}>
          <Ionicons name={isReady ? 'checkmark' : state.kind === 'checking' ? 'time-outline' : 'alert-outline'} size={16} color={isReady ? colors.success : state.kind === 'checking' ? colors.textSecondary : colors.error} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>{description.title}</Text>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>{description.detail}</Text>
        </View>
      </View>
      <PrimaryButton
        title={description.action}
        onPress={state.kind === 'permission-denied' && !state.canAskAgain ? onOpenSettings : onRetry}
        disabled={description.disabled}
        accessibilityHint="Recheck accelerometer availability and motion permission"
        style={description.disabled ? styles.disabledButton : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: 18, backgroundColor: Colors.light.backgroundElement, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusBadge: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  readyRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  readyBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.successSurface },
  readyText: { fontSize: 12, fontWeight: '700' },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 13, fontWeight: '800' },
  detail: { fontSize: 12, lineHeight: 18 },
  disabledButton: { opacity: 0.6 },
});
