import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Network from 'expo-network';
import { Colors } from '../constants/theme';
import { formatTime, formatVND } from '../constants';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { HistoryPaymentScreen } from './HistoryPaymentScreen';
import type { GroupHistoryRepository, GroupHistoryDetail } from '../features/history/group-history-repository';
import { mergeGroupHistory, type GroupHistoryCursor, type GroupHistoryEntry } from '../features/history/group-history-model';
import { shouldRefreshGroupHistoryOnReconnect } from '../features/history/group-history-refresh-policy';
import { getGroupHistoryPalette } from '../constants/group-history-theme';

type Props = { userId: string; repository: GroupHistoryRepository; serverPremium: boolean; localPremium?: boolean; initialRoomId?: string; onBack: () => void; colors?: typeof Colors.light | typeof Colors.dark };
type HistoryListRow = { kind: 'history'; entry: GroupHistoryEntry }
  | { kind: 'member'; member: GroupHistoryDetail['members'][number] };
export function GroupHistoryScreen({ userId, repository, serverPremium, localPremium = serverPremium, initialRoomId, onBack, colors: providedColors }: Props) {
  const colors = providedColors ?? getGroupHistoryPalette(useColorScheme());
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<GroupHistoryEntry[]>([]);
  const [selected, setSelected] = useState<GroupHistoryEntry | null>(null);
  const [paymentRoomId, setPaymentRoomId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupHistoryDetail | null>(null);
  const [detailSource, setDetailSource] = useState<'checking' | 'saved' | 'firebase'>('checking');
  const [detailError, setDetailError] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<GroupHistoryCursor | null>(null);
  const generation = useRef(0);
  const hasLoaded = useRef(false);
  const onlineState = useRef<boolean | null>(null);
  const detailRoomId = useRef<string | null>(null);
  const detailValue = useRef<GroupHistoryDetail | null>(null);
  const initialSelectionApplied = useRef(false);
  const active = useRef(true);
  const refresh = useRef<(more?: boolean) => Promise<void>>(async () => undefined);
  const detailRefresh = useRef<() => void>(() => undefined);
  const closeHistoryPayment = useCallback(() => { setPaymentRoomId(null); detailRefresh.current(); }, []);
  const list = useRef<FlatList<HistoryListRow>>(null);
  refresh.current = async (more = false) => {
    if (more && (refreshing || initialLoading)) return;
    const token = ++generation.current;
    const current = () => active.current && generation.current === token;
    if (hasLoaded.current) setRefreshing(true);
    else setInitialLoading(true);
    setError(null);
    const from = more ? cursor.current : null;
    const options = { cursor: from, online: false, localPremium, serverPremium, nowUtcMs: Date.now() };
    try {
      // SQLite hiện trước network; lịch sử vẫn dùng được khi đang kiểm tra kết nối.
      const local = await repository.readPage(userId, options);
      if (!current()) return;
      setItems(previous => more ? mergeGroupHistory(previous, local.items) : local.items);
      cursor.current = local.cursor; setHasMore(local.hasMore);
      hasLoaded.current = true;
      setInitialLoading(false);
      const state = await Network.getNetworkStateAsync();
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (!current()) return;
      setOffline(!online);
      onlineState.current = online;
      if (online) {
        await repository.syncPending(userId, true);
        const page = await repository.readPage(userId, { ...options, online: true });
        if (!current()) return;
        setItems(previous => more ? mergeGroupHistory(previous, page.items) : page.items);
        cursor.current = page.cursor; setHasMore(page.hasMore);
        if (page.cloudError) setError('Could not refresh cloud history. Your saved sessions are still available.');
        detailRefresh.current();
      }
    } catch {
      if (current()) setError(hasLoaded.current ? 'Could not refresh group history. Your saved sessions are still available.' : 'Could not load group history. Try again.');
    } finally { if (current()) { setInitialLoading(false); setRefreshing(false); } }
  };
  useEffect(() => {
    active.current = true;
    void refresh.current();
    const network = Network.addNetworkStateListener(() => {
      void Network.getNetworkStateAsync().then(state => {
        const nextOnline = state.isConnected === true && state.isInternetReachable !== false;
        const reconnect = shouldRefreshGroupHistoryOnReconnect(onlineState.current, nextOnline);
        onlineState.current = nextOnline;
        setOffline(!nextOnline);
        if (reconnect) void refresh.current();
      }).catch(() => undefined);
    });
    return () => { active.current = false; generation.current++; network.remove(); };
  }, [userId, repository, serverPremium, localPremium]);
  useEffect(() => {
    if (!initialRoomId || initialLoading || initialSelectionApplied.current) return;
    const entry = items.find(item => item.summary.roomId === initialRoomId);
    if (!entry) return;
    initialSelectionApplied.current = true;
    setSelected(entry);
  }, [initialRoomId, items, initialLoading]);
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const load = async () => {
      if (!selected) { detailRoomId.current = null; detailValue.current = null; setDetail(null); return; }
      const token = ++attempt;
      const sameRoom = detailRoomId.current === selected.summary.roomId;
      if (!sameRoom) {
        detailRoomId.current = selected.summary.roomId;
        setDetailSource('checking');
      }
      setDetailError(false);
      const entry = await repository.readEntry(userId, selected.summary.roomId).catch(() => null);
      if (cancelled || token !== attempt) return;
      if (entry) setSelected(entry);
      const cached = await repository.cachedDetail(userId, selected.summary.roomId).catch(() => null);
      if (cancelled || token !== attempt) return;
      if (cached && (!sameRoom || !detailValue.current)) {
        detailValue.current = cached;
        setDetail(cached);
        setDetailSource('saved');
      }
      try {
        const state = await Network.getNetworkStateAsync();
        if (!state.isConnected || state.isInternetReachable === false) {
          if (cached && (!sameRoom || !detailValue.current)) setDetailSource('saved');
          return;
        }
        const result = await repository.readDetail(userId, selected.summary.roomId);
        if (!cancelled && token === attempt) { detailValue.current = result; setDetail(result); setDetailSource('firebase'); }
      } catch { if (!cancelled && token === attempt) { setDetailError(true); if (cached && (!sameRoom || !detailValue.current)) setDetailSource('saved'); } }
    };
    detailRefresh.current = () => { void load(); };
    void load();
    list.current?.scrollToOffset({ offset: 0, animated: false });
    return () => { cancelled = true; detailRefresh.current = () => undefined; };
  }, [selected?.summary.roomId, userId, repository]);
  useEffect(() => {
    if (paymentRoomId) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (selected) setSelected(null); else onBack(); return true; });
    return () => listener.remove();
  }, [selected, onBack, paymentRoomId]);
  const text = { color: colors.text };
  const secondary = { color: colors.textSecondary };
  const selectedEntry = items.find(item => item.summary.roomId === selected?.summary.roomId) ?? selected;
  const summary = selectedEntry?.summary;
  const loading = initialLoading;
  const rows = useMemo<HistoryListRow[]>(() => selected
    ? (detail?.members ?? []).map(member => ({ kind: 'member', member }))
    : items.map(entry => ({ kind: 'history', entry })), [selected?.summary.roomId, detail, items]);
  const ownShare = detail?.bill?.shares.find(share => share.uid === userId);
  if (paymentRoomId) return <HistoryPaymentScreen key={`${userId}/${paymentRoomId}`} userId={userId} roomId={paymentRoomId}
    repository={repository} onBack={closeHistoryPayment} />;
  return <FlatList ref={list} testID="group-history-list"
    contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]} data={rows}
    keyExtractor={item => item.kind === 'member' ? `member/${item.member.uid}` : `${item.entry.summary.actorUid}/${item.entry.summary.roomId}`}
    refreshing={refreshing && items.length > 0} onRefresh={() => { void refresh.current(); }}
    ListHeaderComponent={<View style={styles.section}>
      <PrimaryButton title={selected ? 'Back to history' : 'Back to Group'} variant="secondary" shape="rounded" colors={colors} onPress={() => selected ? setSelected(null) : onBack()} />
      <Text accessibilityRole="header" style={[styles.title, text]}>{selected ? 'Group session' : 'Group history'}</Text>
      <Text style={[styles.body, secondary]}>{selected ? new Date(summary!.completedAtUtcMs).toLocaleString() : 'Your group sessions, saved across visits.'}</Text>
      {offline ? <Text accessibilityRole="alert" style={secondary}>Offline · Saved on this device</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text> : null}
      {refreshing && items.length > 0 ? <View style={styles.refreshStatus} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={colors.primary} /><Text style={secondary}>Updating saved history…</Text>
      </View> : null}
      {error ? <PrimaryButton title="Retry history refresh" variant="secondary" shape="rounded" colors={colors} disabled={refreshing} onPress={() => { void refresh.current(); }} /> : null}
      {summary ? <>
        <GlassCard colors={colors} variant="solid" style={styles.section}>
          <Text style={[styles.label, { color: colors.primary }]}>{summary.status.replaceAll('_', ' ')}</Text>
          <Text style={[styles.heading, text]}>{selectedEntry?.source === 'ROOM' ? 'Your room result' : 'Your device recording'}</Text>
          <Text style={[styles.body, secondary]}>{selectedEntry?.source === 'ROOM'
            ? 'Loaded from the shared group session.' : 'These local stats can differ from the final room score.'}</Text>
          <Text style={[styles.metric, text]}>{summary.penaltyScore} pts</Text>
          <Text style={secondary}>{summary.liftCount} lifts · {formatTime(summary.violationDurationSeconds)} away</Text>
          <Text style={secondary}>Recorded for {formatTime(Math.floor((summary.completedAtUtcMs - summary.startedAtUtcMs) / 1000))}</Text>
          <Text style={secondary}>{summary.status === 'EARLY_EXIT' ? 'Approved exit cutoff' : 'Room cutoff'} · {new Date(summary.completedAtUtcMs).toLocaleString()}</Text>
          {selectedEntry?.source !== 'ROOM' ? <Text style={secondary}>{selectedEntry?.syncStatus === 'SYNCED' ? 'History uploaded' : selectedEntry?.syncStatus === 'FAILED' ? 'Upload needs attention · Retry above' : 'Waiting to upload'}</Text> : null}
        </GlassCard>
        <GlassCard colors={colors} variant="solid" style={styles.section}>
          <Text style={[styles.heading, text]}>Room result</Text>
          {detailError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>Could not confirm current room details. Refresh to retry.</Text> : null}
          {!detail ? <Text style={secondary}>Connect to load the room result.</Text> : <>
            <Text style={secondary}>{detailSource === 'firebase' ? 'Confirmed from Firebase'
              : detailSource === 'saved' ? (detailError ? 'Saved copy · Could not confirm current data' : 'Saved copy · Checking Firebase')
                : 'Checking Firebase…'}</Text>
            <Text style={secondary}>{detail.roomStatus} · {detail.reconciliation ?? 'No final score'}</Text>
            {detail.finalizationReason === 'HOST_OVERRIDE' ? <Text style={secondary}>The Host finalized before everyone synced. Late excluded violations do not change points or payment.</Text> : null}
            {detail.excludedCount > 0 ? <Text style={secondary}>{detail.excludedCount}{detail.excludedHasMore ? '+' : ''} late violations excluded from final scores.</Text> : null}
            {detail.bill ? <Text style={[styles.heading, text]}>Published bill · Revision {detail.bill.billRevision ?? 0}</Text>
              : <Text style={secondary}>{detail.billError ? 'Bill unavailable or access expired.' : 'No published bill available.'}</Text>}
            {ownShare ? <View style={styles.ownShare}>
              <View style={styles.ownShareAmount}>
                <Text style={secondary}>My share</Text>
                <Text style={[styles.ownShareValue, text]}>{formatVND(ownShare.shareVnd)} VND</Text>
              </View>
              {ownShare.shareVnd > 0 && ownShare.paymentStatus !== 'MARKED_AS_PAID' ? <>
                <PrimaryButton title="Pay my share" shape="rounded" colors={colors} disabled={offline || initialLoading}
                  onPress={() => setPaymentRoomId(summary.roomId)} />
                <Text style={secondary}>Firebase checks the current bill and Host payment details before showing a QR.</Text>
              </> : <Text style={secondary}>{ownShare.shareVnd === 0 ? 'No payment due' : 'Host confirmed payment'}</Text>}
            </View> : null}
          </>}
        </GlassCard>
      </> : null}
    </View>}
    ListEmptyComponent={!selected ? loading ? <ActivityIndicator accessibilityLabel="Loading group history" color={colors.primary} /> : <GlassCard colors={colors} variant="solid" style={styles.section}>
      <Text style={[styles.heading, text]}>No group sessions yet</Text><Text style={[styles.body, secondary]}>Complete a group session or leave with Host approval. Uploaded history can also be restored on this device.</Text>
    </GlassCard> : undefined}
    renderItem={({ item: row }) => {
      if (row.kind === 'member') {
        const member = row.member;
        const share = detail?.bill?.shares.find(value => value.uid === member.uid);
      return <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.authFormSurface }]}>
          <View style={styles.rosterRow}><View style={styles.member}>
            <Text style={[styles.name, text]}>{member.name}</Text><Text style={secondary}>{member.status.replaceAll('_', ' ')}</Text>
          </View><Text style={[styles.name, text]}>{member.score} pts{detail?.reconciliation !== 'FINALIZED' ? ' · provisional' : ''}</Text></View>
          {share ? <View style={styles.amount}><Text style={[styles.name, text]}>{formatVND(share.shareVnd)} VND</Text>
            <Text style={secondary}>{share.shareVnd === 0 ? 'No payment due' : share.paymentStatus === 'MARKED_AS_PAID' ? 'Host confirmed paid' : 'Awaiting confirmation'}</Text></View> : null}
        </View>;
      }
      const item = row.entry;
      const completedAt = new Date(item.summary.completedAtUtcMs);
      const duration = Math.max(0, Math.floor((item.summary.completedAtUtcMs - item.summary.startedAtUtcMs) / 1000));
      const status = item.summary.status.replaceAll('_', ' ');
      const source = item.source === 'ROOM' ? 'Shared room result' : item.syncStatus === 'SYNCED' ? 'Uploaded' : item.syncStatus === 'FAILED' ? 'Upload needs attention' : 'Pending upload';
      return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${source.toLowerCase()} from ${completedAt.toLocaleString()}, ${item.summary.penaltyScore} ${item.source === 'ROOM' ? 'points' : 'local points'}`}
        onPress={() => { detailValue.current = null; setDetail(null); setSelected(item); }}
        style={({ pressed }) => [styles.row, styles.sessionRow, { borderColor: colors.border, backgroundColor: colors.authFormSurface }, pressed && styles.rowPressed]}>
        <View style={styles.sessionTop}>
          <View style={styles.sessionMeta}>
            <Text style={[styles.label, { color: colors.primary }]}>{status}</Text>
            <Text style={[styles.heading, text]}>{completedAt.toLocaleDateString()}</Text>
            <Text style={secondary}>{completedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
          </View>
          <View style={styles.sessionScore}>
            <Text style={[styles.score, text]}>{item.summary.penaltyScore}</Text>
            <Text style={[styles.scoreUnit, secondary]}>{item.source === 'ROOM' ? 'room pts' : 'local pts'}</Text>
          </View>
        </View>
        <View style={[styles.sessionFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.sessionFooterText, secondary]}>{formatTime(duration)} · {item.summary.liftCount} lifts</Text>
          <Text numberOfLines={1} style={[styles.sessionFooterText, styles.sessionSource, { color: colors.primary }]}>{source}</Text>
        </View>
      </Pressable>; }}
    ListFooterComponent={!selected && hasMore ? <PrimaryButton title="Load older sessions" variant="secondary" shape="rounded" colors={colors} disabled={loading || refreshing} onPress={() => { void refresh.current(true); }} /> : undefined}
  />;
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32, gap: 14 }, section: { gap: 12 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.7 }, heading: { fontSize: 19, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21 }, label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  metric: { fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  row: { minHeight: 110, padding: 16, gap: 10, borderRadius: 20, borderWidth: 1 },
  sessionRow: { justifyContent: 'space-between' }, sessionTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessionMeta: { flex: 1, minWidth: 0, gap: 3 }, sessionScore: { alignItems: 'flex-end', minWidth: 64 },
  score: { fontSize: 23, lineHeight: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreUnit: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  sessionFooter: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  sessionFooterText: { fontSize: 12, lineHeight: 16 }, sessionSource: { flexShrink: 1, textAlign: 'right' },
  rowPressed: { opacity: 0.76 }, refreshStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  rosterRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  ownShare: { gap: 8, paddingTop: 8 }, ownShareAmount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  ownShareValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], textAlign: 'right' },
  member: { flex: 1, minWidth: 100 }, name: { fontSize: 15, fontWeight: '600' }, amount: { alignItems: 'flex-end', gap: 4 },
});
