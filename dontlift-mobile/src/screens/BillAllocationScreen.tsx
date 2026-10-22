import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, useColorScheme, View,
} from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { Colors } from '../constants/theme';
import { formatVND } from '../constants';
import { calculateDefaultBillShares } from '../features/settlement/bill-allocation';
import type { BillShare } from '../features/settlement/bill-repository';
import type { PublishedBillState } from '../features/settlement/published-bill-listener';

export type BillAllocationMember = { uid: string; displayName: string; penaltyScore: number };

type Props = {
  roomId: string;
  mode: 'host' | 'member';
  members: readonly BillAllocationMember[];
  state: PublishedBillState;
  isOnline: boolean;
  isPublishing: boolean;
  pendingTotalVnd?: number;
  publishError?: string;
  onPublish: (totalBillVnd: number) => void;
  onRetry: () => void;
  onRetryPublish: () => void;
  onBack: () => void;
};

function shareLabel(member: BillAllocationMember | undefined): string {
  return member?.displayName.trim() || 'Participant';
}

export function BillAllocationScreen({
  roomId, mode, members, state, isOnline, isPublishing, pendingTotalVnd, publishError,
  onPublish, onRetry, onRetryPublish, onBack,
}: Props) {
  const colors = useColorScheme() === 'dark' ? Colors.dark : Colors.light;
  const [billInput, setBillInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const host = mode === 'host';
  const parsedTotal = pendingTotalVnd ?? (billInput ? Number(billInput.replace(/\D/g, '')) : 0);
  const validTotal = Number.isSafeInteger(parsedTotal) && parsedTotal >= 1_000;
  const preview = useMemo(() => {
    if (!host || !validTotal || members.length === 0) return null;
    try {
      return calculateDefaultBillShares(parsedTotal, members);
    } catch {
      return null;
    }
  }, [host, validTotal, parsedTotal, members]);
  const confirmedBill = state.bill ?? null;
  const displayedShares: readonly BillShare[] = confirmedBill?.shares ?? preview?.shares ?? [];
  const membersByUid = useMemo(() => new Map(members.map(member => [member.uid, member])), [members]);

  const requestPublish = () => {
    if (!preview || !isOnline || isPublishing) return;
    Keyboard.dismiss();
    Alert.alert(
      'Publish this bill split?',
      `${formatVND(preview.totalBillVnd)} VND will be split across ${preview.shares.length} members. You can review the preview below. Publishing is one-time for this room.`,
      [
        { text: 'Review again', style: 'cancel' },
        { text: 'Publish once', onPress: () => onPublish(preview.totalBillVnd) },
      ],
    );
  };

  const stateCopy = state.kind === 'loading' ? 'Checking the current room bill…'
    : state.kind === 'unpublished' ? confirmedBill
      ? 'The current room response does not show a published bill. Showing the last confirmed breakdown.'
      : host ? undefined : 'The Host has not published a bill split yet.'
      : state.kind === 'cached' ? 'Showing a saved copy. Reconnect to confirm the current published result.'
        : state.kind === 'error' ? 'Could not load the published breakdown.' : undefined;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={displayedShares}
      keyExtractor={item => item.uid}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={(
        <View style={styles.headerContent}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to group summary"
            onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={[styles.backText, { color: colors.primary }]}>‹  Group summary</Text>
          </Pressable>

          <GlassCard style={[styles.hero, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder, shadowColor: colors.glassShadow }]}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>ROOM SETTLEMENT</Text>
            <Text style={[styles.title, { color: colors.text }]}>{confirmedBill ? 'Published shares' : host ? 'Split the room bill' : 'Bill breakdown'}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {host
                ? 'Review each member’s amount before publishing. The Host device calculates from the finalized room scores.'
                : 'These are the final amounts published by the Host for this room.'}
            </Text>
            {confirmedBill ? (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Room total</Text>
                <Text accessibilityRole="text" style={[styles.totalValue, { color: colors.text }]}>{formatVND(confirmedBill.totalBillVnd)} VND</Text>
              </View>
            ) : null}
          </GlassCard>

          {host && !confirmedBill ? (
            <GlassCard style={[styles.entryCard, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder, shadowColor: colors.glassShadow }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Bill total</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>Enter the full amount from the receipt. Minimum 1,000 VND.</Text>
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
                  onChangeText={value => setBillInput(value.replace(/\D/g, ''))}
                  onSubmitEditing={Keyboard.dismiss}
                  onBlur={() => setSubmitted(true)}
                  placeholder="e.g. 450000"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { color: colors.text }]}
                />
              </View>
              {submitted && !validTotal ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>Enter a whole amount of at least 1,000 VND.</Text> : null}
              {pendingTotalVnd != null ? <Text style={[styles.helper, { color: colors.textSecondary }]}>Retrying the same request so a delayed commit cannot publish twice.</Text> : null}
            </GlassCard>
          ) : null}

          {stateCopy ? (
            <GlassCard style={[styles.stateCard, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder, shadowColor: colors.glassShadow }]}>
              {state.kind === 'loading' ? <ActivityIndicator accessibilityLabel="Checking published bill" color={colors.primary} /> : null}
              <Text accessibilityRole={state.kind === 'error' ? 'alert' : undefined} style={[styles.stateText, { color: colors.textSecondary }]}>{stateCopy}</Text>
              {state.kind === 'error' ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Retry loading room bill"
                  onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                  <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
                </Pressable>
              ) : null}
            </GlassCard>
          ) : null}

          {host && !confirmedBill ? (
            <View style={styles.previewHeading}>
              <View style={styles.previewCopy}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Preview</Text>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>This stays private until you publish.</Text>
              </View>
              <Text style={[styles.memberCount, { color: colors.textSecondary }]}>{members.length} {members.length === 1 ? 'member' : 'members'}</Text>
            </View>
          ) : confirmedBill ? (
            <View style={styles.previewHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Final amounts</Text>
              <Text style={[styles.memberCount, { color: colors.textSecondary }]}>{confirmedBill.shares.length} {confirmedBill.shares.length === 1 ? 'member' : 'members'}</Text>
            </View>
          ) : null}

          {host && !confirmedBill && preview ? (
            <Text style={[styles.previewTotal, { color: colors.textSecondary }]}>Total · {formatVND(preview.totalBillVnd)} VND</Text>
          ) : null}
        </View>
      )}
      renderItem={({ item, index }) => {
        const member = membersByUid.get(item.uid);
        return (
          <View style={[styles.shareRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.rowIndex, { backgroundColor: colors.backgroundElement }]}><Text style={[styles.rowIndexText, { color: colors.textSecondary }]}>{String(index + 1).padStart(2, '0')}</Text></View>
            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={2}>{shareLabel(member)}</Text>
            </View>
            <Text accessibilityLabel={`${shareLabel(member)} pays ${formatVND(item.shareVnd)} Vietnamese dong`}
              style={[styles.shareAmount, { color: colors.text }]}>{formatVND(item.shareVnd)} VND</Text>
          </View>
        );
      }}
      ListEmptyComponent={host && validTotal
        ? <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No room members are available for this calculation.</Text>
        : null}
      ListFooterComponent={(
        <View style={styles.footer}>
          {confirmedBill ? (
            <GlassCard style={[styles.publishedCard, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder, shadowColor: colors.glassShadow }]}>
              <Text style={[styles.publishedTitle, { color: colors.primary }]}>{state.kind === 'published' ? 'Published to this room' : 'Saved copy'}</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>
                {state.kind === 'published'
                  ? 'The Host calculated this breakdown on their device from the room’s finalized scores. Members can review it until payment details expire.'
                  : 'These amounts were confirmed earlier. Reconnect or retry to check the current room bill.'}
              </Text>
            </GlassCard>
          ) : null}
          {host && !confirmedBill ? (
            <>
              {publishError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{publishError}</Text> : null}
              {!isOnline ? <Text style={[styles.helper, { color: colors.textSecondary }]}>Connect to the internet to publish. The request is never queued offline.</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={pendingTotalVnd == null ? 'Publish bill shares once' : 'Retry publishing the same bill request'}
                accessibilityState={{ disabled: !preview || !isOnline || isPublishing }}
                disabled={!preview || !isOnline || isPublishing}
                onPress={pendingTotalVnd == null ? requestPublish : onRetryPublish}
                style={({ pressed }) => [styles.publishButton, pressed && styles.pressed,
                  (!preview || !isOnline || isPublishing) && styles.disabled]}
              >
                {isPublishing ? <ActivityIndicator color={colors.onPrimary} /> : null}
                <Text style={[styles.publishText, { color: colors.onPrimary }]}>{isPublishing ? 'Publishing…' : pendingTotalVnd == null ? 'Publish shares once' : 'Retry publish'}</Text>
              </Pressable>
              <Text style={[styles.oneTimeNote, { color: colors.textSecondary }]}>Check the preview before publishing. Published shares cannot be changed in this slice.</Text>
            </>
          ) : null}
          {host && !confirmedBill ? <Text style={[styles.authorityNote, { color: colors.textSecondary }]}>Rules authorize the Host and room state. They do not verify the calculation or prove that every member was included.</Text> : null}
          {confirmedBill ? <Text style={[styles.roomReference, { color: colors.textSecondary }]}>Room · {roomId.slice(0, 8).toUpperCase()}</Text> : null}
        </View>
      )}
    />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, gap: 10 },
  headerContent: { gap: 14 },
  backButton: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 6 },
  backText: { color: Colors.light.primary, fontSize: 16, fontWeight: '700' },
  hero: { gap: 12, padding: 22, borderRadius: 24 },
  eyebrow: { color: Colors.light.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: Colors.light.text, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  description: { color: Colors.light.textSecondary, fontSize: 15, lineHeight: 22 },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 12, gap: 4 },
  totalLabel: { color: Colors.light.textSecondary, fontSize: 13, fontWeight: '600' },
  totalValue: { color: Colors.light.text, fontSize: 24, lineHeight: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  entryCard: { gap: 8, padding: 18, borderRadius: 20 },
  sectionTitle: { color: Colors.light.text, fontSize: 17, fontWeight: '800' },
  helper: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  inputWrap: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1 },
  inputInvalid: { borderWidth: 2 },
  currency: { color: Colors.light.textSecondary, fontSize: 21, fontWeight: '700' },
  input: { flex: 1, minHeight: 52, color: Colors.light.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  error: { color: Colors.light.error, fontSize: 13, lineHeight: 19 },
  stateCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 20 },
  stateText: { flex: 1, color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20 },
  retryButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  retryText: { color: Colors.light.primary, fontSize: 14, fontWeight: '700' },
  previewHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50, marginTop: 6 },
  previewCopy: { gap: 2 },
  memberCount: { color: Colors.light.textSecondary, fontSize: 12, fontWeight: '700' },
  previewTotal: { color: Colors.light.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  shareRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.light.border },
  rowIndex: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: Colors.light.backgroundElement },
  rowIndexText: { color: Colors.light.textSecondary, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  memberInfo: { flex: 1, gap: 3 },
  memberName: { color: Colors.light.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  shareAmount: { maxWidth: '46%', color: Colors.light.text, fontSize: 15, lineHeight: 21, fontWeight: '800', fontVariant: ['tabular-nums'], textAlign: 'right' },
  emptyText: { color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20, paddingVertical: 16 },
  footer: { gap: 12, paddingTop: 14 },
  publishedCard: { gap: 8, padding: 16, borderRadius: 18 },
  publishedTitle: { color: Colors.light.primary, fontSize: 15, fontWeight: '800' },
  publishButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 18, borderRadius: 14, backgroundColor: Colors.light.primary },
  publishText: { color: Colors.light.onPrimary, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.48 },
  oneTimeNote: { color: Colors.light.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  authorityNote: { color: Colors.light.textSecondary, fontSize: 11, lineHeight: 16 },
  roomReference: { alignSelf: 'center', color: Colors.light.textSecondary, fontSize: 11, letterSpacing: 0.6 },
});
