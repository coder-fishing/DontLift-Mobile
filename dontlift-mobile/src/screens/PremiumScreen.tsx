import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { Colors } from '../constants/theme';
import { GlassCard } from '../components/GlassCard';
import { RoomInvitationQr } from '../components/RoomInvitationQr';
import { DISPLAY_PREMIUM_PACKAGES, type PremiumApi, type PremiumOrder, type PremiumPackage } from '../features/premium/premium-api';
import { premiumIsActive } from '../features/premium/premium-entitlement';

const colors = Colors.light;
const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`;
type Pending = { requestId: string; packageId: string };
export function PremiumScreen({ uid, api, expiresAtUtcMs }: { uid: string; api: PremiumApi; expiresAtUtcMs?: number | null }) {
  const [packages, setPackages] = useState<PremiumPackage[]>(DISPLAY_PREMIUM_PACKAGES);
  const [catalogReady, setCatalogReady] = useState(false);
  const [selected, setSelected] = useState('MONTH_1');
  const [order, setOrder] = useState<PremiumOrder | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [switchConfirmed, setSwitchConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const alive = useRef(true);
  const working = useRef(false);
  const pendingRef = useRef<Pending | null>(null);
  const orderRef = useRef<PremiumOrder | null>(null);
  const selectionTouched = useRef(false);
  const key = `premium-checkout:${uid}`;
  const expiry = Math.max(order?.premiumExpiresAtUtcMs ?? 0, expiresAtUtcMs ?? 0) || null;
  const active = premiumIsActive(expiry);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
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
      pendingRef.current = { requestId: saved.requestId, packageId: saved.packageId };
      if (saved.status === 'PAID' || !selectionTouched.current) setSelected(saved.packageId);
      setPending(pendingRef.current);
    }
    return saved;
  }

  async function refresh(forceRefresh = false) {
    return applyOrder(await api.current(forceRefresh));
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
          && typeof value.requestId === 'string' && typeof value.packageId === 'string') {
          pendingRef.current = value as Pending;
          setPending(pendingRef.current);
          setSelected(pendingRef.current.packageId);
        }
      }
      const offers = await api.packages();
      if (!alive.current) return;
      setPackages(offers);
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

  async function cancelAndSwitchPackage(packageId: string) {
    if (working.current || !pending || packageId === pending.packageId || !switchConfirmed) return;
    working.current = true;
    setBusy(true);
    setError('');
    setStatusMessage('');
    try {
      const network = await Network.getNetworkStateAsync();
      if (network.isConnected !== true || network.isInternetReachable === false) {
        throw new Error('Connect to the internet before cancelling this payment.');
      }
      const result = await api.cancelCurrent();
      if (!alive.current) return;
      if (!result) throw new Error('No current payment was found. Refresh and review your Premium status.');
      const applied = await applyOrder(result);
      if (result.status === 'PAID' || applied?.status === 'PAID') {
        setSelected(result.packageId);
        selectionTouched.current = false;
        setSwitchConfirmed(false);
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
      setSwitchConfirmed(false);
      setStatusMessage('Previous QR cancelled. Preparing the new package QR…');

      const nextOrder = await api.create(nextRequest.requestId, nextRequest.packageId);
      if (!alive.current) return;
      orderRef.current = nextOrder;
      setOrder(nextOrder);
      if (['PAID', 'CANCELLED', 'EXPIRED'].includes(nextOrder.status)) {
        await applyOrder(nextOrder);
      } else {
        setPending(nextRequest);
        setStatusMessage(nextOrder.qrCode
          ? 'New payment QR is ready. Scan it with your bank app to continue.'
          : 'The new payment is being prepared. Its QR will appear here when ready.');
      }
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : 'Could not cancel the current payment.');
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }

  useEffect(() => {
    if (!pending) return;
    let checking = false;
    let attempts = 0;
    const check = async () => {
      if (checking || working.current || attempts >= 12) return;
      checking = true; attempts++;
      try { await refresh(); }
      catch { /* Giữ đơn durable khi mất mạng; user có thể kiểm tra lại. */ }
      finally { checking = false; }
    };
    const timer = setInterval(() => { if (AppState.currentState === 'active') void check(); }, 5000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') { attempts = 0; void check(); } });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [api, pending?.requestId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      orderRef.current = result;
      setOrder(result);
      selectionTouched.current = false;
      if (['PAID', 'CANCELLED', 'EXPIRED'].includes(result.status)) {
        // Xóa identity của request terminal trước; refresh sau đó mới có thể nhận đơn mới hơn.
        await applyOrder(result);
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
      <Text accessibilityRole="header" style={styles.title}>{active ? 'More time, less distraction.' : 'Make room for focus.'}</Text>
      <Text style={styles.subtitle}>Unlimited room creation and participant capacity. One payment, no automatic renewal.</Text>
      {expiry != null ? <Text style={styles.expiry}>{active ? 'Premium until' : 'Previous access ended'} {new Date(expiry).toLocaleDateString('vi-VN')}</Text> : null}
    </View>
    {loading ? <ActivityIndicator accessibilityLabel="Loading Premium packages" color={colors.primary} /> : null}
    <View accessibilityRole="radiogroup" style={styles.packages}>
      {packages.map(pack => <Pressable key={pack.id} accessibilityRole="radio" accessibilityState={{ checked: selected === pack.id, disabled: busy || loading || checkingStatus }}
        disabled={busy || loading || checkingStatus} onPress={() => { selectionTouched.current = true; setSelected(pack.id); setSwitchConfirmed(false); setStatusMessage(''); }}
        style={[styles.package, selected === pack.id && styles.selected]}>
        <View style={styles.row}><Text style={styles.duration}>{pack.grantedMonths} {pack.grantedMonths === 1 ? 'month' : 'months'}</Text><Text style={styles.price}>{money(pack.amountVnd)}</Text></View>
        <Text style={styles.caption}>{pack.grantedMonths > pack.paidMonths ? `Pay for ${pack.paidMonths} months, get ${pack.grantedMonths - pack.paidMonths} extra` : 'A month to build your rhythm'}</Text>
      </Pressable>)}
    </View>
    {order && ['CANCELLED', 'EXPIRED'].includes(order.status) ? <Text style={styles.caption}>This checkout is {order.status.toLowerCase()}. Choose a package to start again.</Text> : null}
    {pending ? <GlassCard className="" style={styles.status}>
      <Text style={styles.duration}>{order?.status === 'CREATING' ? 'Payment being prepared' : order ? 'Payment awaiting confirmation' : 'Payment setup needs retry'}</Text>
      {order ? <Text style={styles.price}>{money(order.amountVnd)}</Text> : null}
      {order?.qrCode ? <View style={styles.qrPanel}>
        <RoomInvitationQr value={order.qrCode} size={232} accessibilityLabel="Premium payment QR code" />
        <Text style={styles.qrHelp}>Scan this code with your bank app. Payment confirmation will appear here automatically.</Text>
      </View> : order?.status === 'CREATING' ? <Text style={styles.caption}>Your payment QR is being prepared. Keep this screen open; it will appear automatically.</Text>
        : order?.status === 'PENDING' ? <Text style={styles.caption}>The payment link is ready, but its QR could not be loaded yet. Retry below or open payOS checkout.</Text> : null}
      <Text style={styles.caption}>Already transferred? Check payment status. Your access updates after verification.</Text>
      {order?.checkoutUrl ? <Pressable accessibilityRole="button" accessibilityLabel="Open payOS checkout" style={styles.secondary}
        onPress={() => { void WebBrowser.openBrowserAsync(order.checkoutUrl!); }}>
        <Text style={styles.link}>Open payOS checkout</Text>
      </Pressable> : null}
      {statusMessage ? <Text accessibilityRole="alert" style={styles.statusMessage}>{statusMessage}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || checkingStatus }} disabled={busy || checkingStatus} style={styles.secondary} onPress={() => { void checkPaymentStatus(); }}>
        {checkingStatus ? <ActivityIndicator accessibilityLabel="Checking payment status" color={colors.primary} /> : <Text style={styles.link}>Check payment status</Text>}
      </Pressable>
      {selected !== pending.packageId ? <View style={styles.switchPanel}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel="Cancel the current payment QR before switching packages"
          accessibilityState={{ checked: switchConfirmed, disabled: busy || checkingStatus }} disabled={busy || checkingStatus}
          onPress={() => setSwitchConfirmed(value => !value)} style={({ pressed }) => [styles.switchCheckbox, pressed && styles.pressed]}>
          <View style={[styles.checkbox, switchConfirmed && styles.checkboxChecked]}>
            {switchConfirmed ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.switchCopy}>I understand the current QR will be cancelled before a new payment QR is created.</Text>
        </Pressable>
        {switchConfirmed ? <Pressable accessibilityRole="button" accessibilityLabel="Confirm package change and load new payment QR"
          accessibilityState={{ disabled: busy || checkingStatus }} disabled={busy || checkingStatus}
          style={[styles.button, (busy || checkingStatus) && styles.disabled]}
          onPress={() => { void cancelAndSwitchPackage(selected); }}>
          {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>Confirm and load new QR</Text>}
        </Pressable> : null}
      </View> : null}
    </GlassCard> : order?.status === 'PAID' ? <GlassCard className="" style={styles.status}>
      <Text accessibilityRole="header" style={styles.duration}>Payment confirmed</Text>
      <Text accessibilityRole="alert" style={styles.expiry}>Your Premium access has been extended{expiry ? ` until ${new Date(expiry).toLocaleDateString('vi-VN')}` : ''}.</Text>
      {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
    </GlassCard> : null}
    {error ? <View accessibilityRole="alert"><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => { void load(); }}><Text style={styles.link}>Try again</Text></Pressable></View> : null}
    {!(pending && order?.qrCode) && !(pending && selected !== pending.packageId) ? <Pressable accessibilityRole="button" accessibilityLabel={pending ? 'Continue saved Premium checkout' : 'Purchase selected Premium package'}
      accessibilityState={{ disabled: busy || loading || !catalogReady }}
      disabled={busy || loading || !catalogReady} onPress={() => { void checkout(); }}
      style={[styles.button, (busy || loading || !catalogReady) && styles.disabled]}>
      {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>{pending ? order?.status === 'CREATING' ? 'Retry payment setup' : 'Load payment QR' : active ? 'Extend Premium' : 'Continue with payOS'}</Text>}
    </Pressable> : null}
    <Text style={styles.footer}>Purchase online. When you extend early, the new months are added after your current access expires.</Text>
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 20, paddingBottom: 24 }, heading: { gap: 12 }, eyebrow: { color: colors.primary, fontWeight: '700', fontSize: 12, letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: '700' }, subtitle: { color: colors.textSecondary, fontSize: 16, lineHeight: 24 },
  expiry: { color: colors.primary, fontSize: 15, lineHeight: 22, fontWeight: '600' }, packages: { gap: 10 },
  package: { padding: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputSurface, gap: 6 },
  selected: { borderColor: colors.primary, borderWidth: 2, padding: 17, backgroundColor: colors.authBackdrop }, row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  duration: { color: colors.text, fontSize: 17, fontWeight: '600' }, price: { color: colors.text, fontSize: 20, fontWeight: '700' },
  caption: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 }, status: { padding: 18, gap: 10 }, statusMessage: { color: colors.primary, fontSize: 14, lineHeight: 21, fontWeight: '600' }, secondary: { minHeight: 44, justifyContent: 'center' },
  switchPanel: { gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  switchCheckbox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 5, borderWidth: 2, borderColor: colors.textSecondary, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.onPrimary, fontSize: 16, lineHeight: 20, fontWeight: '700' },
  switchCopy: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 }, pressed: { opacity: 0.72 },
  qrPanel: { alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, backgroundColor: colors.inputSurface },
  qrHelp: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  link: { color: colors.primary, fontWeight: '600', fontSize: 15 }, error: { color: colors.error, fontSize: 14, lineHeight: 21 },
  button: { backgroundColor: colors.primary, minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 14 },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 }, disabled: { opacity: 0.5 }, footer: { color: colors.textSecondary, textAlign: 'center', fontSize: 13, lineHeight: 20 },
});
