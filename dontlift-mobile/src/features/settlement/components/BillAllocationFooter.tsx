import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { GlassCard } from '../../../components/GlassCard';
import { Colors } from '../../../constants/theme';
import type { BillAllocation } from '../bill-allocation';
import type { PublishedBill } from '../bill-repository';

type Props = {
  actorUid?: string;
  confirmedBill: PublishedBill | null;
  roomId: string;
  stateKind: 'loading' | 'unpublished' | 'cached' | 'published' | 'error';
  colors: typeof Colors.light | typeof Colors.dark;
  host: boolean;
  isEditingOverrides: boolean;
  isOnline: boolean;
  hasPendingOverride: boolean;
  isApplyingOverride: boolean;
  onPayShare?: () => void;
  receiptImageSource?: ImageSourcePropType | null;
  receiptImageError?: boolean;
  pendingTotalVnd?: number;
  preview: BillAllocation | null;
  isPublishing: boolean;
  isSavingEvidence: boolean;
  publishError?: string;
  onRequestPublish: () => void;
  onRetryPublish: () => void;
};

export function BillAllocationFooter({
  actorUid,
  confirmedBill,
  roomId,
  stateKind,
  colors,
  host,
  isEditingOverrides,
  isOnline,
  hasPendingOverride,
  isApplyingOverride,
  onPayShare,
  receiptImageSource,
  receiptImageError,
  pendingTotalVnd,
  preview,
  isPublishing,
  isSavingEvidence,
  publishError,
  onRequestPublish,
  onRetryPublish,
}: Props) {
  return (
    <View style={styles.footer}>
      {confirmedBill && !isEditingOverrides && onPayShare && confirmedBill.shares.some(share => share.uid === actorUid) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View VietQR for your published share"
          disabled={!isOnline || stateKind !== 'published' || hasPendingOverride || isApplyingOverride}
          accessibilityState={{ disabled: !isOnline || stateKind !== 'published' || hasPendingOverride || isApplyingOverride }}
          onPress={onPayShare}
          style={({ pressed }) => [styles.publishButton,
            { backgroundColor: colors.backgroundSelected, borderColor: colors.primary, borderWidth: 1 },
            pressed && styles.pressed,
            (!isOnline || stateKind !== 'published' || hasPendingOverride || isApplyingOverride) && styles.disabled]}
        >
          <Text style={[styles.publishText, { color: colors.primary }]}>
            {confirmedBill.shares.find(share => share.uid === actorUid)?.paymentStatus === 'MARKED_AS_PAID'
              ? 'View payment confirmation'
              : 'Pay your share'}
          </Text>
        </Pressable>
      ) : null}
      {confirmedBill ? (
        <GlassCard className="" style={[styles.publishedCard, { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder, shadowColor: colors.glassShadow }]}>
          <Text style={[styles.publishedTitle, { color: colors.primary }]}>
            {stateKind === 'published' ? 'Published to this room' : 'Saved copy'}
          </Text>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            {stateKind === 'published'
              ? 'The Host calculated this breakdown on their device from the finalized scores. Members can review it until payment details expire.'
              : 'These amounts were confirmed earlier. Reconnect or retry to check the current room bill.'}
          </Text>
          {confirmedBill.receiptEvidencePath ? (
            <View style={styles.receiptEvidence}>
              <Text style={[styles.sectionTitle, { color: Colors.light.text }]}>Receipt evidence</Text>
              {receiptImageSource ? (
                <Image accessibilityLabel="Receipt evidence for this bill" source={receiptImageSource} resizeMode="contain" style={[styles.receiptEvidenceImage, { backgroundColor: colors.backgroundElement }]} />
              ) : receiptImageError ? (
                <Text style={[styles.helper, { color: colors.error }]}>Could not load the receipt image. Reconnect and reopen this bill.</Text>
              ) : (
                <ActivityIndicator accessibilityLabel="Loading receipt evidence" color={colors.primary} />
              )}
            </View>
          ) : null}
        </GlassCard>
      ) : null}
      {host && !confirmedBill ? (
        <>
          {publishError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{publishError}</Text> : null}
          {!isOnline ? <Text style={[styles.helper, { color: colors.textSecondary }]}>Connect to the internet to publish. The request is never queued offline.</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pendingTotalVnd == null ? 'Publish bill shares once' : 'Retry publishing the same bill request'}
            accessibilityState={{ disabled: !preview || !isOnline || isPublishing || isSavingEvidence }}
            disabled={!preview || !isOnline || isPublishing || isSavingEvidence}
            onPress={pendingTotalVnd == null ? onRequestPublish : onRetryPublish}
            style={[styles.publishButton, {
              backgroundColor: preview && isOnline ? '#2563EB' : '#DBEAFE',
              borderColor: preview && isOnline ? '#1D4ED8' : '#93C5FD',
            }]}
          >
            {isPublishing ? <ActivityIndicator color={preview && isOnline ? '#FFFFFF' : '#1D4ED8'} /> : null}
            <Text style={[styles.publishText, { color: preview && isOnline ? '#FFFFFF' : '#1D4ED8' }]}>
              {isPublishing ? 'Publishing…' : pendingTotalVnd == null ? 'Publish shares once' : 'Retry publish'}
            </Text>
          </Pressable>
          <Text style={[styles.oneTimeNote, { color: colors.textSecondary }]}>Check the preview before publishing. The Host can adjust the split until the first payment is marked.</Text>
        </>
      ) : null}
      {host && !confirmedBill ? <Text style={[styles.authorityNote, { color: colors.textSecondary }]}>Rules authorize the Host and room state. They do not verify the calculation or prove that every member was included.</Text> : null}
      {confirmedBill ? <Text style={[styles.roomReference, { color: colors.textSecondary }]}>Room · {roomId.slice(0, 8).toUpperCase()}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 12, paddingTop: 14 },
  publishedCard: { gap: 8, padding: 16, borderRadius: 18 },
  receiptEvidence: { gap: 8, paddingTop: 8 },
  receiptEvidenceImage: { width: '100%', height: 320, borderRadius: 14 },
  publishedTitle: { color: Colors.light.primary, fontSize: 15, fontWeight: '800' },
  helper: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: Colors.light.text, fontSize: 17, fontWeight: '800' },
  error: { color: Colors.light.error, fontSize: 13, lineHeight: 19 },
  publishButton: { width: '88%', alignSelf: 'center', minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 14, backgroundColor: Colors.light.primary },
  publishText: { color: Colors.light.onPrimary, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.48 },
  oneTimeNote: { color: Colors.light.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  authorityNote: { color: Colors.light.textSecondary, fontSize: 11, lineHeight: 16 },
  roomReference: { alignSelf: 'center', color: Colors.light.textSecondary, fontSize: 11, letterSpacing: 0.6 },
});
