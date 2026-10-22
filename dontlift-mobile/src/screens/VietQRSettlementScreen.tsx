import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Image } from 'expo-image';
import { GlassCard } from '../components/GlassCard';
import { Colors } from '../constants/theme';
import { formatVND } from '../constants';
import type { PublishedBillState } from '../features/settlement/published-bill-state';
import type { SettlementDetailsState } from '../features/settlement/settlement-details-repository';
import { buildVietQrPayment } from '../features/settlement/vietqr-payload';

type Props = {
  roomId: string; roomPin: string; actorUid: string;
  member: { uid: string; displayName: string; status: string } | undefined;
  billState: PublishedBillState; detailsState: SettlementDetailsState; isOnline: boolean;
  onRefresh: () => void; onBack: () => void;
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
  useEffect(() => {
    const timer = setInterval(() => setNowUtcMs(Date.now()), 1_000);
    const subscription = AppState.addEventListener('change', state => {
      setNowUtcMs(Date.now());
      setForeground(state === 'active');
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const payment = buildVietQrPayment({ ...props, nowUtcMs, isOnline: props.isOnline && foreground });
  const loading = props.detailsState.kind === 'loading' || props.billState.kind === 'loading';
  const cardStyle = { backgroundColor: colors.authFormSurface, borderColor: colors.glassBorder, shadowColor: colors.glassShadow };
  const field = (label: string, value: string, prominent = false) => (
    <View style={[styles.field, { borderTopColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text selectable style={[styles.value, prominent && styles.accountNumber, { color: colors.text }]}>{value}</Text>
    </View>
  );
  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to bill breakdown" onPress={props.onBack}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Text style={[styles.actionText, { color: colors.primary }]}>‹  Bill breakdown</Text>
      </Pressable>
      <GlassCard style={[styles.paymentCard, cardStyle]}>
        <View style={styles.headingRow}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>VIETQR PAYMENT</Text>
          <Text style={[styles.room, { color: colors.textSecondary }]}>Room {props.roomPin}</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{payment.kind === 'paid' ? 'Payment confirmed'
          : payment.kind === 'zero' ? 'Nothing to pay' : 'Pay your share'}</Text>
        {payment.kind === 'ready' ? (
          <>
            <Text accessibilityLabel={`${payment.amountVnd} Vietnamese dong`} style={[styles.amount, { color: colors.text }]}>
              {formatVND(payment.amountVnd)} <Text style={[styles.currency, { color: colors.textSecondary }]}>VND</Text>
            </Text>
            <Text style={[styles.body, styles.centered, { color: colors.textSecondary }]}>Scan with your banking app, or use its image scanner. Check the recipient and amount before confirming.</Text>
            <QrImage key={`${payment.identity}:${imageAttempt}`} uri={payment.imageUrl} colors={colors}
              onRetry={() => setImageAttempt(attempt => attempt + 1)} />
            <Text style={[styles.caption, { color: colors.textSecondary }]}>For your current published share</Text>
          </>
        ) : (
          <View style={styles.unavailable}>
            {payment.kind === 'unavailable' && loading && props.isOnline ? <ActivityIndicator color={colors.primary} /> : null}
            <Text accessibilityRole={payment.kind === 'unavailable' && !loading ? 'alert' : undefined}
              style={[styles.body, { color: colors.textSecondary }]}>{payment.kind === 'zero'
                ? 'Your published share is 0 VND. No transfer is needed.' : payment.kind === 'paid'
                  ? `The Host marked your ${formatVND(payment.amountVnd)} VND share as paid.` : payment.message}</Text>
            {payment.kind === 'paid' && payment.paidAtUtcMs !== null ? (
              <Text style={[styles.caption, { color: colors.textSecondary }]}>Confirmed {new Date(payment.paidAtUtcMs).toLocaleString()}</Text>
            ) : null}
            {payment.kind === 'unavailable' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Refresh bill and Host payment details"
                disabled={!props.isOnline} accessibilityState={{ disabled: !props.isOnline }} onPress={props.onRefresh}
                style={({ pressed }) => [styles.refresh, { backgroundColor: colors.primary }, pressed && styles.pressed, !props.isOnline && styles.disabled]}>
                <Text style={[styles.actionText, { color: colors.onPrimary }]}>Refresh payment details</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </GlassCard>
      {payment.kind === 'ready' ? (
        <GlassCard style={[styles.detailsCard, cardStyle]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Transfer details</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>Long press a value to copy it.</Text>
          {field('Account holder', payment.accountName)}
          {field('Account number', payment.accountNumber, true)}
          {field('Bank BIN', payment.bankBin)}
          {field('Transfer memo', payment.memo)}
        </GlassCard>
      ) : null}
      <Text style={[styles.footnote, { color: colors.textSecondary }]}>Your banking app completes the transfer. The Host confirms payment after checking their account.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingBottom: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
  paymentCard: { padding: 24, gap: 16, alignItems: 'center' },
  headingRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  room: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  title: { fontSize: 25, fontWeight: '800', textAlign: 'center' },
  amount: { fontSize: 36, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'], flexShrink: 1 },
  currency: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 21 },
  centered: { textAlign: 'center' },
  qrFrame: { width: '100%', maxWidth: 320, aspectRatio: 1, borderWidth: 1, borderRadius: 20, padding: 16, overflow: 'hidden' },
  qrImage: { width: '100%', height: '100%' },
  qrOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  imageStatus: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: { minHeight: 48, paddingHorizontal: 20, justifyContent: 'center' },
  caption: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  detailsCard: { padding: 24, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  field: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, paddingBottom: 4 },
  label: { fontSize: 12, fontWeight: '600' },
  value: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  accountNumber: { fontSize: 22, lineHeight: 30, fontVariant: ['tabular-nums'] },
  unavailable: { gap: 16, width: '100%' },
  refresh: { minHeight: 48, padding: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  footnote: { paddingHorizontal: 8, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
