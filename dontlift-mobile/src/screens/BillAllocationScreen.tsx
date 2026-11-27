import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, useColorScheme, View,
  type ImageSourcePropType,
} from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { BottomTabInset, Colors } from '../constants/theme';
import { formatVND } from '../constants';
import type { BillShareOverride } from '../features/settlement/bill-allocation';
import { InitialBillSplitCard } from '../features/settlement/components/InitialBillSplitCard';
import { BillShareListRow, shareLabel, type BillAllocationMember } from '../features/settlement/components/BillShareListRow';
import { BillAllocationFooter } from '../features/settlement/components/BillAllocationFooter';
import type { OverrideDraft } from '../features/settlement/components/OverrideMemberEditor';
import { useReceiptEvidence } from '../features/settlement/use-receipt-evidence';
import { useBillAllocationPreview } from '../features/settlement/use-bill-allocation-preview';
import type { ReceiptScanResult } from '../features/settlement/receipt-scan-api';
import type { BillShare } from '../features/settlement/bill-repository';
import type { PublishedBillState } from '../features/settlement/published-bill-listener';

export type { BillAllocationMember } from '../features/settlement/components/BillShareListRow';

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
  isPremium?: boolean;
  onOpenPremium?: () => void;
  onScanReceipt?: (roomId: string, uri: string, mimeType: string) => Promise<ReceiptScanResult>;
  onUploadReceiptEvidence?: (roomId: string, uri: string, mimeType: string) => Promise<string>;
  onDeleteReceiptEvidence?: (roomId: string, path: string) => Promise<void>;
  getReceiptEvidenceImageSource?: (roomId: string, path: string) => Promise<ImageSourcePropType>;
  members: readonly BillAllocationMember[];
  state: PublishedBillState;
  isOnline: boolean;
  isPublishing: boolean;
  pendingTotalVnd?: number;
  pendingShareOverrides?: readonly BillShareOverride[];
  isApplyingOverride?: boolean;
  hasPendingOverride?: boolean;
  publishError?: string;
  overrideError?: string;
  onPublish: (totalBillVnd: number, shareOverrides?: BillShareOverride[], receiptEvidencePath?: string) => void;
  onApplyOverrides?: (overrides: BillShareOverride[], expectedRevision: number) => void;
  onRetry: () => void;
  onRetryPublish: () => void;
  onRetryOverride?: () => void;
  onBack: () => void;
};

export function BillAllocationScreen({
  roomId, mode, members, state, isOnline, isPublishing, pendingTotalVnd, pendingShareOverrides, actorUid, onPayShare,
  isApplyingOverride = false, hasPendingOverride = false, publishError, overrideError,
  onPublish, onApplyOverrides = () => undefined, onRetry, onRetryPublish, onRetryOverride = () => undefined, onBack,
  pendingPaymentMemberUid, isMarkingPayment = false, paymentError, onMarkPaid, onRetryPayment,
  isPremium = true, onOpenPremium = () => undefined, onScanReceipt,
  onUploadReceiptEvidence, onDeleteReceiptEvidence, getReceiptEvidenceImageSource,
}: Props) {
  const colors = useColorScheme() === 'dark' ? Colors.dark : Colors.light;
  const [billInput, setBillInput] = useState('');
  const [initialSplitMode, setInitialSplitMode] = useState<'ROOM_SCORE' | 'CUSTOM_PERCENT'>(pendingShareOverrides?.length ? 'CUSTOM_PERCENT' : 'ROOM_SCORE');
  const [initialPercentDrafts, setInitialPercentDrafts] = useState<Record<string, string>>(() => Object.fromEntries(
    (pendingShareOverrides ?? []).filter(item => item.type === 'PERCENT_BPS').map(item => [item.uid, (item.value / 100).toFixed(2).replace(/\.00$/, '')]),
  ));
  const [submitted, setSubmitted] = useState(false);
  const [overrideEditingRequested, setIsEditingOverrides] = useState(false);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, { type: BillShareOverride['type']; value: string }>>({});
  const billListRef = useRef<FlatList<BillShare>>(null);
  const percentInputRefs = useRef<Record<string, { focus: () => void } | null>>({});
  const host = mode === 'host';
  const parsedTotal = pendingTotalVnd ?? (billInput ? Number(billInput.replace(/\D/g, '')) : 0);
  const validTotal = Number.isSafeInteger(parsedTotal) && parsedTotal >= 1_000;
  const bringPercentInputIntoView = (uid: string) => {
    const index = customOrder.findIndex(member => member.uid === uid);
    if (index < 0) return;
    // Wait for the keyboard/window resize to settle, then bring the focused row above it.
    setTimeout(() => billListRef.current?.scrollToIndex({ index, viewPosition: 0.28, animated: true }), 260);
  };
  const focusNextPercentInput = (uid: string) => {
    const index = customOrder.findIndex(member => member.uid === uid);
    const next = customOrder[index + 1];
    if (next) {
      percentInputRefs.current[next.uid]?.focus();
      bringPercentInputIntoView(next.uid);
    } else Keyboard.dismiss();
  };
  const confirmedBill = state.bill ?? null;
  const receipt = useReceiptEvidence({
    roomId,
    confirmedEvidencePath: confirmedBill?.receiptEvidencePath,
    onScanReceipt,
    onUploadReceiptEvidence,
    onDeleteReceiptEvidence,
    getReceiptEvidenceImageSource,
    setBillInput,
    setSubmitted,
  });
  const paidLocked = (confirmedBill?.billPaidCount ?? 0) > 0;
  const canOverride = host && confirmedBill != null && !paidLocked && state.kind === 'published'
    && !pendingPaymentMemberUid && !isMarkingPayment;
  // Thanh toán trên thiết bị khác có thể khóa bill ngay khi Host đang sửa; hiển thị lại các hành động thanh toán.
  const isEditingOverrides = canOverride && overrideEditingRequested;
  const {
    customInputRows,
    customOrder,
    displayedShares,
    initialPercentOverrides,
    overridePreview,
    overrideTotalMismatch,
    parsedOverrides,
    preview,
  } = useBillAllocationPreview({
    members,
    host,
    validTotal,
    parsedTotal,
    initialSplitMode,
    initialPercentDrafts,
    overrideDrafts,
    confirmedBill,
    canOverride,
    isEditingOverrides,
  });
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
    if (!preview || !isOnline || isPublishing || receipt.isSavingEvidence) return;
    Keyboard.dismiss();
    Alert.alert(
      'Publish this bill split?',
      `${formatVND(preview.totalBillVnd)} VND will be split across ${preview.shares.length} members${initialSplitMode === 'CUSTOM_PERCENT' ? ' using your percentages' : ' by room score'}. You can review the preview below. Publishing is one-time for this room.`,
      [
        { text: 'Review again', style: 'cancel' },
        { text: 'Publish once', onPress: () => onPublish(preview.totalBillVnd,
          initialSplitMode === 'CUSTOM_PERCENT' ? initialPercentOverrides.entries : undefined, receipt.evidencePath) },
      ],
    );
  };

  const leaveAllocation = () => {
    if (!confirmedBill && pendingTotalVnd == null && !isPublishing && receipt.evidencePath) {
      receipt.deleteEvidence(receipt.evidencePath);
    }
    onBack();
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <FlatList
      ref={billListRef}
      style={styles.list}
      contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + 32 }]}
      onScrollToIndexFailed={({ index, averageItemLength }) => billListRef.current?.scrollToOffset({
        offset: Math.max(0, averageItemLength * index), animated: true,
      })}
      data={(host && !confirmedBill && initialSplitMode === 'CUSTOM_PERCENT'
        ? customInputRows as BillShare[]
        : displayedShares)}
      keyExtractor={item => item.uid}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={(
        <View style={styles.headerContent}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to group summary"
            onPress={leaveAllocation} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={[styles.backText, { color: colors.primary }]}>‹  Group summary</Text>
          </Pressable>

          {host && !confirmedBill ? (
            <View style={styles.intro}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>ROOM SETTLEMENT</Text>
              <Text style={[styles.title, { color: colors.text }]}>Split the room bill</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>Enter the total, review each share, then publish.</Text>
            </View>
          ) : (
            <GlassCard style={[styles.hero, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder, shadowColor: colors.glassShadow }]}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>ROOM SETTLEMENT</Text>
              <Text style={[styles.title, { color: colors.text }]}>{confirmedBill ? canOverride && isEditingOverrides ? 'Adjust the split' : 'Published shares' : 'Bill breakdown'}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {host
                  ? 'Adjust selected raw shares. Other members keep their default amount; the complete bill total must still match exactly.'
                  : 'These are the final amounts published by the Host for this room.'}
              </Text>
              {confirmedBill ? (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Room total</Text>
                <Text accessibilityRole="text" style={[styles.totalValue, { color: colors.text }]}>{formatVND(confirmedBill.totalBillVnd)} VND</Text>
              </View>
              ) : null}
            </GlassCard>
          )}

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
            <InitialBillSplitCard
              colors={colors}
              isPremium={isPremium}
              isScanning={receipt.isScanning}
              isSavingEvidence={receipt.isSavingEvidence}
              hasSavedEvidence={receipt.evidencePath != null}
              previewUri={receipt.previewUri}
              scanError={receipt.scanError}
              evidenceError={receipt.evidenceError}
              scanResult={receipt.scanResult}
              onCapture={() => { void receipt.captureReceipt(); }}
              onSelectPhoto={() => { void receipt.selectReceipt(); }}
              onOpenPremium={onOpenPremium}
              onConfirmReceipt={amount => { void receipt.acceptAmount(amount); }}
              onRejectReceipt={receipt.rejectReceipt}
              onContinueWithoutEvidence={receipt.continueWithoutEvidence}
              isPublishing={isPublishing}
              pendingTotalVnd={pendingTotalVnd}
              billInput={billInput}
              onBillInputChange={value => setBillInput(value.replace(/\D/g, ''))}
              submitted={submitted}
              validTotal={validTotal}
              onSubmit={() => Keyboard.dismiss()}
              onBlur={() => setSubmitted(true)}
              splitMode={initialSplitMode}
              onSplitModeChange={setInitialSplitMode}
              percentTotalBps={initialPercentOverrides.totalBps}
              percentError={initialPercentOverrides.error}
            />          ) : null}

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
      renderItem={({ item }) => {
        const member = membersByUid.get(item.uid);
        const percentIndex = customOrder.findIndex(candidate => candidate.uid === item.uid);
        const customPercentRow = host && !confirmedBill && initialSplitMode === 'CUSTOM_PERCENT';
        return (
          <BillShareListRow
            item={item}
            member={member}
            colors={colors}
            showRank={customPercentRow}
            rank={customInputRows.find(row => row.uid === item.uid)?.rank ?? 0}
            showPercentInput={customPercentRow}
            percentValue={initialPercentDrafts[item.uid] ?? ''}
            inputRef={input => { percentInputRefs.current[item.uid] = input; }}
            percentReturnKey={percentIndex < customOrder.length - 1 ? 'next' : 'done'}
            percentEditable={!isPublishing && pendingTotalVnd == null}
            onPercentChange={value => setInitialPercentDrafts(current => ({ ...current, [item.uid]: value.replace(/[^\d.]/g, '') }))}
            onPercentFocus={() => bringPercentInputIntoView(item.uid)}
            onPercentSubmit={() => focusNextPercentInput(item.uid)}
            showPaymentStatus={Boolean(confirmedBill)}
            hasSavedPaymentState={state.kind !== 'published'}
            showUncalculatedAmount={customPercentRow && !preview}
            showMarkPaid={Boolean(host && confirmedBill && !isEditingOverrides && item.shareVnd > 0
              && item.paymentStatus !== 'MARKED_AS_PAID' && onMarkPaid)}
            paymentDisabled={paymentDisabled}
            onMarkPaid={() => requestMarkPaid(item)}
            showOverrideEditor={Boolean(canOverride && isEditingOverrides && member)}
            isApplyingOverride={isApplyingOverride}
            hasPendingOverride={hasPendingOverride}
            overrideDraft={overrideDrafts[item.uid]}
            onOverrideDraftChange={value => setOverrideDrafts(current => {
              const next = { ...current };
              if (value) next[item.uid] = value;
              else delete next[item.uid];
              return next;
            })}
          />
        );
      }}      ListEmptyComponent={host && validTotal
        ? <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No room members are available for this calculation.</Text>
        : undefined}
      ListFooterComponent={(
        <BillAllocationFooter
          actorUid={actorUid}
          confirmedBill={confirmedBill}
          roomId={roomId}
          stateKind={state.kind}
          colors={colors}
          host={host}
          isEditingOverrides={isEditingOverrides}
          isOnline={isOnline}
          hasPendingOverride={hasPendingOverride}
          isApplyingOverride={isApplyingOverride}
          onPayShare={onPayShare}
          receiptImageSource={receipt.imageSource}
          receiptImageError={receipt.imageError}
          pendingTotalVnd={pendingTotalVnd}
          preview={preview}
          isPublishing={isPublishing}
          isSavingEvidence={receipt.isSavingEvidence}
          publishError={publishError}
          onRequestPublish={requestPublish}
          onRetryPublish={onRetryPublish}
        />
      )}
    />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  headerContent: { gap: 14 },
  backButton: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 6 },
  backText: { color: Colors.light.primary, fontSize: 16, fontWeight: '700' },
  intro: { gap: 5, paddingHorizontal: 4, paddingTop: 2, paddingBottom: 4 },
  hero: { gap: 12, padding: 22, borderRadius: 24 },
  eyebrow: { color: Colors.light.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: Colors.light.text, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  description: { color: Colors.light.textSecondary, fontSize: 15, lineHeight: 22 },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 12, gap: 4 },
  totalLabel: { color: Colors.light.textSecondary, fontSize: 13, fontWeight: '600' },
  totalValue: { color: Colors.light.text, fontSize: 24, lineHeight: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  lockCard: { gap: 6, padding: 16, borderRadius: 18, borderWidth: 1 },
  overrideCard: { gap: 12, padding: 18, borderRadius: 20 },
  overrideActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  secondaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderRadius: 14 },
  secondaryButtonText: { fontSize: 15, fontWeight: '800' },
  cancelButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderRadius: 14 },
  sectionTitle: { color: Colors.light.text, fontSize: 17, fontWeight: '800' },
  helper: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  error: { color: Colors.light.error, fontSize: 13, lineHeight: 19 },
  stateCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 20 },
  stateText: { flex: 1, color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20 },
  retryButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  retryText: { color: Colors.light.primary, fontSize: 14, fontWeight: '700' },
  previewHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50, marginTop: 6 },
  previewCopy: { gap: 2 },
  memberCount: { color: Colors.light.textSecondary, fontSize: 12, fontWeight: '700' },
  previewTotal: { color: Colors.light.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  emptyText: { color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20, paddingVertical: 16 },
  publishButton: { width: '88%', alignSelf: 'center', minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 18, borderRadius: 14, backgroundColor: Colors.light.primary },
  publishText: { color: Colors.light.onPrimary, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.48 },
});
