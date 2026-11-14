import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../../constants/theme';
import type { ReceiptScanResult } from '../receipt-scan-api';

type Props = {
  colors: typeof Colors.light | typeof Colors.dark;
  isPremium: boolean;
  isScanning: boolean;
  scanError?: string;
  result?: ReceiptScanResult | null;
  onCapture: () => void;
  onSelectPhoto: () => void;
  onOpenPremium: () => void;
  onConfirm: (amountVnd: number) => void;
  onReject: () => void;
};

function evidenceLabel(result: ReceiptScanResult): string | null {
  const label = result.evidence?.label;
  const text = result.evidence?.amount_text ?? result.evidence?.text;
  if (typeof label === 'string' && typeof text === 'string') return `${label}: ${text}`;
  if (typeof label === 'string') return label;
  if (typeof text === 'string') return text;
  return null;
}

function ActionButton({ label, icon, colors, onPress, disabled = false, busy = false }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; colors: typeof Colors.light | typeof Colors.dark;
  onPress: () => void; disabled?: boolean; busy?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: colors.backgroundSelected, borderColor: colors.primary }, pressed && styles.pressed, disabled && styles.disabled]}>
      {busy ? <ActivityIndicator color={colors.primary} /> : <Ionicons name={icon} size={19} color={colors.primary} />}
      <Text style={[styles.actionText, { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

export function AiBillScanCard({ colors, isPremium, isScanning, scanError, result, onCapture, onSelectPhoto, onOpenPremium, onConfirm, onReject }: Props) {
  const suggestedAmount = result?.suggested_amount ?? result?.amount ?? null;
  const canApply = suggestedAmount != null && suggestedAmount >= 1_000;
  const evidence = result ? evidenceLabel(result) : null;
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={[styles.iconSurface, { backgroundColor: colors.backgroundSelected }]}>
          <Ionicons name="scan-outline" size={21} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>AI bill scan</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>Scan a receipt total, review it, then choose whether to use it.</Text>
        </View>
      </View>

      {!isPremium ? (
        <>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>Receipt scanning is included with active Premium.</Text>
          <ActionButton label="View Premium" icon="diamond-outline" colors={colors} onPress={onOpenPremium} />
        </>
      ) : result ? (
        <View accessibilityLabel="Receipt scan suggestion" style={[styles.result, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
          {canApply ? (
            <>
              <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Suggested total</Text>
              <Text accessibilityRole="header" style={[styles.amount, { color: colors.text }]}>{suggestedAmount.toLocaleString('vi-VN')} VND</Text>
              {evidence ? <Text style={[styles.statusText, { color: colors.textSecondary }]}>Evidence: {evidence}</Text> : null}
              {result.warnings.map((warning, index) => <Text key={`${index}-${warning}`} style={[styles.warning, { color: colors.textSecondary }]}>{warning}</Text>)}
              <View style={styles.actions}>
                <ActionButton label="Use this amount" icon="checkmark-circle-outline" colors={colors} onPress={() => onConfirm(suggestedAmount!)} />
                <ActionButton label="Keep current amount" icon="close-circle-outline" colors={colors} onPress={onReject} />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>No clear total was found. Enter the amount manually below.</Text>
              {result.warnings.map((warning, index) => <Text key={`${index}-${warning}`} style={[styles.warning, { color: colors.textSecondary }]}>{warning}</Text>)}
              <ActionButton label="Dismiss scan result" icon="close-outline" colors={colors} onPress={onReject} />
            </>
          )}
        </View>
      ) : (
        <View style={styles.actions}>
          <ActionButton label="Take receipt photo" icon="camera-outline" colors={colors} onPress={onCapture} disabled={isScanning} busy={isScanning} />
          <ActionButton label="Choose receipt photo" icon="image-outline" colors={colors} onPress={onSelectPhoto} disabled={isScanning} busy={isScanning} />
        </View>
      )}

      {isScanning ? <View accessibilityLiveRegion="polite" style={styles.status}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>Scanning receipt…</Text>
      </View> : null}
      {scanError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{scanError}</Text> : null}
      <Text style={[styles.helper, { color: colors.textSecondary }]}>Every suggested amount needs your confirmation. The scan never publishes the bill.</Text>
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
  actions: { gap: 8 },
  action: { minHeight: 48, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 14 },
  actionText: { fontSize: 15, fontWeight: '700' },
  result: { gap: 8, borderWidth: 1, borderRadius: 14, padding: 14 },
  resultLabel: { fontSize: 13 },
  amount: { fontSize: 22, fontWeight: '800' },
  warning: { fontSize: 12, lineHeight: 17 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 12, lineHeight: 17 },
  helper: { fontSize: 12, lineHeight: 17 },
  error: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
});
