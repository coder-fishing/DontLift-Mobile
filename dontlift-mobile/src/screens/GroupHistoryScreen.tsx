import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Network from 'expo-network';
import { BottomTabInset, Colors } from '../constants/theme';
import { formatTime, formatVND } from '../constants';
import { GlassCard } from '../components/GlassCard';
import { GlassPill } from '../components/GlassPill';
import { PrimaryButton } from '../components/PrimaryButton';
import { HistoryPaymentScreen } from './HistoryPaymentScreen';
import type { GroupHistoryRepository, GroupHistoryDetail } from '../features/history/group-history-repository';
import { mergeGroupHistory, type GroupHistoryCursor, type GroupHistoryEntry } from '../features/history/group-history-model';
import { shouldRefreshGroupHistoryOnReconnect } from '../features/history/group-history-refresh-policy';

type Props = { userId: string; repository: GroupHistoryRepository; serverPremium: boolean; localPremium?: boolean; initialRoomId?: string; onBack: () => void; bankDirectory?: { list: () => Promise<{ name: string; shortName: string; code: string; bin: string }[]> } };
type HistoryListRow = { kind: 'history'; entry: GroupHistoryEntry }
  | { kind: 'member'; member: GroupHistoryDetail['members'][number] };
export function GroupHistoryScreen({ userId, repository, serverPremium, localPremium = serverPremium, initialRoomId, onBack, bankDirectory }: Props) {
  const colors = Colors.light;
  const [items, setItems] = useState<GroupHistoryEntry[]>([]);
  const [selected, setSelected] = useState<GroupHistoryEntry | null>(null);
  const [paymentRoomId, setPaymentRoomId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupHistoryDetail | null>(null);
  const [detailLive, setDetailLive] = useState(false);
  const [detailChecking, setDetailChecking] = useState(false);
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
  const initialSelectionApplied = useRef(false);
  const active = useRef(true);
  const refresh = useRef<(more?: boolean) => Promise<void>>(async () => undefined);
  const detailRefresh = useRef<() => void>(() => undefined);
  const closeHistoryPayment = useCallback(() => { setPaymentRoomId(null); detailRefresh.current(); }, []);
  const list = useRef<FlatList<HistoryListRow>>(null);
  refresh.current = async (more = false) => {
    if (refreshing || (more && initialLoading)) return;
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
      setRefreshing(true);
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
      }
    } catch {
      if (current()) setError(hasLoaded.current
        ? 'Could not refresh group history. Your saved sessions are still available.'
        : 'Could not load group history. Try again.');
    } finally {
      if (current()) { setInitialLoading(false); setRefreshing(false); }
    }
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
        if (reconnect) {
          void refresh.current();
          detailRefresh.current();
        }
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
      if (!selected) {
        detailRoomId.current = null;
        setDetail(null); setDetailLive(false); setDetailChecking(false); setDetailError(false);
        return;
      }
      const token = ++attempt;
      const sameRoom = detailRoomId.current === selected.summary.roomId;
      if (!sameRoom) {
        detailRoomId.current = selected.summary.roomId;
        setDetail(null); setDetailLive(false);
      }
      setDetailChecking(true); setDetailError(false);
      const entry = await repository.readEntry(userId, selected.summary.roomId).catch(() => null);
      if (cancelled || token !== attempt) return;
      if (entry) setSelected(entry);
      const cached = await repository.cachedDetail(userId, selected.summary.roomId).catch(() => null);
      if (cancelled || token !== attempt) return;
      try {
        if (cached) setDetail(cached);
        const state = await Network.getNetworkStateAsync();
        const online = state.isConnected === true && state.isInternetReachable !== false;
        setOffline(!online);
        if (!online) return;
        const result = await repository.readDetail(userId, selected.summary.roomId);
        if (!cancelled && token === attempt) { setDetail(result); setDetailLive(true); }
      } catch {
        if (!cancelled && token === attempt) { setDetailLive(false); setDetailError(true); }
      } finally {
        if (!cancelled && token === attempt) setDetailChecking(false);
      }
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
    repository={repository} bankDirectory={bankDirectory} onBack={closeHistoryPayment} />;
  return <FlatList ref={list} testID="group-history-list"
    contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + 32 }]} data={rows}
    keyExtractor={item => item.kind === 'member' ? `member/${item.member.uid}` : `${item.entry.summary.actorUid}/${item.entry.summary.roomId}`}
    refreshing={selected ? detailChecking : refreshing && items.length > 0}
    onRefresh={() => { if (selected) detailRefresh.current(); else void refresh.current(); }}
    ListHeaderComponent={<View style={styles.section}>
      <Pressable accessibilityRole="button" accessibilityLabel={selected ? 'Back to group history' : 'Back to Group'}
        hitSlop={8} onPress={() => selected ? setSelected(null) : onBack()}
        style={({ pressed }) => [styles.backLink, pressed && styles.backPressed]}>
        <View style={styles.backContent}>
          <Ionicons name="arrow-back" size={18} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>{selected ? 'Back to history' : 'Back to Group'}</Text>
        </View>
      </Pressable>
      {!selected ? <>
        <LinearGradient colors={[...colors.roomInviteGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.historyHero}>
          <View style={styles.heroMain}>
            <View style={styles.heroCopy}>
              <Text accessibilityRole="header" style={styles.heroTitle}>Group history</Text>
              <Text style={styles.heroBody}>Your group sessions, saved across visits.</Text>
            </View>
            <View style={styles.sessionCount} accessibilityLabel={`${items.length}${hasMore ? ' or more' : ''} saved sessions`}>
              <Text style={styles.sessionCountValue}>{items.length}{hasMore ? '+' : ''}</Text>
              <Text style={styles.sessionCountLabel}>{hasMore ? 'Sessions loaded' : 'Saved sessions'}</Text>
            </View>
          </View>
          {error ? <PrimaryButton title={initialLoading || refreshing ? 'Retrying…' : 'Try again'}
            variant="secondary" style={styles.heroAction} disabled={initialLoading || refreshing}
            accessibilityLabel="Retry loading group history" onPress={() => { void refresh.current(); }} /> : null}
        </LinearGradient>
      </> : <View style={styles.detailTitle}>
        <Text accessibilityRole="header" style={[styles.title, text]}>Group session</Text>
        <Text style={secondary}>{new Date(summary!.completedAtUtcMs).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
      </View>}
      {offline ? <Text accessibilityRole="alert" style={secondary}>Offline · Showing saved sessions</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text> : null}
      {summary && selectedEntry ? <>
        <LinearGradient colors={[...colors.roomInviteGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resultHero}>
          <View style={styles.resultHeroMain}>
            <View style={styles.resultScoreBlock}>
              <Text style={styles.resultEyebrow}>{selectedEntry.source === 'ROOM' ? 'YOUR ROOM SCORE' : 'YOUR LOCAL RESULT'}</Text>
              <Text style={styles.resultScore}>{summary.penaltyScore}</Text>
              <Text style={styles.resultScoreUnit}>{selectedEntry.source === 'ROOM' ? 'room pts' : 'local pts'}</Text>
              <GlassPill style={styles.uploadedBadge}>
                <Text style={styles.uploadedText}>{selectedEntry.source === 'ROOM' ? 'Shared room result'
                  : selectedEntry.syncStatus === 'SYNCED' ? 'History uploaded'
                    : selectedEntry.syncStatus === 'FAILED' ? 'Upload needs attention' : 'Waiting to upload'}</Text>
              </GlassPill>
            </View>
            <View style={styles.resultStats}>
              <View style={styles.resultStat}><Text style={styles.resultStatValue}>{summary.liftCount} lifts</Text></View>
              <View style={styles.resultStat}><Text style={styles.resultStatValue}>{formatTime(summary.violationDurationSeconds)} away</Text></View>
              <View style={styles.resultStat}><Text style={styles.resultStatValue}>Recorded {formatTime(Math.floor((summary.completedAtUtcMs - summary.startedAtUtcMs) / 1000))}</Text></View>
            </View>
          </View>
          <View style={styles.resultHeroFooter}>
            <GlassPill style={[styles.resultStatusPill, summary.status === 'COMPLETED' && { backgroundColor: colors.successSurface, borderColor: colors.success }]}>
              <Text style={[styles.resultStatusText, summary.status === 'COMPLETED' && { color: colors.success }]}>{summary.status.replaceAll('_', ' ')}</Text>
            </GlassPill>
            <Text style={styles.resultCutoff}>{summary.status === 'EARLY_EXIT' ? 'Approved exit' : 'Room cutoff'} · {new Date(summary.completedAtUtcMs).toLocaleString('en-GB')}</Text>
          </View>
        </LinearGradient>
        <GlassCard style={styles.roomResultCard}>
          <View style={styles.roomResultContent}>
          <View style={styles.roomHeadingRow}>
            <Text style={[styles.heading, text]}>Room result</Text>
            {detail?.bill ? <GlassPill style={styles.revisionPill}><Text style={[styles.revisionText, text]}>Revision {detail.bill.billRevision ?? 0}</Text></GlassPill> : null}
          </View>
          {detailError ? <Text accessibilityRole="alert" style={{ color: colors.error }}>Could not confirm current room details. Refresh to retry.</Text> : null}
          {detailError ? <PrimaryButton title="Retry room check" variant="secondary" disabled={offline || detailChecking}
            accessibilityLabel="Retry checking this room result with Firebase" onPress={() => detailRefresh.current()} /> : null}
          {!detail ? <Text style={secondary}>{detailChecking ? 'Checking Firebase…'
            : detailError ? 'Could not load the room result. Refresh to retry.'
              : offline ? 'Connect to load the room result.' : 'Room result is unavailable.'}</Text> : <>
            <Text style={secondary}>{detailLive
              ? offline ? 'Saved copy · Last confirmed from Firebase' : 'Confirmed from Firebase'
              : detailError ? 'Saved copy · Could not confirm current data'
                : offline ? 'Saved copy · Connect to check for updates'
                  : detailChecking ? 'Saved copy · Checking Firebase' : 'Saved copy · Reconnect to refresh'}</Text>
            <View style={styles.roomStatusRow}>
              <GlassPill style={[styles.roomStatusPill, detail.roomStatus === 'COMPLETED'
                ? { backgroundColor: colors.successSurface, borderColor: colors.success }
                : { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}>
                <Text style={[styles.roomStatusText, { color: detail.roomStatus === 'COMPLETED' ? colors.success : colors.text }]}>{detail.roomStatus.replaceAll('_', ' ')}</Text>
              </GlassPill>
              <GlassPill style={[styles.roomStatusPill, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}>
                <Text style={[styles.roomStatusText, { color: colors.primary }]}>{detail.reconciliation?.replaceAll('_', ' ') ?? 'No final score'}</Text>
              </GlassPill>
            </View>
            {detail.finalizationReason === 'HOST_OVERRIDE' ? <Text style={secondary}>The Host finalized before everyone synced. Late excluded violations do not change points or payment.</Text> : null}
            {detail.excludedCount > 0 ? <Text style={secondary}>{detail.excludedCount}{detail.excludedHasMore ? '+' : ''} late violations excluded from final scores.</Text> : null}
            {detail.bill ? <Text style={[styles.billTitle, text]}>Published bill</Text>
              : <Text style={secondary}>{detail.billError ? 'Bill unavailable or access expired.' : 'No published bill available.'}</Text>}
            {ownShare ? <View style={styles.ownShare}>
              <View style={styles.ownShareAmount}>
                <Text style={secondary}>Your share</Text>
                <Text style={[styles.ownShareValue, text]}>{formatVND(ownShare.shareVnd)} VND</Text>
              </View>
              {ownShare.shareVnd === 0 ? <Text style={secondary}>No payment due</Text>
                : ownShare.paymentStatus === 'MARKED_AS_PAID' ? <Text style={secondary}>Host confirmed payment</Text>
                  : <>
                    <PrimaryButton title={`Pay my share · ${formatVND(ownShare.shareVnd)} VND`} disabled={offline || initialLoading}
                      onPress={() => setPaymentRoomId(summary.roomId)} />
                    <Text style={[styles.paymentHint, secondary]}>Checks the current bill and Host payment details before showing a QR. The Host confirms receipt after you transfer.</Text>
                  </>}
            </View> : null}
          </>}
          </View>
        </GlassCard>
        <View style={styles.membersHeading}>
          <Text style={[styles.sectionTitle, text]}>Members · {detail?.members.length ?? 0}</Text>
          <Text style={secondary}>{detailLive && !offline ? 'Confirmed roster' : 'Saved roster'}</Text>
        </View>
      </> : null}
      {!selected ? <View style={styles.sessionsHeading}>
        <Text style={[styles.sectionTitle, text]}>Recent sessions · {items.length}{hasMore ? '+' : ''}</Text>
        <Text style={secondary}>Date · activity · points</Text>
      </View> : null}
    </View>}
    ListEmptyComponent={!selected ? initialLoading ? <ActivityIndicator accessibilityLabel="Loading group history" color={colors.primary} /> : <GlassCard style={styles.section}>
      <Text style={[styles.heading, text]}>No group sessions yet</Text><Text style={[styles.body, secondary]}>Complete a group session or leave with Host approval. Uploaded history can also be restored on this device.</Text>
    </GlassCard> : undefined}
    renderItem={({ item: row }) => {
      if (row.kind === 'member') {
        const member = row.member;
        const share = detail?.bill?.shares.find(value => value.uid === member.uid);
        const nameParts = member.name.trim().split(/\s+/).filter(Boolean);
        const initials = (nameParts.length === 1
          ? Array.from(nameParts[0]).slice(0, 2).join('')
          : nameParts.slice(0, 2).map(part => Array.from(part)[0] ?? '').join('')).toLocaleUpperCase() || '?';
        const paymentStatus = share ? share.shareVnd === 0 ? 'No payment due'
          : share.paymentStatus === 'MARKED_AS_PAID' ? 'Host confirmed paid' : 'Awaiting confirmation' : null;
        return <View accessible accessibilityLabel={`${member.name}${member.uid === userId ? ', you' : ''}, ${member.score} points, ${member.status.replaceAll('_', ' ')}${share ? `, ${formatVND(share.shareVnd)} VND, ${paymentStatus}` : ''}`}
          style={[styles.memberCard, { borderColor: colors.border, backgroundColor: colors.glassSurface }]}>
          <GroupMemberAvatar name={member.name} uri={member.avatarUri} initials={initials} />
          <View style={styles.memberIdentity}>
            <View style={styles.memberNameRow}>
              <Text style={[styles.name, text]} numberOfLines={2}>{member.name}</Text>
              {member.uid === userId ? <GlassPill style={styles.youPill}><Text style={[styles.youText, { color: colors.primary }]}>YOU</Text></GlassPill> : null}
            </View>
            <Text style={[styles.memberSubtext, { color: member.status === 'ACTIVE' ? colors.success : colors.textSecondary }]}>
              {member.status.replaceAll('_', ' ')}
            </Text>
          </View>
          <View style={styles.memberResult}>
            <Text style={[styles.memberScore, text]}>{member.score} pts{detail?.reconciliation !== 'FINALIZED' ? ' · provisional' : ''}</Text>
            {share ? <>
              <Text style={[styles.memberShare, text]}>{formatVND(share.shareVnd)} VND</Text>
              <Text style={[styles.memberPaymentStatus, secondary]}>{paymentStatus}</Text>
            </> : null}
          </View>
        </View>;
      }
      const item = row.entry;
      const date = new Date(item.summary.completedAtUtcMs);
      return <Pressable accessibilityRole="button" accessibilityLabel={`Open group session from ${date.toLocaleString()}, ${item.summary.liftCount} lifts, ${item.summary.penaltyScore} ${item.source === 'ROOM' ? 'room points' : 'local points'}`}
      onPress={() => { setDetail(null); setSelected(item); }} style={({ pressed }) => [styles.row, { borderColor: colors.border, backgroundColor: colors.glassSurface, opacity: pressed ? 0.75 : 1 }]}>
      <View style={styles.historyRowTop}>
        <Text style={[styles.historyDate, text]}>{date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
        <GlassPill style={[styles.statusPill, item.summary.status === 'COMPLETED' && { backgroundColor: colors.successSurface, borderColor: colors.success }]}>
          <Text style={[styles.statusText, { color: item.summary.status === 'COMPLETED' ? colors.success : colors.textSecondary }]}>{item.summary.status.replaceAll('_', ' ')}</Text>
        </GlassPill>
      </View>
      <Text style={[styles.historyMeta, secondary]}>{item.summary.liftCount} lifts · {formatTime(Math.floor((item.summary.completedAtUtcMs - item.summary.startedAtUtcMs) / 1000))} recorded · {item.summary.penaltyScore} {item.source === 'ROOM' ? 'room pts' : 'local pts'}</Text>
      <Text style={secondary}>{item.source === 'ROOM' ? 'Shared room result' : item.syncStatus === 'SYNCED' ? 'Uploaded' : item.syncStatus === 'FAILED' ? 'Upload needs attention' : 'Pending upload'}</Text>
    </Pressable>; }}
    ListFooterComponent={!selected && hasMore ? <PrimaryButton title="Load older sessions" variant="secondary" disabled={initialLoading || refreshing} onPress={() => { void refresh.current(true); }} /> : undefined}
  />;
}

function GroupMemberAvatar({ name, uri, initials }: { name: string; uri?: string; initials: string }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return <View style={[styles.memberAvatar, { backgroundColor: Colors.light.roomMemberAvatar }]}>
    {uri && failedUri !== uri
      ? <Image source={{ uri }} contentFit="cover" style={styles.memberAvatarImage} onError={() => setFailedUri(uri)} accessibilityLabel={`${name}'s avatar`} />
      : <Text style={[styles.memberAvatarText, { color: Colors.light.roomMemberAccent }]}>{initials}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 }, section: { gap: 14 },
  backLink: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 8, marginLeft: -8 },
  backContent: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 7 },
  backPressed: { opacity: 0.62 }, backText: { fontSize: 14, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 }, heading: { fontSize: 19, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21 }, label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  historyHero: { borderRadius: 26, padding: 20, gap: 16 },
  heroMain: { flexDirection: 'row', alignItems: 'center', gap: 12 }, heroCopy: { flex: 1, gap: 6 },
  heroTitle: { color: '#FFFFFF', fontSize: 27, lineHeight: 33, fontWeight: '800', letterSpacing: -0.5 },
  heroBody: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20, flexShrink: 1 },
  sessionCount: { width: 92, minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 2, padding: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.58)', backgroundColor: 'rgba(255,255,255,0.2)' },
  sessionCountValue: { color: '#FFFFFF', fontSize: 30, lineHeight: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sessionCountLabel: { color: '#FFFFFF', fontSize: 11, lineHeight: 15, fontWeight: '600', textAlign: 'center' },
  heroAction: { minHeight: 48, alignSelf: 'flex-start', width: 'auto', maxWidth: '100%', paddingHorizontal: 18 },
  sessionsHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: 0.35, textTransform: 'uppercase' },
  detailTitle: { gap: 3, paddingTop: 2 },
  resultHero: { borderRadius: 26, padding: 20, gap: 12 },
  resultHeroMain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  resultScoreBlock: { flex: 1, minWidth: 150, gap: 2 }, resultEyebrow: { color: '#BFDBFE', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  resultScore: { color: '#FFFFFF', fontSize: 48, lineHeight: 54, fontWeight: '800', fontVariant: ['tabular-nums'] },
  resultScoreUnit: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '600' },
  uploadedBadge: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: 'rgba(255,255,255,0.18)' },
  uploadedText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  resultStats: { minWidth: 132, flexGrow: 1, gap: 7 },
  resultStat: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.14)' },
  resultStatValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  resultHeroFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  resultStatusPill: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.4)' },
  resultStatusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  resultCutoff: { flex: 1, color: 'rgba(255,255,255,0.82)', fontSize: 11, lineHeight: 16 },
  roomStatusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  roomStatusPill: { paddingVertical: 4, paddingHorizontal: 9 }, roomStatusText: { fontSize: 11, fontWeight: '800' },
  roomResultCard: { padding: 18 }, roomResultContent: { gap: 10 },
  roomHeadingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  revisionPill: { paddingVertical: 4 }, revisionText: { fontSize: 11, fontWeight: '700' },
  roomStatus: { fontSize: 14, lineHeight: 20, fontWeight: '700' }, billTitle: { fontSize: 18, fontWeight: '700' },
  ownShare: { gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.light.border },
  ownShareAmount: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ownShareValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  paymentHint: { fontSize: 12, lineHeight: 17 },
  membersHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 2 },
  row: { minHeight: 88, padding: 16, gap: 7, borderRadius: 22, borderWidth: 1 },
  historyRowTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historyDate: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  historyMeta: { fontSize: 14, lineHeight: 19 },
  statusPill: { paddingVertical: 4, paddingHorizontal: 10 }, statusText: { fontSize: 10, fontWeight: '800' },
  memberCard: { minHeight: 76, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 20, borderWidth: 1 },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  memberAvatarImage: { width: '100%', height: '100%', borderRadius: 21 },
  memberAvatarText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  memberIdentity: { flex: 1, minWidth: 64, gap: 3 },
  memberNameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  memberSubtext: { fontSize: 12, lineHeight: 16 },
  memberResult: { minWidth: 96, maxWidth: 142, alignItems: 'flex-end', gap: 2 },
  memberScore: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  memberShare: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], textAlign: 'right', marginTop: 2 },
  memberPaymentStatus: { fontSize: 10, lineHeight: 14, textAlign: 'right' },
  youPill: { paddingVertical: 3, paddingHorizontal: 8 }, youText: { fontSize: 10, fontWeight: '800' },
  rosterRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  member: { flex: 1, minWidth: 100 }, name: { fontSize: 15, fontWeight: '600' }, amount: { alignItems: 'flex-end', gap: 4 },
});
