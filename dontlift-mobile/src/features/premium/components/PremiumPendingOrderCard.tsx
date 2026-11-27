import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../../constants/theme';
import { GlassCard } from '../../../components/GlassCard';
import { RoomInvitationQr } from '../../../components/RoomInvitationQr';
import { BankTransferButton } from '../../bank-transfer/BankTransferButton';
import type { PremiumOrder } from '../premium-api';

export type PendingPremiumOrder = { requestId: string; packageId: string; orderCode?: number };
type SwitchPhase = 'debouncing' | 'cancelling' | 'creating' | null;

type Props = {
  pending: PendingPremiumOrder;
  order: PremiumOrder | null;
  selectedPackageId: string;
  selectedPlanDuration: string;
  switchPhase: SwitchPhase;
  error: string;
  statusMessage: string;
  busy: boolean;
  checkingStatus: boolean;
  bankTransferPreparing: boolean;
  bankTransfer: PremiumOrder['bankTransfer'];
  bankCode: string | null;
  onRetryPackageSwitch: () => void;
  onSelectPackage: (packageId: string) => void;
  onPrepareBankTransfer: () => void;
  onOpenCheckout: (url: string) => void;
  onCheckPaymentStatus: () => void;
};

const colors = Colors.light;
const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`;

export function PremiumPendingOrderCard({
  pending,
  order,
  selectedPackageId,
  selectedPlanDuration,
  switchPhase,
  error,
  statusMessage,
  busy,
  checkingStatus,
  bankTransferPreparing,
  bankTransfer,
  bankCode,
  onRetryPackageSwitch,
  onSelectPackage,
  onPrepareBankTransfer,
  onOpenCheckout,
  onCheckPaymentStatus,
}: Props) {
  const isSelected = selectedPackageId === pending.packageId;
  return (
    <GlassCard className="" style={styles.status}>
      <Text style={styles.duration}>
        {!isSelected ? 'Switching Premium package'
          : order?.status === 'CREATING' ? 'Payment being prepared'
            : order ? 'Payment awaiting confirmation' : 'Payment setup needs retry'}
      </Text>
      {order && isSelected ? <Text style={styles.price}>{money(order.amountVnd)}</Text> : null}
      {!isSelected || switchPhase === 'creating' ? (
        <View style={styles.switchPanel}>
          {switchPhase ? (
            <View accessibilityRole="progressbar" accessibilityLabel="Preparing new payment QR" style={styles.qrSkeleton}>
              <View style={styles.skeletonQr} />
              <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
              <Text style={styles.caption}>
                {switchPhase === 'debouncing' ? `Preparing ${selectedPlanDuration} plan…`
                  : switchPhase === 'cancelling' ? 'Cancelling the current payment QR…'
                    : 'Creating your new payment QR…'}
              </Text>
              <Text style={styles.caption}>The new QR appears after the server confirms the previous payment is cancelled.</Text>
            </View>
          ) : (
            <>
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
                : <Text style={styles.caption}>Choose a plan to replace the current payment QR.</Text>}
              {statusMessage ? <Text style={styles.caption}>{statusMessage}</Text> : null}
              <Pressable accessibilityRole="button" accessibilityLabel="Retry package switch" disabled={busy || checkingStatus}
                style={styles.secondary} onPress={onRetryPackageSwitch}>
                <Text style={styles.link}>Retry package switch</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Keep current Premium package" disabled={busy || checkingStatus}
                style={styles.secondary} onPress={() => onSelectPackage(pending.packageId)}>
                <Text style={styles.link}>Keep current package</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : order?.qrCode ? (
        <View style={styles.qrPanel}>
          {Platform.OS !== 'web' ? (
            <>
              <BankTransferButton onPress={onPrepareBankTransfer} busy={bankTransferPreparing || busy || checkingStatus} />
              {!bankTransfer ? <Text style={styles.caption}>Tap to refresh PayOS transfer details, or scan the QR code below.</Text>
                : !bankCode ? <Text style={styles.caption}>Loading bank details for app transfer…</Text> : null}
            </>
          ) : null}
          <RoomInvitationQr value={order.qrCode} size={232} accessibilityLabel="Premium payment QR code" />
          <Text style={styles.qrHelp}>Scan this code with your bank app. Payment confirmation will appear here automatically.</Text>
        </View>
      ) : order?.status === 'CREATING' ? (
        <Text style={styles.caption}>Your payment QR is being prepared. Keep this screen open; it will appear automatically.</Text>
      ) : order?.status === 'PENDING' ? (
        <Text style={styles.caption}>The payment link is ready, but its QR could not be loaded yet. Retry below or open payOS checkout.</Text>
      ) : null}
      {isSelected ? <Text style={styles.caption}>Already transferred? Check payment status. Your access updates after verification.</Text> : null}
      {order?.checkoutUrl && isSelected ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Open payOS checkout" style={styles.secondary}
          onPress={() => onOpenCheckout(order.checkoutUrl!)}>
          <Text style={styles.link}>Open payOS checkout</Text>
        </Pressable>
      ) : null}
      {statusMessage && order?.requestId === pending.requestId ? (
        <Text accessibilityRole="alert" style={styles.statusMessage}>{statusMessage}</Text>
      ) : null}
      {isSelected ? (
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || checkingStatus }}
          disabled={busy || checkingStatus} style={styles.secondary} onPress={onCheckPaymentStatus}>
          {checkingStatus ? <ActivityIndicator accessibilityLabel="Checking payment status" color={colors.primary} />
            : <Text style={styles.link}>Check payment status</Text>}
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  status: { padding: 18, gap: 10 },
  duration: { color: colors.text, fontSize: 17, fontWeight: '700' },
  price: { color: colors.text, fontSize: 19, fontWeight: '700' },
  caption: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  error: { color: colors.error, fontSize: 14, lineHeight: 21 },
  statusMessage: { color: colors.primary, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  secondary: { minHeight: 44, justifyContent: 'center' },
  switchPanel: { gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  qrSkeleton: { gap: 12, alignItems: 'center', paddingVertical: 8 },
  skeletonQr: { width: 184, height: 184, borderRadius: 18, backgroundColor: colors.backgroundElement },
  skeletonLine: { height: 14, borderRadius: 7, backgroundColor: colors.backgroundElement, width: '82%' },
  skeletonLineShort: { width: '48%' },
  qrPanel: { alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, backgroundColor: colors.inputSurface },
  qrHelp: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  link: { color: colors.primary, fontWeight: '600', fontSize: 15 },
});
