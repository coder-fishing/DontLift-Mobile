import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';
import { GlassCard } from './GlassCard';
import { PrimaryButton } from './PrimaryButton';
import type { SensorAvailabilityState } from '../features/sensors/sensor-adapter';

interface SensorAvailabilityPanelProps {
  state: SensorAvailabilityState;
  onRetry: () => void;
  onOpenSettings: () => void;
}

function describeState(state: SensorAvailabilityState) {
  switch (state.kind) {
    case 'checking':
      return { title: 'Checking accelerometer…', detail: 'Waiting for a live motion reading.', action: 'Checking…', disabled: true };
    case 'ready':
      return { title: 'Accelerometer ready', detail: 'A live motion reading was received. You can start a focus session.', action: 'Check again', disabled: false };
    case 'permission-denied':
      return state.canAskAgain
        ? { title: 'Motion permission is needed', detail: 'Allow motion access so DontLift can check the accelerometer before focus.', action: 'Allow motion access', disabled: false }
        : { title: 'Motion permission is blocked', detail: 'Enable motion access for DontLift in system settings, then check again.', action: 'Open settings', disabled: false };
    case 'unavailable':
      return { title: 'Accelerometer unavailable', detail: 'This device cannot provide accelerometer readings. A focus session cannot start.', action: 'Check again', disabled: false };
    case 'error':
      return { title: 'Could not read the accelerometer', detail: 'The sensor did not respond. Retry the check before starting focus.', action: 'Retry sensor check', disabled: false };
  }
}

export function SensorAvailabilityPanel({ state, onRetry, onOpenSettings }: SensorAvailabilityPanelProps) {
  const colors = Colors.light;
  const description = describeState(state);
  const isReady = state.kind === 'ready';

  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.indicator, { backgroundColor: isReady ? colors.authAccent : state.kind === 'checking' ? colors.textSecondary : colors.error }]} />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>{description.title}</Text>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>{description.detail}</Text>
        </View>
      </View>
      {!isReady && (
        <PrimaryButton
          title={description.action}
          onPress={state.kind === 'permission-denied' && !state.canAskAgain ? onOpenSettings : onRetry}
          disabled={description.disabled}
          accessibilityHint="Rechecks accelerometer availability and motion permission"
          style={description.disabled ? styles.disabledButton : undefined}
        />
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  indicator: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 13, fontWeight: '800' },
  detail: { fontSize: 11, lineHeight: 16 },
  disabledButton: { opacity: 0.6 },
});
