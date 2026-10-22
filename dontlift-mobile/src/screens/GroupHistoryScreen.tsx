import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Network from 'expo-network';
import { Colors } from '../constants/theme';
import { formatTime, formatVND } from '../constants';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { HistoryPaymentScreen } from './HistoryPaymentScreen';
import type { GroupHistoryRepository, GroupHistoryDetail } from '../features/history/group-history-repository';
import { mergeGroupHistory, type GroupHistoryCursor, type GroupHistoryEntry } from '../features/history/group-history-model';

type Props = { userId: string; repository: GroupHistoryRepository; serverPremium: boolean; localPremium?: boolean; onBack: () => void };
type HistoryListRow = { kind: 'history'; entry: GroupHistoryEntry }
  | { kind: 'member'; member: GroupHistoryDetail['members'][number] };
export function GroupHistoryScreen({ userId, repository, serverPremium, localPremium = false, onBack }: Props) {
  const colors = Colors.light;
  const [items, setItems] = useState<GroupHistoryEntry[]>([]);
  const [selected, setSelected] = useState<GroupHistoryEntry | null>(null);
  const [paymentRoomId, setPaymentRoomId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupHistoryDetail | null>(null);
  const [detailLive, setDetailLive] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<GroupHistoryCursor | null>(null);
  const generation = useRef(0);
  const active = useRef(true);
  const refresh = useRef<(more?: boolean) => Promise<void>>(async () => undefined);
  const detailRefresh = useRef<() => void>(() => undefined);
  const closeHistoryPayment = useCallback(() => { setPaymentRoomId(null); detailRefresh.current(); }, []);
  const list = useRef<FlatList<HistoryListRow>>(null);
  refresh.current = async (more = false) => {
    const token = ++generation.current;
    const current = () => active.current && generation.current === token;
    setLoading(true); setError(null);
    const from = more ? cursor.current : null;
    const options = { cursor: from, online: false, localPremium, serverPremium, nowUtcMs: Date.now() };
    try {
      // SQLite hiện trước network; lịch sử vẫn dùng được khi đang kiểm tra kết nối.
      const local = await repository.readPage(userId, options);
      if (!current()) return;
      setItems(previous => more ? mergeGroupHistory(previous, local.items) : local.items);
      cursor.current = local.cursor; setHasMore(local.hasMore);
      const state = await Network.getNetworkStateAsync();
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (!current()) return;
      setOffline(!online);
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
      if (current()) setError('Could not load group history. Try again.');
    } finally { if (current()) setLoading(false); }
  };
  useEffect(() => {
    active.current = true;
    void refresh.current();
    const network = Network.addNetworkStateListener(() => { void refresh.current(); detailRefresh.current(); });
    const lifecycle = AppState.addEventListener('change', state => { if (state === 'active') { void refresh.current(); detailRefresh.current(); } });
    return () => { active.current = false; generation.current++; network.remove(); lifecycle.remove(); };
  }, [userId, repository, serverPremium, localPremium]);
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const load = async () => {
      if (!selected) { setDetail(null); return; }
      const token = ++attempt;
      setDetailLive(false); setDetailError(false);
      const entry = await repository.readEntry(userId, selected.summary.roomId).catch(() => null);
      if (cancelled || token !== attempt) return;
      if (entry) setSelected(entry);
      const cached = await repository.cachedDetail(userId, selected.summary.roomId).catch(() => null);
      if (cancelled || token !== attempt) return;
      setDetail(cached);
      try {
        const state = await Network.getNetworkStateAsync();
        if (!state.isConnected || state.isInternetReachable === false) return;
        const result = await repository.readDetail(userId, selected.summary.roomId);
        if (!cancelled && token === attempt) { setDetail(result); setDetailLive(true); }
      } catch { if (!cancelled && token === attempt) setDetailError(true); }
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
  const rows = useMemo<HistoryListRow[]>(() => selected
    ? (detail?.members ?? []).map(member => ({ kind: 'member', member }))
    : items.map(entry => ({ kind: 'history', entry })), [selected?.summary.roomId, detail, items]);
  const ownShare = detail?.bill?.shares.find(share => share.uid === userId);
  if (paymentRoomId) return <HistoryPaymentScreen key={`${userId}/${paymentRoomId}`} userId={userId} roomId={paymentRoomId}
    repository={repository} onBack={closeHistoryPayment} />;
  return <FlatList ref={list} testID="group-history-list" style={{ backgroundColor: colors.authBackdrop }}
    contentContainerStyle={styles.content} data={rows}
    keyExtractor={item => item.kind === 'member' ? `member/${item.member.uid}` : `${item.entry.summary.actorUid}/${item.entry.summary.roomId}`}
    refreshing={loading && items.length > 0} onRefresh={() => { void refresh.current(); detailRefresh.current(); }}
    ListHeaderComponent={<View style={styles.section}>
      <PrimaryButton title={selected ? 'Back to history' : 'Back to Group'} variant="secondary" onPress={() => selected ? setSelected(null) : onBack()} />
      <Text accessibilityRole="header" style={[styles.title, text]}>{selected ? 'Group session' : 'Group history'}</Text>
      <Text style={[styles.body, secondary]}>{selected ? new Date(summary!.completedAtUtcMs).toLocaleString() : 'Your group sessions, saved across visits.'}</Text>
      {offline ? <Text accessibilityRole="alert" style={secondary}>Offline · Saved on this device</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text> : null}
      <PrimaryButton title={loading ? 'Checking history…' : 'Refresh & retry sync'} variant="secondary" disabled={loading} onPress={() => { void refresh.current(); detailRefresh.current(); }} />
      {summary ? <>
        <GlassCard style={styles.section}>
          <Text style={[styles.label, { color: colors.primary }]}>{summary.status.replaceAll('_', ' ')}</Text>
          <Text style={[styles.heading, text]}>Your device recording</Text>
          <Text style={[styles.body, secondary]}>These local stats can differ from the final room score.</Text>
          <Text style={[styles.metric, text]}>{summary.penaltyScore} pts</Text>
          <Text style={secondary}>{summary.liftCount} lifts · {formatTime(summary.violationDurationSeconds)} away</Text>
          <Text style={secondary}>Recorded for {formatTime(Math.floor((summary.completedAtUtcMs - summary.startedAtUtcMs) / 1000))}</Text>
          <Text style={secondary}>{summary.status === 'EARLY_EXIT' ? 'Approved exit cutoff' : 'Room cutoff'} · {new Date(summary.completedAtUtcMs).toLocaleString()}</Text>
          <Text style={secondary}>{selectedEntry?.syncStatus === 'SYNCED' ? 'History uploaded' : selectedEntry?.syncStatus === 'FAILED' ? 'Upload needs attention · Retry above' : 'Waiting to upload'}</Text>
        </GlassCard>
        <GlassCard style={styles.section}>
          <Text style={[styles.heading, text]}>Room result</Text>
          {detailError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>Could not confirm current room details. Refresh to retry.</Text> : null}
          {!detail ? <Text style={secondary}>Connect to load the room result.</Text> : <>
            <Text style={secondary}>{detailLive ? 'Confirmed from Firebase' : 'Saved copy · Reconnect to refresh'}</Text>
            <Text style={secondary}>{detail.roomStatus} · {detail.reconciliation ?? 'No final score'}</Text>
            {detail.finalizationReason === 'HOST_OVERRIDE' ? <Text style={secondary}>The Host finalized before everyone synced. Late excluded violations do not change points or payment.</Text> : null}
            {detail.excludedCount > 0 ? <Text style={secondary}>{detail.excludedCount}{detail.excludedHasMore ? '+' : ''} late violations excluded from final scores.</Text> : null}
            {detail.bill ? <Text style={[styles.heading, text]}>Published bill · Revision {detail.bill.billRevision ?? 0}</Text>
              : <Text style={secondary}>{detail.billError ? 'Bill unavailable or access expired.' : 'No published bill available.'}</Text>}
            {ownShare && ownShare.shareVnd > 0 && ownShare.paymentStatus !== 'MARKED_AS_PAID' ? <>
              <PrimaryButton title="Pay my share" disabled={offline || loading}
                onPress={() => setPaymentRoomId(summary.roomId)} />
              <Text style={secondary}>Checks the current bill and Host payment details before showing a QR. The Host confirms receipt after you transfer.</Text>
            </> : null}
          </>}
        </GlassCard>
      </> : null}
    </View>}
    ListEmptyComponent={!selected ? loading ? <ActivityIndicator accessibilityLabel="Loading group history" color={colors.primary} /> : <GlassCard style={styles.section}>
      <Text style={[styles.heading, text]}>No group sessions yet</Text><Text style={[styles.body, secondary]}>Complete a group session or leave with Host approval. Uploaded history can also be restored on this device.</Text>
    </GlassCard> : null}
    renderItem={({ item: row }) => {
      if (row.kind === 'member') {
        const member = row.member;
        const share = detail?.bill?.shares.find(value => value.uid === member.uid);
        return <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.glassSurface }]}>
          <View style={styles.rosterRow}><View style={styles.member}>
            <Text style={[styles.name, text]}>{member.name}</Text><Text style={secondary}>{member.status.replaceAll('_', ' ')}</Text>
          </View><Text style={[styles.name, text]}>{member.score} pts{detail?.reconciliation !== 'FINALIZED' ? ' · provisional' : ''}</Text></View>
          {share ? <View style={styles.amount}><Text style={[styles.name, text]}>{formatVND(share.shareVnd)} VND</Text>
            <Text style={secondary}>{share.shareVnd === 0 ? 'No payment due' : share.paymentStatus === 'MARKED_AS_PAID' ? 'Host confirmed paid' : 'Awaiting confirmation'}</Text></View> : null}
        </View>;
      }
      const item = row.entry;
      return <Pressable accessibilityRole="button" accessibilityLabel={`Open group session from ${new Date(item.summary.completedAtUtcMs).toLocaleString()}`}
      onPress={() => { setDetail(null); setSelected(item); }} style={({ pressed }) => [styles.row, { borderColor: colors.border, backgroundColor: colors.glassSurface, opacity: pressed ? 0.75 : 1 }]}>
      <Text style={[styles.label, { color: colors.primary }]}>{item.summary.status.replaceAll('_', ' ')}</Text>
      <Text style={[styles.heading, text]}>{new Date(item.summary.completedAtUtcMs).toLocaleDateString()}</Text>
      <Text style={secondary}>{item.summary.liftCount} lifts · {item.summary.penaltyScore} local pts</Text>
      <Text style={secondary}>{item.syncStatus === 'SYNCED' ? 'Uploaded' : item.syncStatus === 'FAILED' ? 'Upload needs attention' : 'Pending upload'}</Text>
    </Pressable>; }}
    ListFooterComponent={!selected && hasMore ? <PrimaryButton title="Load older sessions" variant="secondary" disabled={loading} onPress={() => { void refresh.current(true); }} /> : null}
  />;
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32, gap: 14 }, section: { gap: 12 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.7 }, heading: { fontSize: 19, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21 }, label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  metric: { fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  row: { minHeight: 110, padding: 20, gap: 8, borderRadius: 22, borderWidth: 1 },
  rosterRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  member: { flex: 1, minWidth: 100 }, name: { fontSize: 15, fontWeight: '600' }, amount: { alignItems: 'flex-end', gap: 4 },
});
