import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Clipboard, Pressable, Share, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { GlassCard } from '../components/GlassCard';
import { Colors } from '../constants/theme';
import { formatVND } from '../constants';
import type { PublishedBillState } from '../features/settlement/published-bill-state';
import type { SettlementDetailsState } from '../features/settlement/settlement-details-repository';
import type { BankOption } from '../features/settlement/bank-directory';
import { buildVietQrPayment } from '../features/settlement/vietqr-payload';

type Props = {
  roomId: string; roomPin: string; actorUid: string;
  member: { uid: string; displayName: string; status: string } | undefined;
  billState: PublishedBillState; detailsState: SettlementDetailsState; isOnline: boolean;
  onRefresh: () => void; onBack: () => void;
  backLabel?: string;
  bankDirectory?: { list: () => Promise<BankOption[]> };
};
type PaymentActionState = {
  paymentIdentity: string;
  shareError: boolean;
};

function QrImage({ uri, colors, onRetry }: {
  uri: string; colors: typeof Colors.light | typeof Colors.dark; onRetry: () => void;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const settled = useRef(false);
  const source = useMemo(() => ({ uri }), [uri]);
  useEffect(() => {
    settled.current = false;
    const timer = setTimeout(() => {
      if (!settled.current) { settled.current = true; setStatus('error'); }
    }, 15_000);
    return () => { settled.current = true; clearTimeout(timer); };
  }, []);
  return (
    <View style={[styles.qrFrame, { backgroundColor: colors.qrBackground, borderColor: colors.border }]}>
      <Image source={source} contentFit="contain" cachePolicy="none"
        accessibilityLabel="VietQR payment code for your current published share"
        accessible={status === 'ready'}
        style={[styles.qrImage, { opacity: status === 'ready' ? 1 : 0 }]}
        onLoad={() => { if (!settled.current) { settled.current = true; setStatus('ready'); } }}
        onError={() => { if (!settled.current) { settled.current = true; setStatus('error'); } }} />
      {status === 'ready' ? (
        <View pointerEvents="none" accessible={false} style={styles.centerLogoOverlay}>
          <View style={styles.centerLogoBadge}>
            <Image source={require('../../assets/images/dontlift-qr-mark.png')} contentFit="contain" style={styles.centerLogo} />
          </View>
        </View>
      ) : null}
      {status !== 'ready' ? (
        <View style={styles.qrOverlay}>
          {status === 'loading' ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading payment QR" /> : null}
          <Text accessibilityRole={status === 'error' ? 'alert' : undefined}
            style={[styles.imageStatus, { color: colors.qrForeground }]}>{status === 'loading' ? 'Preparing your QR…' : 'The QR could not be loaded.'}</Text>
          {status === 'error' ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Retry loading the VietQR image" onPress={onRetry}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
              <Text style={[styles.actionText, { color: Colors.light.primary }]}>Try again</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function VietQRSettlementScreen(props: Props) {
  const colors = useColorScheme() === 'dark' ? Colors.dark : Colors.light;
  const [nowUtcMs, setNowUtcMs] = useState(Date.now);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [imageAttempt, setImageAttempt] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bankLookup, setBankLookup] = useState<{ bankBin: string; name: string | null } | null>(null);
  const [actionState, setActionState] = useState<PaymentActionState>({ paymentIdentity: '', shareError: false });
  useEffect(() => {
    const timer = setInterval(() => setNowUtcMs(Date.now()), 1_000);
    const subscription = AppState.addEventListener('change', state => {
      setNowUtcMs(Date.now());
      setForeground(state === 'active');
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);
  const payment = buildVietQrPayment({ ...props, nowUtcMs, isOnline: props.isOnline && foreground });
  const loading = props.detailsState.kind === 'loading' || props.billState.kind === 'loading';
  const bankBin = payment.kind === 'ready' ? payment.bankBin : null;
  const paymentIdentity = payment.kind === 'ready' ? payment.identity : payment.kind;
  const bankName = bankLookup?.bankBin === bankBin ? bankLookup.name : null;
  const currentActionState = actionState.paymentIdentity === paymentIdentity
    ? actionState : { paymentIdentity, shareError: false };
  const { shareError } = currentActionState;
  const updateActionState = (updates: Partial<PaymentActionState>) => {
    setActionState(current => ({
      ...(current.paymentIdentity === paymentIdentity
        ? current
        : { paymentIdentity, shareError: false }),
      ...updates,
    }));
  };
  useEffect(() => {
    if (!bankBin || !props.bankDirectory) return;
    let active = true;
    void props.bankDirectory.list().then(banks => {
      if (active) setBankLookup({ bankBin, name: banks.find(bank => bank.bin === bankBin)?.name ?? null });
    }).catch(() => { if (active) setBankLookup({ bankBin, name: null }); });
    return () => { active = false; };
  }, [bankBin, props.bankDirectory]);
  const cardStyle = { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder, shadowColor: colors.glassShadow };
  const copyValue = (label: string, value: string) => {
    Clipboard.setString(value);
    setCopiedField(label);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedField(current => current === label ? null : current), 1_500);
  };
  const field = (label: string, value: string, prominent = false) => (
    <Pressable accessibilityRole="button"
      accessibilityLabel={copiedField === label ? `${label} copied` : `Copy ${label}`}
      accessibilityHint="Copies this value to the clipboard."
      onPress={() => copyValue(label, value)}
      style={({ pressed }) => [styles.fieldButton, pressed && styles.pressed]}>
      <View style={[styles.field, { borderTopColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        <Text numberOfLines={2} style={[styles.value, prominent && styles.accountNumber, { color: colors.text }]}>{value}</Text>
        <Ionicons name={copiedField === label ? 'checkmark-circle' : 'copy-outline'} size={18}
          color={copiedField === label ? colors.success : colors.primary} />
      </View>
    </Pressable>
  );
  const sharePayment = async () => {
    if (payment.kind !== 'ready') return;
    updateActionState({ shareError: false });
    try {
      await Share.share({
        title: 'DontLift payment details',
        message: [
          `Amount: ${formatVND(payment.amountVnd)} VND`,
          `Recipient: ${payment.accountName}`,
          `Bank: ${bankName ?? `BIN ${payment.bankBin}`}`,
          `Account: ${payment.accountNumber}`,
          `Transfer memo: ${payment.memo}`,
          `VietQR: ${payment.imageUrl}`,
        ].join('\n'),
      });
    } catch {
      updateActionState({ shareError: true });
    }
  };
  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${(props.backLabel ?? 'Bill breakdown').toLowerCase()}`} onPress={props.onBack}
            style={({ pressed }) => [styles.navButton, { backgroundColor: colors.glassSurface, borderColor: colors.glassBorder }, pressed && styles.pressed]}>
            <Ionicons name="arrow-back" size={19} color={colors.text} />
          </Pressable>
          <Text accessibilityRole="header" style={[styles.navTitle, { color: colors.text }]}>Transfer</Text>
          <View style={styles.navButtonSpacer} />
        </View>
        <View style={styles.paymentHeading}>
          <View style={styles.headingRow}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>VIETQR PAYMENT</Text>
            <Text style={[styles.room, { color: colors.textSecondary }]}>Room {props.roomPin}</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{payment.kind === 'paid' ? 'Payment confirmed'
            : payment.kind === 'zero' ? 'Nothing to pay' : 'Pay your share'}</Text>
        </View>
      </View>
      {payment.kind === 'ready' ? (
        <>
          <GlassCard style={[styles.detailsCard, cardStyle]}>
            <View style={styles.detailsContent}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Transfer details</Text>
              <Text style={[styles.detailsHint, { color: colors.textSecondary }]}>Tap any row to copy its value.</Text>
              {field('Recipient', payment.accountName)}
              {field('Account number', payment.accountNumber, true)}
              {field('Bank', bankName ?? (bankBin ? `BIN ${bankBin}` : 'Bank name unavailable'))}
              {field('Transfer memo', payment.memo)}
            </View>
          </GlassCard>
          <GlassCard style={[styles.qrCard, cardStyle]}>
            <View style={styles.qrContent}>
              <View style={[styles.amountBadge, { backgroundColor: colors.backgroundSelected, borderColor: colors.primary }]}>
                <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>AMOUNT TO TRANSFER</Text>
                <Text accessibilityLabel={`${payment.amountVnd} Vietnamese dong`} style={[styles.amountBadgeText, { color: colors.primary }]}>
                  {formatVND(payment.amountVnd)} VND
                </Text>
              </View>
              <QrImage key={`${payment.identity}:${imageAttempt}`} uri={payment.imageUrl} colors={colors}
                onRetry={() => setImageAttempt(attempt => attempt + 1)} />
              <View style={[styles.qrCaption, { backgroundColor: colors.backgroundSelected }]}>
                <Ionicons name="scan-outline" size={14} color={colors.primary} />
                <Text style={[styles.caption, { color: colors.text }]}>Scan with your banking app</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Share payment details" onPress={() => { void sharePayment(); }}
                style={({ pressed }) => [styles.shareActionButton, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }, pressed && styles.pressed]}>
                <Text style={[styles.shareButtonText, { color: colors.primary }]}>Share</Text>
              </Pressable>
              {shareError ? <Text accessibilityRole="alert" style={[styles.caption, { color: colors.error }]}>Could not open the share menu.</Text> : null}
            </View>
          </GlassCard>
        </>
      ) : (
        <GlassCard style={[styles.paymentCard, cardStyle]}>
          <View style={styles.unavailable}>
            {payment.kind === 'unavailable' && loading && props.isOnline ? <ActivityIndicator color={colors.primary} /> : null}
            <Text accessibilityRole={payment.kind === 'unavailable' && !loading ? 'alert' : undefined}
              style={[styles.body, { color: colors.textSecondary }]}>{payment.kind === 'zero'
                ? 'Your published share is 0 VND. No transfer is needed.' : payment.kind === 'paid'
                  ? `The Host marked your ${formatVND(payment.amountVnd)} VND share as paid.` : loading && props.isOnline
                    ? 'Confirming the current bill and Host payment details…' : payment.message}</Text>
            {payment.kind === 'paid' && payment.paidAtUtcMs !== null ? (
              <Text style={[styles.caption, { color: colors.textSecondary }]}>Confirmed {new Date(payment.paidAtUtcMs).toLocaleString()}</Text>
            ) : null}
            {payment.kind === 'unavailable' && !loading ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Refresh bill and Host payment details"
                disabled={!props.isOnline} accessibilityState={{ disabled: !props.isOnline }} onPress={props.onRefresh}
                style={({ pressed }) => [styles.refresh, { backgroundColor: colors.primary }, pressed && styles.pressed, !props.isOnline && styles.disabled]}>
                <Text style={[styles.actionText, { color: colors.onPrimary }]}>Refresh payment details</Text>
              </Pressable>
            ) : null}
          </View>
        </GlassCard>
      )}
      <Text style={[styles.footnote, { color: colors.textSecondary }]}>Your banking app completes the transfer. The Host confirms payment after checking their account.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingBottom: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  titleBlock: { gap: 12, paddingHorizontal: 4 },
  topBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  navButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  navButtonSpacer: { width: 44, height: 44 },
  navTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  paymentHeading: { gap: 4 },
  paymentCard: { padding: 20, gap: 12 },
  headingRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  room: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  title: { fontSize: 23, lineHeight: 28, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 21 },
  centered: { textAlign: 'center' },
  qrFrame: { width: '100%', maxWidth: 260, alignSelf: 'center', aspectRatio: 1, borderWidth: 1, borderRadius: 20, padding: 12, overflow: 'hidden' },
  qrImage: { width: '100%', height: '100%' },
  centerLogoOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  centerLogoBadge: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(37,99,235,0.16)' },
  centerLogo: { width: 24, height: 18 },
  qrOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  imageStatus: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: { minHeight: 48, paddingHorizontal: 20, justifyContent: 'center' },
  caption: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  detailsCard: { padding: 16 }, qrCard: { padding: 14 },
  detailsContent: { width: '100%', gap: 4 }, qrContent: { width: '100%', alignItems: 'stretch', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  detailsHint: { fontSize: 12, lineHeight: 17, marginBottom: 2 },
  fieldButton: { width: '100%' },
  field: { width: '100%', minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  label: { width: 76, flexShrink: 0, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  value: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '600', textAlign: 'right' },
  accountNumber: { fontSize: 17, lineHeight: 22, fontVariant: ['tabular-nums'] },
  qrCaption: { maxWidth: 260, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  amountBadge: { width: '100%', maxWidth: 260, alignSelf: 'center', alignItems: 'center', gap: 2, paddingVertical: 9, borderRadius: 16, borderWidth: 1 },
  amountLabel: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4 },
  amountBadgeText: { fontSize: 19, lineHeight: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  shareActionButton: { width: '100%', maxWidth: 260, minHeight: 44, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, borderWidth: 1, borderRadius: 16 },
  shareButtonText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  unavailable: { gap: 16, width: '100%' },
  refresh: { minHeight: 48, padding: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  footnote: { paddingHorizontal: 8, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
