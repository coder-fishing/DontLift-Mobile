import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { Colors } from '../constants/theme';
import { GlassCard } from '../components/GlassCard';
import { RoomInvitationQr } from '../components/RoomInvitationQr';
import { DISPLAY_PREMIUM_PACKAGES, getBestValuePackageId, getPremiumPlanLabels, type PremiumApi, type PremiumOrder, type PremiumPackage } from '../features/premium/premium-api';
import { premiumIsActive } from '../features/premium/premium-entitlement';

const colors = Colors.light;
const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`;
type Pending = { requestId: string; packageId: string; orderCode?: number };
export function PremiumScreen({ uid, api, expiresAtUtcMs }: { uid: string; api: PremiumApi; expiresAtUtcMs?: number | null }) {
  const [packages, setPackages] = useState<PremiumPackage[]>(DISPLAY_PREMIUM_PACKAGES);
  const [catalogReady, setCatalogReady] = useState(false);
  const [selected, setSelected] = useState('MONTH_12');
  const [order, setOrder] = useState<PremiumOrder | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [switchPhase, setSwitchPhase] = useState<'debouncing' | 'cancelling' | 'creating' | null>(null);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const alive = useRef(true);
  const working = useRef(false);
  const pendingRef = useRef<Pending | null>(null);
  const orderRef = useRef<PremiumOrder | null>(null);
  const selectionTouched = useRef(false);
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchSequence = useRef(0);
  const key = `premium-checkout:${uid}`;
  const expiry = Math.max(order?.premiumExpiresAtUtcMs ?? 0, expiresAtUtcMs ?? 0) || null;
  const active = premiumIsActive(expiry);
  const bestValuePackageId = getBestValuePackageId(packages);
  const selectedPackage = packages.find(pack => pack.id === selected);
  const selectedPlanDuration = selectedPackage ? getPremiumPlanLabels(selectedPackage).duration : 'selected';

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (switchTimer.current) clearTimeout(switchTimer.current);
    };
  }, []);

  async function applyOrder(saved: PremiumOrder | null) {
    if (!alive.current) return orderRef.current;
    // Không để pointer cũ/thiết bị khác xóa request mới vừa gửi nhưng chưa nhận response.
    if (pendingRef.current && saved?.requestId !== pendingRef.current.requestId) return orderRef.current;
    if (orderRef.current?.requestId === saved?.requestId && orderRef.current?.status === 'PAID' && saved?.status !== 'PAID') return orderRef.current;
    orderRef.current = saved;
    setOrder(saved);
    if (saved && ['PAID', 'CANCELLED', 'EXPIRED'].includes(saved.status)) {
      pendingRef.current = null;
      setPending(null);
      // Trạng thái server đã chốt; lỗi dọn cache cục bộ không được che mất kết quả thanh toán.
      await AsyncStorage.removeItem(key).catch(() => undefined);
    } else if (saved) {
      const nextPending = { requestId: saved.requestId, packageId: saved.packageId, orderCode: saved.orderCode };
      const previousPending = pendingRef.current;
      pendingRef.current = nextPending;
      if (saved.status === 'PAID' || !selectionTouched.current) setSelected(saved.packageId);
      setPending(pendingRef.current);
      // Lưu mã đơn để lần sau hỏi trạng thái đúng QR, kể cả khi thiết bị khác tạo đơn mới hơn.
      if (previousPending?.requestId !== nextPending.requestId || previousPending.packageId !== nextPending.packageId
        || previousPending.orderCode !== nextPending.orderCode) {
        await AsyncStorage.setItem(key, JSON.stringify(nextPending)).catch(() => undefined);
      }
    }
    return saved;
  }

  async function refresh(forceRefresh = false) {
    const knownCheckout = pendingRef.current;
    if (!knownCheckout) return applyOrder(await api.current(forceRefresh));

    // Luôn đọc trạng thái của QR đang hiển thị; nếu chưa có mã đơn thì retry cùng requestId để phục hồi.
    const checkout = knownCheckout.orderCode != null
      ? await api.get(knownCheckout.orderCode, forceRefresh)
      : await api.create(knownCheckout.requestId, knownCheckout.packageId)
        .then(saved => api.get(saved.orderCode));
    if (checkout.requestId !== knownCheckout.requestId) {
      throw new Error('The saved Premium checkout could not be matched. Keep its QR and retry status later.');
    }
    const applied = await applyOrder(checkout);
    if (['PAID', 'CANCELLED', 'EXPIRED'].includes(checkout.status)) {
      // Chỉ sau khi checkout đã biết kết thúc mới nhận đơn mới nhất của tài khoản.
      return applyOrder(await api.current(forceRefresh));
    }
    return applied;
  }
  async function load() {
    if (working.current) return;
    working.current = true;
    setLoading(true); setError('');
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached && alive.current) {
        const value: unknown = JSON.parse(cached);
        if (value && typeof value === 'object' && 'requestId' in value && 'packageId' in value
          && typeof value.requestId === 'string' && typeof value.packageId === 'string'
          && (!('orderCode' in value) || (typeof value.orderCode === 'number' && Number.isSafeInteger(value.orderCode)))) {
          pendingRef.current = {
            requestId: value.requestId,
            packageId: value.packageId,
            ...('orderCode' in value && typeof value.orderCode === 'number' && Number.isSafeInteger(value.orderCode)
              ? { orderCode: value.orderCode } : {}),
          };
          setPending(pendingRef.current);
          setSelected(pendingRef.current.packageId);
        }
      }
      const offers = await api.packages();
      if (!alive.current) return;
      setPackages(offers);
      if (!selectionTouched.current && !pendingRef.current) {
        setSelected(getBestValuePackageId(offers) ?? offers[0]?.id ?? '');
      }
      setCatalogReady(true);
      await refresh();
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Unable to load Premium.'); }
    finally { working.current = false; if (alive.current) setLoading(false); }
  }
  useEffect(() => { void load(); }, [api, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkPaymentStatus() {
    if (working.current) return;
    working.current = true;
    setCheckingStatus(true);
    setError('');
    setStatusMessage('');
    try {
      const saved = await refresh(true);
      if (!alive.current) return;
      if (saved?.status === 'PAID') {
        setStatusMessage('Payment confirmed. Your Premium access has been extended.');
      } else if (saved?.status === 'PENDING' || saved?.status === 'CREATING') {
        setStatusMessage('PayOS has not confirmed this payment yet. If you just paid, wait a moment and check again.');
      } else if (saved?.status === 'CANCELLED' || saved?.status === 'EXPIRED') {
        setStatusMessage(`This payment is ${saved.status.toLowerCase()}. You can choose a package and try again.`);
      } else {
        setStatusMessage('No current Premium payment was found.');
      }
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : 'Could not check payment status. Please retry.');
    } finally {
      working.current = false;
      if (alive.current) setCheckingStatus(false);
    }
  }

  async function cancelAndSwitchPackage(packageId: string, sequence: number) {
    const activePending = pendingRef.current;
    if (working.current || !activePending || packageId === activePending.packageId || sequence !== switchSequence.current) return;
    working.current = true;
    setBusy(true);
    setSwitchPhase('cancelling');
    setError('');
    setStatusMessage('');
    try {
      const network = await Network.getNetworkStateAsync();
      if (network.isConnected !== true || network.isInternetReachable === false) {
        throw new Error('Connect to the internet before cancelling this payment.');
      }
      let result: PremiumOrder | null = null;
      let cancelFailure: unknown;
      try { result = await api.cancelCurrent(); } catch (cause) { cancelFailure = cause; }
      // A timed-out cancel may already have reached the server. Read the exact saved order
      // before retrying or creating anything; only a terminal server state permits replacement.
      if (!result && activePending.orderCode != null) {
        const reconciled = await api.get(activePending.orderCode, true).catch(() => null);
        if (reconciled?.requestId === activePending.requestId
          && ['PAID', 'CANCELLED', 'EXPIRED'].includes(reconciled.status)) result = reconciled;
      }
      if (cancelFailure && !result) throw cancelFailure;
      if (!alive.current) return;
      if (!result) throw new Error('No current payment was found. Refresh and review your Premium status.');
      if (result.requestId !== activePending.requestId) {
        throw new Error('A different Premium checkout is current for this account. This device’s saved QR was not confirmed cancelled, so no replacement was created. Select its package and resume that checkout before switching.');
      }
      const applied = await applyOrder(result);
      if (result.status === 'PAID' || applied?.status === 'PAID') {
        setSelected(result.packageId);
        selectionTouched.current = false;
        setSwitchPhase(null);
        setStatusMessage('Payment confirmed. Your Premium access has been extended; the package was not changed.');
        return;
      }
      if (result.status !== 'CANCELLED' && result.status !== 'EXPIRED') {
        throw new Error('The old payment is still active. Its QR remains valid, so the package was not changed.');
      }

      // Chỉ tạo request mới sau khi backend xác nhận QR cũ đã không còn thanh toán được.
      const nextRequest = { requestId: Crypto.randomUUID(), packageId };
      await AsyncStorage.setItem(key, JSON.stringify(nextRequest));
      if (!alive.current) return;
      pendingRef.current = nextRequest;
      setPending(nextRequest);
      orderRef.current = null;
      setOrder(null);
      setSelected(packageId);
      selectionTouched.current = false;
      setSwitchPhase('creating');
      setStatusMessage('Previous QR cancelled. Preparing the new package QR…');

      const nextOrder = await api.create(nextRequest.requestId, nextRequest.packageId);
      if (!alive.current) return;
      await applyOrder(nextOrder);
      if (!['PAID', 'CANCELLED', 'EXPIRED'].includes(nextOrder.status)) {
        setStatusMessage(nextOrder.qrCode
          ? 'New payment QR is ready. Scan it with your bank app to continue.'
          : 'The new payment is being prepared. Its QR will appear here when ready.');
      }
    } catch (cause) {
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : 'Could not cancel the current payment.');
        setStatusMessage('The previous QR cancellation was not confirmed. No replacement QR was created.');
      }
    } finally {
      working.current = false;
      if (alive.current) { setBusy(false); setSwitchPhase(null); }
    }
  }

  function selectPackage(packageId: string) {
    if (working.current) return;
    selectionTouched.current = true;
    setSelected(packageId);
    setError('');
    setStatusMessage('');
    if (switchTimer.current) clearTimeout(switchTimer.current);
    switchTimer.current = null;
    const sequence = ++switchSequence.current;
    const activePending = pendingRef.current;
    if (!activePending || packageId === activePending.packageId) {
      setSwitchPhase(null);
      return;
    }
    setSwitchPhase('debouncing');
    switchTimer.current = setTimeout(() => {
      switchTimer.current = null;
      if (!alive.current || sequence !== switchSequence.current) return;
      void cancelAndSwitchPackage(packageId, sequence);
    }, 400);
  }

  function retryPackageSwitch() {
    const activePending = pendingRef.current;
    if (working.current || !activePending || selected === activePending.packageId) return;
    const sequence = ++switchSequence.current;
    setError('');
    setStatusMessage('');
    setSwitchPhase('cancelling');
    void cancelAndSwitchPackage(selected, sequence);
  }

  useEffect(() => {
    if (!pending) return;
    let checking = false;
    let attempts = 0;
    const check = async () => {
      if (checking || working.current || selected !== pending.packageId || attempts >= 12) return;
      checking = true; attempts++;
      try { await refresh(); }
      catch { /* Giữ đơn durable khi mất mạng; user có thể kiểm tra lại. */ }
      finally { checking = false; }
    };
    const timer = setInterval(() => { if (AppState.currentState === 'active') void check(); }, 5000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') { attempts = 0; void check(); } });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [api, pending?.requestId, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkout() {
    if (working.current || !catalogReady) return;
    working.current = true; setBusy(true); setError('');
    try {
      const network = await Network.getNetworkStateAsync();
      if (network.isConnected !== true || network.isInternetReachable === false) throw new Error('Connect to the internet to purchase Premium.');
      const request = pending ?? { requestId: Crypto.randomUUID(), packageId: selected };
      // Lưu request trước HTTP; timeout/restart tiếp tục cùng đơn, không mở thanh toán thứ hai.
      await AsyncStorage.setItem(key, JSON.stringify(request));
      if (!alive.current) return;
      pendingRef.current = request; setPending(request);
      const result = await api.create(request.requestId, request.packageId);
      if (!alive.current) return;
      selectionTouched.current = false;
      await applyOrder(result);
      if (['PAID', 'CANCELLED', 'EXPIRED'].includes(result.status)) {
        // Xóa identity của request terminal trước; refresh sau đó mới có thể nhận đơn mới hơn.
        await refresh();
        return;
      }
      if (result.checkoutUrl) {
        if (!/^https:\/\/pay\.payos\.vn\//.test(result.checkoutUrl)) throw new Error('The checkout link is invalid.');
      }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Checkout failed. Please retry.'); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }

  return <View style={styles.root}>
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>DONTLIFT PREMIUM</Text>
      <Text accessibilityRole="header" style={styles.title}>Choose your plan</Text>
      <Text style={styles.subtitle}>Unlimited rooms and participants. One payment, no auto-renewal.</Text>
      {expiry != null ? <Text style={styles.expiry}>{active ? 'Premium until' : 'Previous access ended'} {new Date(expiry).toLocaleDateString('vi-VN')}</Text> : null}
    </View>
    {loading ? <ActivityIndicator accessibilityLabel="Loading Premium packages" color={colors.primary} /> : null}
    <View accessibilityRole="radiogroup" accessibilityLabel="Premium plans" style={styles.packages}>
      {packages.map(pack => {
        const labels = getPremiumPlanLabels(pack);
        const bonusMonths = labels.bonusMonths;
        const isSelected = selected === pack.id;
        const isBestValue = bestValuePackageId === pack.id && packages.length > 1;
        return <Pressable key={pack.id} accessibilityRole="radio"
          accessibilityLabel={`${pack.paidMonths} ${pack.paidMonths === 1 ? 'month' : 'months'}, ${money(pack.amountVnd)}${bonusMonths > 0 ? `, plus ${bonusMonths} months free, use Premium for ${pack.grantedMonths} months` : ', basic access'}`}
          accessibilityHint={pending && pack.id !== pending.packageId
            ? 'Selecting this plan will cancel the current payment QR after a short pause, then replace it when cancellation is confirmed.'
            : 'Select this Premium package'}
          accessibilityState={{ checked: isSelected, disabled: busy || loading || checkingStatus || switchPhase === 'cancelling' || switchPhase === 'creating' }}
          disabled={busy || loading || checkingStatus || switchPhase === 'cancelling' || switchPhase === 'creating'}
          onPress={() => selectPackage(pack.id)}
          style={({ pressed }) => [styles.package, isSelected && styles.selected, pressed && styles.packagePressed]}>
          <View style={styles.packageRow}>
            <View style={styles.packageCopy}>
              {isBestValue ? <Text style={styles.bestValue}>BEST VALUE</Text> : null}
              <Text style={styles.duration}>{labels.duration}</Text>
              {labels.bonus ? <Text style={styles.bonus}>{labels.bonus}</Text> : null}
              <Text style={styles.caption}>{labels.access}</Text>
            </View>
            <View style={styles.priceChoice}>
              <Text style={styles.price}>{money(pack.amountVnd)}</Text>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected ? <View style={styles.radioDot} /> : null}
              </View>
            </View>
          </View>
        </Pressable>;
      })}
    </View>
    {order && ['CANCELLED', 'EXPIRED'].includes(order.status) ? <Text style={styles.caption}>This checkout is {order.status.toLowerCase()}. Choose a package to start again.</Text> : null}
    {pending ? <GlassCard className="" style={styles.status}>
      <Text style={styles.duration}>{selected !== pending.packageId ? 'Switching Premium package' : order?.status === 'CREATING' ? 'Payment being prepared' : order ? 'Payment awaiting confirmation' : 'Payment setup needs retry'}</Text>
      {order && selected === pending.packageId ? <Text style={styles.price}>{money(order.amountVnd)}</Text> : null}
      {selected !== pending.packageId || switchPhase === 'creating' ? <View style={styles.switchPanel}>
        {switchPhase ? <View accessibilityRole="progressbar" accessibilityLabel="Preparing new payment QR" style={styles.qrSkeleton}>
          <View style={styles.skeletonQr} />
          <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
          <Text style={styles.caption}>{switchPhase === 'debouncing' ? `Preparing ${selectedPlanDuration} plan…` : switchPhase === 'cancelling' ? 'Cancelling the current payment QR…' : 'Creating your new payment QR…'}</Text>
          <Text style={styles.caption}>The new QR appears after the server confirms the previous payment is cancelled.</Text>
        </View> : <>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : <Text style={styles.caption}>Choose a plan to replace the current payment QR.</Text>}
          {statusMessage ? <Text style={styles.caption}>{statusMessage}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Retry package switch" disabled={busy || checkingStatus} style={styles.secondary} onPress={retryPackageSwitch}>
            <Text style={styles.link}>Retry package switch</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Keep current Premium package" disabled={busy || checkingStatus} style={styles.secondary} onPress={() => selectPackage(pending.packageId)}>
            <Text style={styles.link}>Keep current package</Text>
          </Pressable>
        </>}
      </View> : order?.qrCode ? <View style={styles.qrPanel}>
        <RoomInvitationQr value={order.qrCode} size={232} accessibilityLabel="Premium payment QR code" />
        <Text style={styles.qrHelp}>Scan this code with your bank app. Payment confirmation will appear here automatically.</Text>
      </View> : order?.status === 'CREATING' ? <Text style={styles.caption}>Your payment QR is being prepared. Keep this screen open; it will appear automatically.</Text>
        : order?.status === 'PENDING' ? <Text style={styles.caption}>The payment link is ready, but its QR could not be loaded yet. Retry below or open payOS checkout.</Text> : null}
      {selected === pending.packageId ? <Text style={styles.caption}>Already transferred? Check payment status. Your access updates after verification.</Text> : null}
      {order?.checkoutUrl && selected === pending.packageId ? <Pressable accessibilityRole="button" accessibilityLabel="Open payOS checkout" style={styles.secondary}
        onPress={() => { void WebBrowser.openBrowserAsync(order.checkoutUrl!); }}>
        <Text style={styles.link}>Open payOS checkout</Text>
      </Pressable> : null}
      {statusMessage && selected === pending.packageId ? <Text accessibilityRole="alert" style={styles.statusMessage}>{statusMessage}</Text> : null}
      {selected === pending.packageId ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || checkingStatus }} disabled={busy || checkingStatus} style={styles.secondary} onPress={() => { void checkPaymentStatus(); }}>
        {checkingStatus ? <ActivityIndicator accessibilityLabel="Checking payment status" color={colors.primary} /> : <Text style={styles.link}>Check payment status</Text>}
      </Pressable> : null}
    </GlassCard> : order?.status === 'PAID' ? <GlassCard className="" style={styles.status}>
      <Text accessibilityRole="header" style={styles.duration}>Payment confirmed</Text>
      <Text accessibilityRole="alert" style={styles.expiry}>Your Premium access has been extended{expiry ? ` until ${new Date(expiry).toLocaleDateString('vi-VN')}` : ''}.</Text>
      {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
    </GlassCard> : null}
    {error && !(pending && selected !== pending.packageId) ? <View accessibilityRole="alert"><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => { void load(); }}><Text style={styles.link}>Try again</Text></Pressable></View> : null}
    {!(pending && order?.qrCode) && !(pending && selected !== pending.packageId) ? <Pressable accessibilityRole="button" accessibilityLabel={pending ? 'Continue saved Premium checkout' : 'Purchase selected Premium package'}
      accessibilityState={{ disabled: busy || loading || !catalogReady }}
      disabled={busy || loading || !catalogReady} onPress={() => { void checkout(); }}
      style={[styles.button, (busy || loading || !catalogReady) && styles.disabled]}>
      {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>{pending ? order?.status === 'CREATING' ? 'Retry payment setup' : 'Load payment QR' : active ? 'Extend Premium' : 'Continue to Payment'}</Text>}
    </Pressable> : null}
    <Text style={styles.footer}>Purchase online. When you extend early, the new months are added after your current access expires.</Text>
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 18, paddingBottom: 24 }, heading: { gap: 8 }, eyebrow: { color: colors.primary, fontWeight: '700', fontSize: 12, letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: '700' }, subtitle: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  expiry: { color: colors.primary, fontSize: 15, lineHeight: 22, fontWeight: '600' }, packages: { gap: 12 },
  package: { minHeight: 88, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, justifyContent: 'center' },
  selected: { borderColor: colors.primary, borderWidth: 2, padding: 14, backgroundColor: colors.backgroundSelected },
  packagePressed: { opacity: 0.82 }, packageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  packageCopy: { flex: 1, alignItems: 'flex-start', gap: 4 }, priceChoice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexShrink: 0 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.primary }, radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  bestValue: { color: colors.primary, backgroundColor: colors.backgroundSelected, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, overflow: 'hidden', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 7 },
  bonus: { color: colors.success, backgroundColor: colors.successSurface, fontSize: 14, fontWeight: '700', overflow: 'hidden', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7 },
  duration: { color: colors.text, fontSize: 17, fontWeight: '700' }, price: { color: colors.text, fontSize: 19, fontWeight: '700' },
  caption: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 }, status: { padding: 18, gap: 10 }, statusMessage: { color: colors.primary, fontSize: 14, lineHeight: 21, fontWeight: '600' }, secondary: { minHeight: 44, justifyContent: 'center' },
  switchPanel: { gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  qrSkeleton: { gap: 12, alignItems: 'center', paddingVertical: 8 },
  skeletonQr: { width: 184, height: 184, borderRadius: 18, backgroundColor: colors.backgroundElement },
  skeletonLine: { height: 14, borderRadius: 7, backgroundColor: colors.backgroundElement, width: '82%' },
  skeletonLineShort: { width: '48%' },
  pressed: { opacity: 0.72 },
  qrPanel: { alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, backgroundColor: colors.inputSurface },
  qrHelp: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  link: { color: colors.primary, fontWeight: '600', fontSize: 15 }, error: { color: colors.error, fontSize: 14, lineHeight: 21 },
  button: { backgroundColor: colors.primary, minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 14 },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 }, disabled: { opacity: 0.5 }, footer: { color: colors.textSecondary, textAlign: 'center', fontSize: 13, lineHeight: 20 },
});
