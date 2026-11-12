import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../../constants/theme';

type Props = {
  colors: typeof Colors.light | typeof Colors.dark;
  disabledReason: string;
  onPress: () => void;
};

/**
 * Receipt-scan entry point for the Host bill form.
 * Intentionally unavailable until the authenticated Premium API exposes a
 * documented receipt-scanning contract; this component never fakes a scan.
 */
export function AiBillScanCard({ colors, disabledReason, onPress }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={[styles.iconSurface, { backgroundColor: colors.backgroundSelected }]}>
          <Ionicons name="scan-outline" size={21} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>AI bill scan</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>Read a receipt total, then review it before applying.</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="AI bill scan coming soon"
        accessibilityHint="Receipt scanning is not connected yet. Enter the amount manually below."
        onPress={onPress}
        style={({ pressed }) => [styles.action, { backgroundColor: colors.backgroundSelected, borderColor: colors.primary }, pressed && styles.pressed]}
      >
        <Ionicons name="scan-outline" size={19} color={colors.primary} />
        <Text style={[styles.actionText, { color: colors.primary }]}>AI scan coming soon</Text>
      </Pressable>
      <View style={styles.status}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>{disabledReason}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconSurface: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '800' },
  description: { fontSize: 13, lineHeight: 18 },
  action: { minHeight: 48, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 14 },
  actionText: { fontSize: 15, fontWeight: '700' },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 2 },
  statusText: { flex: 1, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.75 },
});
