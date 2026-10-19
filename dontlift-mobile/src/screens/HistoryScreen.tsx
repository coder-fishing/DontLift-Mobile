import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Network from 'expo-network';
import { Colors } from '../constants/theme';
import { formatTime } from '../constants';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { createHistoryController, type HistoryRepository } from '../features/history/history-controller';
import type { SoloHistoryEntry } from '../features/history/history-model';

type HistoryScreenProps = {
  userId: string;
  serverPremium: boolean;
  repository: HistoryRepository;
  onBack: () => void;
};
const colors = Colors.light;

export function HistoryScreen({ userId, serverPremium, repository, onBack }: HistoryScreenProps) {
  const [selected, setSelected] = useState<SoloHistoryEntry | null>(null);
  const list = useRef<FlatList<SoloHistoryEntry>>(null);
  const [, render] = useState(0);
  const controller = useMemo(() => createHistoryController(repository, {
    userId, serverPremium, localPremium: false, nowUtcMs: Date.now(),
  }, () => render(value => value + 1)), [repository, serverPremium, userId]);
  const state = controller.getState();
  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [selected?.sessionId]);
  const refresh = async () => {
    try {
      const network = await Network.getNetworkStateAsync();
      await controller.load(network.isConnected === true && network.isInternetReachable !== false, Date.now());
    } catch { await controller.load(false, Date.now()); }
  };

  useEffect(() => {
    void refresh();
    let wasOnline = true;
    const network = Network.addNetworkStateListener(value => {
      const online = value.isConnected === true && value.isInternetReachable !== false;
      if (online !== wasOnline) void controller.load(online, Date.now());
      wasOnline = online;
    });
    const lifecycle = AppState.addEventListener('change', value => {
      if (value === 'active') void refresh();
    });
    return () => { network.remove(); lifecycle.remove(); controller.dispose(); };
  }, [controller]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selected) setSelected(null);
      else onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack, selected]);

  const detail = selected ? state.items.find(item => item.sessionId === selected.sessionId) ?? selected : null;
  return (
    <FlatList
      ref={list}
      style={styles.list}
      testID="solo-history-list"
      data={detail ? [] : state.items}
      keyExtractor={item => item.sessionId}
      contentContainerStyle={styles.content}
      refreshing={state.cloudLoading && state.items.length > 0}
      onRefresh={() => { void refresh(); }}
      ListHeaderComponent={
        <View style={styles.section}>
          <PrimaryButton accessibilityRole="button" title={detail ? 'Back to history' : 'Back to Solo'} variant="secondary" onPress={() => { if (detail) setSelected(null); else onBack(); }} />
          <Text accessibilityRole="header" style={styles.title}>{detail ? 'Session details' : 'Solo history'}</Text>
          <Text style={styles.secondary}>{detail ? new Date(detail.completedAt).toLocaleString() : 'Your completed focus sessions, most recent first.'}</Text>
          {state.offline ? <Text accessibilityRole="alert" style={styles.secondary}>Offline · Showing sessions saved on this device.</Text> : null}
          {state.cloudLoading ? <Text accessibilityLiveRegion="polite" style={styles.secondary}>Checking cloud history…</Text> : null}
          {state.error ? (
            <GlassCard style={styles.section}>
              <Text accessibilityRole="alert" style={styles.error}>{state.error}</Text>
              <PrimaryButton accessibilityRole="button" title="Retry history" disabled={state.loading || state.cloudLoading} onPress={() => { void refresh(); }} />
            </GlassCard>
          ) : null}
          {detail ? (
            <GlassCard style={styles.section}>
              <Text style={styles.rowTitle}>{detail.mode === 'COUNTDOWN' ? 'Countdown' : detail.mode === 'STOPWATCH' ? 'Stopwatch' : 'Solo focus'}</Text>
              <Metric label="Started" value={new Date(detail.startedAt).toLocaleString()} />
              <Metric label="Focus time" value={formatTime(detail.durationSeconds)} />
              <Metric label="Confirmed lifts" value={String(detail.liftCount)} />
              <Metric label="Away time" value={formatTime(detail.violationDurationSeconds)} />
              <Metric label="Penalty score" value={`${detail.penaltyScore} pts`} />
            </GlassCard>
          ) : null}
        </View>
      }
      ListEmptyComponent={!detail ? state.loading || state.cloudLoading ? <ActivityIndicator accessibilityLabel="Loading Solo history" color={colors.authAccent} /> : (
        <GlassCard style={styles.section}>
          <Text style={styles.rowTitle}>No completed Solo sessions yet</Text>
          <Text style={styles.secondary}>{state.offline ? 'Go online to check your account history, or complete a Solo session on this device.' : 'Complete a Solo focus session to see its results here.'}</Text>
        </GlassCard>
      ) : null}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${new Date(item.completedAt).toLocaleString()}, ${formatTime(item.durationSeconds)} focus, ${item.liftCount} lifts, ${item.penaltyScore} penalty points`}
          accessibilityHint="Open session details"
          onPress={() => setSelected(item)}
          style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        >
          <Text style={styles.rowTitle}>{new Date(item.completedAt).toLocaleString()}</Text>
          <Text style={styles.focusTime}>{formatTime(item.durationSeconds)} focus</Text>
          <Text style={styles.secondary}>{item.liftCount} lifts · {formatTime(item.violationDurationSeconds)} away · {item.penaltyScore} pts</Text>
        </Pressable>
      )}
      ListFooterComponent={!detail && state.hasMore ? (
        <PrimaryButton accessibilityRole="button" title={state.loadingMore ? 'Loading sessions…' : 'Load more sessions'} disabled={state.loadingMore || state.cloudLoading} onPress={() => { void controller.loadMore(); }} />
      ) : null}
    />
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.secondary}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}
const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  section: { gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  secondary: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  error: { color: colors.error, fontSize: 13, lineHeight: 19 },
  row: { paddingVertical: 18, paddingHorizontal: 16, gap: 6, borderBottomWidth: 1, borderColor: colors.border, minHeight: 100 },
  pressed: { backgroundColor: colors.backgroundSelected },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  focusTime: { color: colors.authAccent, fontSize: 21, fontWeight: '800' },
  metric: { gap: 3, paddingVertical: 6 },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: '700' },
});
