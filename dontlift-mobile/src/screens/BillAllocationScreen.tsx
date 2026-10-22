import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, useColorScheme, View,
} from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { Colors } from '../constants/theme';
import { formatVND } from '../constants';
import { calculateBillSharesWithOverrides, calculateDefaultBillShares, type BillShareOverride } from '../features/settlement/bill-allocation';
import type { BillShare } from '../features/settlement/bill-repository';
import type { PublishedBillState } from '../features/settlement/published-bill-listener';

export type BillAllocationMember = { uid: string; displayName: string; penaltyScore: number };

type Props = {
  actorUid?: string;
  onPayShare?: () => void;
  pendingPaymentMemberUid?: string;
  isMarkingPayment?: boolean;
  paymentError?: string;
  onMarkPaid?: (memberUid: string, publicationRequestId: string, expectedRevision: number) => void;
  onRetryPayment?: () => void;
  roomId: string;
  mode: 'host' | 'member';
  members: readonly BillAllocationMember[];
  state: PublishedBillState;
  isOnline: boolean;
  isPublishing: boolean;
  pendingTotalVnd?: number;
  isApplyingOverride?: boolean;
  hasPendingOverride?: boolean;
  publishError?: string;
  overrideError?: string;
  onPublish: (totalBillVnd: number) => void;
  onApplyOverrides?: (overrides: BillShareOverride[], expectedRevision: number) => void;
  onRetry: () => void;
  onRetryPublish: () => void;
  onRetryOverride?: () => void;
  onBack: () => void;
};

function shareLabel(member: BillAllocationMember | undefined): string {
  return member?.displayName.trim() || 'Participant';
}

type OverrideDraft = { type: BillShareOverride['type']; value: string };

function OverrideMemberEditor({
  member, currentShareVnd, draft, colors, disabled, onDraftChange,
}: {
  member: BillAllocationMember;
  currentShareVnd: number;
  draft?: OverrideDraft;
  colors: typeof Colors.light | typeof Colors.dark;
  disabled: boolean;
  onDraftChange: (value: OverrideDraft | null) => void;
}) {
  const name = shareLabel(member);
  return (
    <View style={[styles.overrideRow, { borderTopColor: colors.border }]}>
      <View style={styles.overrideRowHeading}>
        <View style={styles.memberInfo}>
          <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={2}>{name}</Text>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>Current share · {formatVND(currentShareVnd)} VND</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${draft ? 'Remove custom amount for' : 'Set custom amount for'} ${name}`}
          accessibilityState={{ checked: Boolean(draft), disabled }} disabled={disabled}
          onPress={() => onDraftChange(draft ? null : { type: 'FIXED_VND', value: '' })}
          style={({ pressed }) => [styles.rowToggle, { borderColor: colors.border }, pressed && styles.pressed, disabled && styles.disabled]}>
          <Text style={[styles.rowToggleText, { color: colors.primary }]}>{draft ? 'Use default' : 'Customize'}</Text>
        </Pressable>
      </View>
      {draft ? (
        <View style={styles.overrideInputs}>
          <View style={styles.overrideTypes}>
            {(['FIXED_VND', 'PERCENT_BPS'] as const).map(type => (
              <Pressable key={type} accessibilityRole="button" accessibilityState={{ selected: draft.type === type, disabled }}
                accessibilityLabel={type === 'FIXED_VND' ? `Set fixed VND for ${name}` : `Set percentage for ${name}`}
                disabled={disabled} onPress={() => onDraftChange({ ...draft, type })}
                style={({ pressed }) => [styles.typeButton,
                  { backgroundColor: draft.type === type ? colors.primary : colors.inputSurface,
                    borderColor: draft.type === type ? colors.primary : colors.border }, pressed && styles.pressed, disabled && styles.disabled]}>
                <Text style={[styles.typeButtonText, { color: draft.type === type ? colors.onPrimary : colors.textSecondary }]}>
                  {type === 'FIXED_VND' ? 'Fixed VND' : 'Percent'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.inputSurface }]}>
            <Text accessibilityElementsHidden style={[styles.currency, { color: colors.textSecondary }]}>{draft.type === 'FIXED_VND' ? '₫' : '%'}</Text>
            <TextInput accessibilityLabel={`${draft.type === 'FIXED_VND' ? 'Fixed VND amount' : 'Bill percentage'} for ${name}`}
              accessibilityHint={draft.type === 'FIXED_VND' ? 'Whole Vietnamese dong.' : 'Zero to one hundred percent, up to two decimal places.'}
              editable={!disabled} keyboardType={draft.type === 'FIXED_VND' ? 'number-pad' : 'decimal-pad'}
              returnKeyType="done" value={draft.value}
              onChangeText={value => onDraftChange({ ...draft, value: value.replace(draft.type === 'FIXED_VND' ? /[^\d]/g : /[^\d.]/g, '') })}
              onSubmitEditing={Keyboard.dismiss} placeholder={draft.type === 'FIXED_VND' ? 'e.g. 150000' : 'e.g. 25.00'}
              placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text }]} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function BillAllocationScreen({
  roomId, mode, members, state, isOnline, isPublishing, pendingTotalVnd, actorUid, onPayShare,
  isApplyingOverride = false, hasPendingOverride = false, publishError, overrideError,
  onPublish, onApplyOverrides = () => undefined, onRetry, onRetryPublish, onRetryOverride = () => undefined, onBack,
  pendingPaymentMemberUid, isMarkingPayment = false, paymentError, onMarkPaid, onRetryPayment,
}: Props) {
  const colors = useColorScheme() === 'dark' ? Colors.dark : Colors.light;
  const [billInput, setBillInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [overrideEditingRequested, setIsEditingOverrides] = useState(false);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, { type: BillShareOverride['type']; value: string }>>({});
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
  const paidLocked = (confirmedBill?.billPaidCount ?? 0) > 0;
  const canOverride = host && confirmedBill != null && !paidLocked && state.kind === 'published'
    && !pendingPaymentMemberUid && !isMarkingPayment;
  // Thanh toán trên thiết bị khác có thể khóa bill ngay khi Host đang sửa; hiển thị lại các hành động thanh toán.
  const isEditingOverrides = canOverride && overrideEditingRequested;
  const parsedOverrides = useMemo(() => {
    const overrides: BillShareOverride[] = [];
    for (const [uid, draft] of Object.entries(overrideDrafts)) {
      const raw = draft.value.trim();
      if (!raw) return { entries: null, message: 'Enter a value for each custom amount.' };
      let value: number;
      if (draft.type === 'PERCENT_BPS') {
        if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw)) return { entries: null, message: 'Use a percentage from 0 to 100, with up to two decimal places.' };
        value = Math.round(Number(raw) * 100);
        if (value > 10_000) return { entries: null, message: 'A member percentage cannot be greater than 100%.' };
      } else {
        if (!/^\d+$/.test(raw)) return { entries: null, message: 'Enter a whole VND amount.' };
        value = Number(raw);
        if (!Number.isSafeInteger(value)) return { entries: null, message: 'The VND amount is too large.' };
      }
      overrides.push({ uid, type: draft.type, value });
    }
    return { entries: overrides, message: undefined };
  }, [overrideDrafts]);
  const overridePreview = useMemo(() => {
    if (!canOverride || !isEditingOverrides || parsedOverrides.entries === null) return null;
    if (parsedOverrides.entries.length === 0) return confirmedBill;
    try {
      return calculateBillSharesWithOverrides(confirmedBill.totalBillVnd, members, parsedOverrides.entries);
    } catch {
      return null;
    }
  }, [canOverride, confirmedBill, isEditingOverrides, members, parsedOverrides]);
  const overrideTotalMismatch = Boolean(isEditingOverrides && parsedOverrides.entries?.length
    && !overridePreview && !parsedOverrides.message);
  const displayedShares: readonly BillShare[] = canOverride && isEditingOverrides && overridePreview
    ? overridePreview.shares : confirmedBill?.shares ?? preview?.shares ?? [];
  const membersByUid = useMemo(() => new Map(members.map(member => [member.uid, member])), [members]);
  const payableShares = confirmedBill?.shares.filter(share => share.shareVnd > 0) ?? [];
  const paidShares = payableShares.filter(share => share.paymentStatus === 'MARKED_AS_PAID');
  const paymentDisabled = !isOnline || state.kind !== 'published' || isMarkingPayment
    || Boolean(pendingPaymentMemberUid) || hasPendingOverride || isApplyingOverride;
  const requestMarkPaid = (share: BillShare) => {
    if (!host || !confirmedBill || paymentDisabled || !onMarkPaid) return;
    const publication = confirmedBill.requestId;
    const revision = confirmedBill.billRevision ?? 0;
    Alert.alert('Confirm payment received?',
      `Mark ${shareLabel(membersByUid.get(share.uid))} as paid for ${formatVND(share.shareVnd)} VND? Check your bank account first. This cannot be undone, and the bill split will be locked.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'I received the payment',
        onPress: () => onMarkPaid(share.uid, publication, revision) }]);
  };

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

  const requestOverride = () => {
    if (!confirmedBill || !overridePreview || !parsedOverrides.entries?.length || paidLocked
      || !isOnline || isApplyingOverride) return;
    Keyboard.dismiss();
    Alert.alert(
      'Replace the room split?',
      `This publishes a new ${formatVND(confirmedBill.totalBillVnd)} VND breakdown for ${members.length} members. All members will see it together. You can revise it again until anyone is marked paid.`,
      [
        { text: 'Keep reviewing', style: 'cancel' },
        { text: 'Publish replacement', onPress: () => onApplyOverrides(parsedOverrides.entries!, confirmedBill.billRevision ?? 0) },
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
            <Text style={[styles.title, { color: colors.text }]}>{confirmedBill ? canOverride && isEditingOverrides ? 'Adjust the split' : 'Published shares' : host ? 'Split the room bill' : 'Bill breakdown'}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {host
                ? confirmedBill ? 'Adjust selected raw shares. Other members keep their default amount; the complete bill total must still match exactly.' : 'Review each member’s amount before publishing. The Host device calculates from the finalized room scores.'
                : 'These are the final amounts published by the Host for this room.'}
            </Text>
            {confirmedBill ? (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Room total</Text>
                <Text accessibilityRole="text" style={[styles.totalValue, { color: colors.text }]}>{formatVND(confirmedBill.totalBillVnd)} VND</Text>
              </View>
            ) : null}
          </GlassCard>

          {host && confirmedBill && paidLocked ? (
            <GlassCard style={[styles.lockCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Split locked</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>At least one member has been marked as paid. The room split can no longer be changed.</Text>
            </GlassCard>
          ) : null}

          {confirmedBill ? (
            <Text accessibilityLiveRegion="polite" style={[styles.helper, { color: colors.textSecondary }]}>
              {payableShares.length === 0 ? 'No transfers are needed for this bill.'
                : `${paidShares.length} of ${payableShares.length} payments confirmed by the Host${paidShares.length === payableShares.length ? ' · All confirmed' : ''}`}
            </Text>
          ) : null}

          {host && pendingPaymentMemberUid ? (
            <GlassCard style={[styles.overrideCard, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Confirming payment</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>Checking the saved confirmation for {shareLabel(membersByUid.get(pendingPaymentMemberUid))}. Status changes only after server confirmation.</Text>
              {paymentError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{paymentError}</Text> : null}
              <Pressable accessibilityRole="button" accessibilityLabel="Retry the saved payment confirmation"
                disabled={!isOnline || isMarkingPayment} accessibilityState={{ disabled: !isOnline || isMarkingPayment, busy: isMarkingPayment }}
                onPress={onRetryPayment} style={({ pressed }) => [styles.publishButton, pressed && styles.pressed,
                  (!isOnline || isMarkingPayment) && styles.disabled]}>
                {isMarkingPayment ? <ActivityIndicator color={colors.onPrimary} /> : null}
                <Text style={[styles.publishText, { color: colors.onPrimary }]}>{isMarkingPayment ? 'Confirming…' : 'Retry confirmation'}</Text>
              </Pressable>
            </GlassCard>
          ) : host && paymentError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{paymentError}</Text> : null}

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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{canOverride && isEditingOverrides ? 'Adjusted preview' : 'Final amounts'}</Text>
              <Text style={[styles.memberCount, { color: colors.textSecondary }]}>{confirmedBill.shares.length} {confirmedBill.shares.length === 1 ? 'member' : 'members'}</Text>
            </View>
          ) : null}

          {host && hasPendingOverride && !paidLocked ? (
            <GlassCard style={[styles.overrideCard, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Replacement pending</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>Retry the saved request to check whether it published. Your custom amounts are kept with that request.</Text>
              {overrideError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{overrideError}</Text> : null}
              {!isOnline ? <Text style={[styles.helper, { color: colors.textSecondary }]}>Reconnect to retry.</Text> : null}
              <Pressable accessibilityRole="button" accessibilityLabel="Retry publishing the saved bill override"
                accessibilityState={{ disabled: !isOnline || isApplyingOverride, busy: isApplyingOverride }}
                disabled={!isOnline || isApplyingOverride} onPress={onRetryOverride}
                style={({ pressed }) => [styles.publishButton, pressed && styles.pressed,
                  (!isOnline || isApplyingOverride) && styles.disabled]}>
                {isApplyingOverride ? <ActivityIndicator color={colors.onPrimary} /> : null}
                <Text style={[styles.publishText, { color: colors.onPrimary }]}>{isApplyingOverride ? 'Publishing…' : 'Retry publish'}</Text>
              </Pressable>
            </GlassCard>
          ) : null}

          {canOverride && !isEditingOverrides && !hasPendingOverride ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Adjust bill shares before first payment"
              accessibilityState={{ disabled: !isOnline || isApplyingOverride || hasPendingOverride }}
              disabled={!isOnline || isApplyingOverride || hasPendingOverride}
              onPress={() => { setOverrideDrafts({}); setIsEditingOverrides(true); }}
              style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed,
                (!isOnline || isApplyingOverride || hasPendingOverride) && styles.disabled]}>
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Adjust shares</Text>
            </Pressable>
          ) : null}

          {canOverride && isEditingOverrides && !hasPendingOverride ? (
            <GlassCard style={[styles.overrideCard, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Custom amounts</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>Unchanged members keep their default raw amount. The full total must equal {formatVND(confirmedBill.totalBillVnd)} VND exactly.</Text>
              {parsedOverrides.message ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{parsedOverrides.message}</Text> : null}
              {overrideTotalMismatch ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>These amounts do not add up to the full bill. Adjust the custom values before publishing.</Text> : null}
              {overrideError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{overrideError}</Text> : null}
              {!isOnline ? <Text style={[styles.helper, { color: colors.textSecondary }]}>Connect to the internet before publishing a replacement.</Text> : null}
              <View style={styles.overrideActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Cancel editing bill shares" disabled={isApplyingOverride || hasPendingOverride}
                  onPress={() => setIsEditingOverrides(false)} style={({ pressed }) => [styles.cancelButton, { borderColor: colors.border }, pressed && styles.pressed]}>
                  <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Publish replacement bill shares"
                  accessibilityState={{ disabled: !overridePreview || !parsedOverrides.entries?.length || !isOnline || isApplyingOverride }}
                  disabled={!overridePreview || !parsedOverrides.entries?.length || !isOnline || isApplyingOverride}
                  onPress={requestOverride}
                  style={({ pressed }) => [styles.publishButton, pressed && styles.pressed,
                    (!overridePreview || !parsedOverrides.entries?.length || !isOnline || isApplyingOverride) && styles.disabled]}>
                  {isApplyingOverride ? <ActivityIndicator color={colors.onPrimary} /> : null}
                  <Text style={[styles.publishText, { color: colors.onPrimary }]}>{isApplyingOverride ? 'Publishing…' : 'Publish replacement'}</Text>
                </Pressable>
              </View>
              {overridePreview ? <Text style={[styles.previewTotal, { color: colors.textSecondary }]}>Preview total · {formatVND(overridePreview.sumShareVnd)} VND</Text> : null}
            </GlassCard>
          ) : null}

          {host && !confirmedBill && preview ? (
            <Text style={[styles.previewTotal, { color: colors.textSecondary }]}>Total · {formatVND(preview.totalBillVnd)} VND</Text>
          ) : null}
        </View>
      )}
      renderItem={({ item, index }) => {
        const member = membersByUid.get(item.uid);
        return (
          <View>
            <View style={[styles.shareRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.rowIndex, { backgroundColor: colors.backgroundElement }]}><Text style={[styles.rowIndexText, { color: colors.textSecondary }]}>{String(index + 1).padStart(2, '0')}</Text></View>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={2}>{shareLabel(member)}</Text>
                {confirmedBill ? <Text style={[styles.helper, { color: item.paymentStatus === 'MARKED_AS_PAID' ? colors.primary : colors.textSecondary }]}>
                  {item.shareVnd === 0 ? 'No payment due' : item.paymentStatus === 'MARKED_AS_PAID'
                    ? `Paid · Host confirmed${state.kind !== 'published' ? ' (saved copy)' : ''}` : 'Awaiting Host confirmation'}
                </Text> : null}
              </View>
              <Text accessibilityLabel={`${shareLabel(member)} pays ${formatVND(item.shareVnd)} Vietnamese dong`}
                style={[styles.shareAmount, { color: colors.text }]}>{formatVND(item.shareVnd)} VND</Text>
            </View>
            {host && confirmedBill && !isEditingOverrides && item.shareVnd > 0
              && item.paymentStatus !== 'MARKED_AS_PAID' && onMarkPaid ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Mark ${shareLabel(member)} as paid`}
                disabled={paymentDisabled} accessibilityState={{ disabled: paymentDisabled }}
                onPress={() => requestMarkPaid(item)} style={({ pressed }) => [styles.markPaidButton,
                  { borderColor: colors.border }, pressed && styles.pressed, paymentDisabled && styles.disabled]}>
                <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Mark as paid</Text>
              </Pressable>
            ) : null}
            {canOverride && isEditingOverrides && member ? (
              <OverrideMemberEditor member={member} currentShareVnd={item.shareVnd} draft={overrideDrafts[item.uid]}
                colors={colors} disabled={isApplyingOverride || hasPendingOverride}
                onDraftChange={value => setOverrideDrafts(current => {
                  const next = { ...current };
                  if (value) next[item.uid] = value;
                  else delete next[item.uid];
                  return next;
                })} />
            ) : null}
          </View>
        );
      }}
      ListEmptyComponent={host && validTotal
        ? <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No room members are available for this calculation.</Text>
        : null}
      ListFooterComponent={(
        <View style={styles.footer}>
          {confirmedBill && !isEditingOverrides && onPayShare && confirmedBill.shares.some(share => share.uid === actorUid) ? (
            <Pressable accessibilityRole="button" accessibilityLabel="View VietQR for your published share"
              disabled={!isOnline || state.kind !== 'published' || hasPendingOverride || isApplyingOverride}
              accessibilityState={{ disabled: !isOnline || state.kind !== 'published' || hasPendingOverride || isApplyingOverride }}
              onPress={onPayShare} style={({ pressed }) => [styles.publishButton, pressed && styles.pressed,
                (!isOnline || state.kind !== 'published' || hasPendingOverride || isApplyingOverride) && styles.disabled]}>
              <Text style={[styles.publishText, { color: colors.onPrimary }]}>{confirmedBill.shares.find(share => share.uid === actorUid)?.paymentStatus === 'MARKED_AS_PAID'
                ? 'View payment confirmation' : 'Pay your share'}</Text>
            </Pressable>
          ) : null}
          {confirmedBill ? (
            <GlassCard style={[styles.publishedCard, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder, shadowColor: colors.glassShadow }]}>
              <Text style={[styles.publishedTitle, { color: colors.primary }]}>{state.kind === 'published' ? 'Published to this room' : 'Saved copy'}</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>
                {state.kind === 'published'
                  ? 'The Host calculated this breakdown on their device from the finalized scores. Members can review it until payment details expire.'
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
              <Text style={[styles.oneTimeNote, { color: colors.textSecondary }]}>Check the preview before publishing. The Host can adjust the split until the first payment is marked.</Text>
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
  markPaidButton: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1,
    borderRadius: 14, alignSelf: 'flex-end', justifyContent: 'center', marginBottom: 12 },
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
  lockCard: { gap: 6, padding: 16, borderRadius: 18, borderWidth: 1 },
  overrideCard: { gap: 12, padding: 18, borderRadius: 20 },
  overrideRow: { gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  overrideRowHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowToggle: { minHeight: 48, minWidth: 92, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderRadius: 12 },
  rowToggleText: { fontSize: 13, fontWeight: '700' },
  overrideInputs: { gap: 8, paddingBottom: 8 },
  overrideTypes: { flexDirection: 'row', gap: 8 },
  typeButton: { minWidth: 64, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  typeButtonText: { fontSize: 13, fontWeight: '800' },
  overrideActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  secondaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderRadius: 14 },
  secondaryButtonText: { fontSize: 15, fontWeight: '800' },
  cancelButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderRadius: 14 },
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
