import React from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GlassCard } from '../../../components/GlassCard';
import { Colors } from '../../../constants/theme';
import { AiBillScanCard } from './AiBillScanCard';
import type { ReceiptScanResult } from '../receipt-scan-api';

type SplitMode = 'ROOM_SCORE' | 'CUSTOM_PERCENT';

type Props = {
  colors: typeof Colors.light | typeof Colors.dark;
  isPremium: boolean;
  isScanning: boolean;
  isSavingEvidence: boolean;
  hasSavedEvidence: boolean;
  previewUri?: string;
  scanError?: string;
  evidenceError?: string;
  scanResult: ReceiptScanResult | null;
  onCapture: () => void;
  onSelectPhoto: () => void;
  onOpenPremium: () => void;
  onConfirmReceipt: (amount: number) => void;
  onRejectReceipt: () => void;
  onContinueWithoutEvidence: () => void;
  isPublishing: boolean;
  pendingTotalVnd?: number;
  billInput: string;
  onBillInputChange: (value: string) => void;
  submitted: boolean;
  validTotal: boolean;
  onSubmit: () => void;
  onBlur: () => void;
  splitMode: SplitMode;
  onSplitModeChange: (mode: SplitMode) => void;
  percentTotalBps: number;
  percentError?: string;
};

export function InitialBillSplitCard({
  colors,
  isPremium,
  isScanning,
  isSavingEvidence,
  hasSavedEvidence,
  previewUri,
  scanError,
  evidenceError,
  scanResult,
  onCapture,
  onSelectPhoto,
  onOpenPremium,
  onConfirmReceipt,
  onRejectReceipt,
  onContinueWithoutEvidence,
  isPublishing,
  pendingTotalVnd,
  billInput,
  onBillInputChange,
  submitted,
  validTotal,
  onSubmit,
  onBlur,
  splitMode,
  onSplitModeChange,
  percentTotalBps,
  percentError,
}: Props) {
  return (
    <GlassCard style={[styles.card, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder, shadowColor: colors.glassShadow }]}>
      <AiBillScanCard
        colors={colors}
        isPremium={isPremium}
        isScanning={isScanning}
        isSavingEvidence={isSavingEvidence}
        hasSavedEvidence={hasSavedEvidence}
        previewUri={previewUri}
        scanError={scanError}
        evidenceError={evidenceError}
        result={scanResult}
        onCapture={onCapture}
        onSelectPhoto={onSelectPhoto}
        onOpenPremium={onOpenPremium}
        onConfirm={onConfirmReceipt}
        onReject={onRejectReceipt}
        onContinueWithoutEvidence={onContinueWithoutEvidence}
      />
      <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Bill total</Text>
      <Text style={[styles.helper, { color: colors.textSecondary }]}>Minimum 1,000 VND.</Text>
      <View style={[styles.inputWrap,
        { borderColor: submitted && !validTotal ? colors.error : colors.border, backgroundColor: colors.inputSurface },
        submitted && !validTotal && styles.inputInvalid]}>
        <Text accessibilityElementsHidden style={[styles.currency, { color: colors.textSecondary }]}>₫</Text>
        <TextInput
          accessibilityLabel="Total bill amount in Vietnamese dong"
          accessibilityHint="Enter a whole number of dong, at least 1,000. A preview appears below."
          editable={!isPublishing && pendingTotalVnd == null}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
          value={pendingTotalVnd == null ? billInput : String(pendingTotalVnd)}
          onChangeText={onBillInputChange}
          onSubmitEditing={Keyboard.dismiss}
          onBlur={onBlur}
          placeholder="e.g. 450000"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text }]}
        />
      </View>
      {submitted && !validTotal ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>Enter a whole amount of at least 1,000 VND.</Text> : null}
      {pendingTotalVnd != null ? <Text style={[styles.helper, { color: colors.textSecondary }]}>Retrying the same request so a delayed commit cannot publish twice.</Text> : null}
      <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
      <View style={styles.splitMethod}>
        <View style={styles.splitMethodHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Split method</Text>
          <View style={[styles.methodOptions, { backgroundColor: colors.backgroundElement }]}>
            {(['ROOM_SCORE', 'CUSTOM_PERCENT'] as const).map(method => {
              const selected = splitMode === method;
              return (
                <Pressable
                  key={method}
                  accessibilityRole="button"
                  accessibilityLabel={method === 'ROOM_SCORE' ? 'Split by room score' : 'Enter custom percentages'}
                  accessibilityState={{ selected }}
                  disabled={pendingTotalVnd != null || isPublishing}
                  onPress={() => onSplitModeChange(method)}
                  style={[styles.methodOption, { backgroundColor: selected ? '#2563EB' : 'transparent' }]}
                >
                  <Text style={[styles.methodTagText, { color: selected ? '#FFFFFF' : '#334155' }]}>{method === 'ROOM_SCORE' ? 'Room score' : 'Custom %'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          {splitMode === 'ROOM_SCORE'
            ? 'Calculated from finalized room scores. You can adjust shares after publishing, before anyone is marked paid.'
            : 'Set each member’s share. Percentages must add up to exactly 100%.'}
        </Text>
        {splitMode === 'CUSTOM_PERCENT' ? <Text style={[styles.percentTotal, { color: percentTotalBps === 10_000 ? colors.success : colors.textSecondary }]}>Total {(percentTotalBps / 100).toFixed(2)}% / 100%</Text> : null}
        {splitMode === 'CUSTOM_PERCENT' && percentError ? <Text accessibilityRole="alert" style={[styles.helper, { color: colors.error }]}>{percentError}</Text> : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 18, borderRadius: 24 },
  sectionDivider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  sectionTitle: { color: Colors.light.text, fontSize: 17, fontWeight: '800' },
  helper: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  inputWrap: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  inputInvalid: { borderWidth: 2 },
  currency: { color: Colors.light.textSecondary, fontSize: 21, fontWeight: '700' },
  input: { flex: 1, minHeight: 52, color: Colors.light.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  error: { color: Colors.light.error, fontSize: 13, lineHeight: 19 },
  splitMethod: { gap: 6 },
  splitMethodHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  methodOptions: { flexDirection: 'row', gap: 3, borderRadius: 11, padding: 3 },
  methodOption: { minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, borderRadius: 8 },
  methodTagText: { fontSize: 13, fontWeight: '700' },
  percentTotal: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
