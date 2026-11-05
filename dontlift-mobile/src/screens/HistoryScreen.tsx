import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';
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

function keyForDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return 'unknown-date';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dateKey(value: string): string {
  return keyForDate(new Date(value));
}

function dateLabel(value: string, now = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  const today = keyForDate(now);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const key = dateKey(value);
  if (key === today) return `Today · ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  if (key === keyForDate(yesterday)) return `Yesterday · ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function sessionTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function sessionDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${time} · ${day}`;
}

function liftLabel(count: number): string {
  return `${count} ${count === 1 ? 'lift' : 'lifts'}`;
}

function HistoryBackButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
    >
      <Ionicons name="arrow-back" size={17} color={colors.text} />
    </Pressable>
  );
}

export function HistoryScreen({ userId, serverPremium, repository, onBack }: HistoryScreenProps) {
  const [selected, setSelected] = useState<SoloHistoryEntry | null>(null);
  const list = useRef<FlatList<SoloHistoryEntry>>(null);
  const [, render] = useState(0);
  const controller = useMemo(() => createHistoryController(repository, {
    userId, serverPremium, localPremium: serverPremium, nowUtcMs: Date.now(),
  }, () => render(value => value + 1)), [repository, serverPremium, userId]);
  const state = controller.getState();
  const sessionCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of state.items) {
      const key = dateKey(item.completedAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [state.items]);
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
          <View style={styles.headingRow}>
            <HistoryBackButton
              title={detail ? 'Back to history' : 'Back to Solo'}
              onPress={() => { if (detail) setSelected(null); else onBack(); }}
            />
            <View style={styles.headingText}>
              <Text accessibilityRole="header" style={styles.title}>{detail ? 'Session details' : 'Solo history'}</Text>
              {!detail ? <Text style={styles.secondary}>Your completed focus sessions, most recent first.</Text> : null}
            </View>
          </View>
          {state.offline ? <Text accessibilityRole="alert" style={styles.secondary}>Offline · Showing sessions saved on this device.</Text> : null}
          {state.cloudLoading ? <Text accessibilityLiveRegion="polite" style={styles.secondary}>Checking cloud history…</Text> : null}
          {state.error ? (
            <GlassCard style={styles.section}>
              <Text accessibilityRole="alert" style={styles.error}>{state.error}</Text>
              <PrimaryButton accessibilityRole="button" title="Retry history" disabled={state.loading || state.cloudLoading} onPress={() => { void refresh(); }} />
            </GlassCard>
          ) : null}
          {detail ? (
            <SessionDetailsCard entry={detail} />
          ) : null}
        </View>
      }
      ListEmptyComponent={!detail ? state.loading || state.cloudLoading ? <ActivityIndicator accessibilityLabel="Loading Solo history" color={colors.authAccent} /> : (
        <GlassCard style={styles.section}>
          <Text style={styles.rowTitle}>No completed Solo sessions yet</Text>
          <Text style={styles.secondary}>{state.offline ? 'Go online to check your account history, or complete a Solo session on this device.' : 'Complete a Solo focus session to see its results here.'}</Text>
        </GlassCard>
      ) : null}
      renderItem={({ item, index }) => {
        const previous = state.items[index - 1];
        const startsDateGroup = !previous || dateKey(previous.completedAt) !== dateKey(item.completedAt);
        const dateCount = sessionCountsByDate.get(dateKey(item.completedAt)) ?? 1;
        return (
          <View>
            {startsDateGroup ? (
              <View style={styles.dateGroupHeader}>
                <Text style={styles.dateGroupTitle}>{dateLabel(item.completedAt)}</Text>
                <Text style={styles.dateGroupCount}>{dateCount} {dateCount === 1 ? 'session' : 'sessions'} shown</Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${sessionTime(item.completedAt)}, ${formatTime(item.durationSeconds)} focus, ${liftLabel(item.liftCount)}, ${formatTime(item.violationDurationSeconds)} away, ${item.penaltyScore} penalty points`}
              accessibilityHint="Open session details"
              onPress={() => setSelected(item)}
              style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardIdentity}>
                  <View accessibilityElementsHidden importantForAccessibility="no" style={styles.sessionIconTile}>
                    <Ionicons
                      name={item.penaltyScore === 0 ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                      size={18}
                      color={item.penaltyScore === 0 ? colors.success : colors.authAccent}
                    />
                  </View>
                  <Text style={styles.focusTime}>{formatTime(item.durationSeconds)} focus</Text>
                </View>
                <View style={styles.cardTime}>
                  <Text style={styles.sessionTime}>{sessionTime(item.completedAt)}</Text>
                  <Ionicons name="chevron-forward" size={17} color={colors.textSecondary} />
                </View>
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.rowMetaText}>{liftLabel(item.liftCount)} · {formatTime(item.violationDurationSeconds)} away</Text>
                <Text style={[styles.penaltyScore, item.penaltyScore === 0 ? styles.cleanPenalty : null]}>{item.penaltyScore} penalty pts</Text>
              </View>
            </Pressable>
          </View>
        );
      }}
      ListFooterComponent={!detail && state.hasMore ? (
        <PrimaryButton accessibilityRole="button" title={state.loadingMore ? 'Loading sessions…' : 'Load more sessions'} disabled={state.loadingMore || state.cloudLoading} onPress={() => { void controller.loadMore(); }} />
      ) : null}
    />
  );
}

function SessionDetailsCard({ entry }: { entry: SoloHistoryEntry }) {
  const mode = entry.mode === 'COUNTDOWN' ? 'Countdown' : entry.mode === 'STOPWATCH' ? 'Stopwatch' : 'Solo focus';
  return (
    <GlassCard>
      <View style={styles.detailContent}>
        <View style={styles.detailTopRow}>
          <View style={styles.modeLabel}>
            <Ionicons name="time-outline" size={16} color={colors.authAccent} />
            <Text style={styles.modeLabelText}>{mode}</Text>
          </View>
          <Text style={styles.startedAt}>Started · {sessionDateTime(entry.startedAt)}</Text>
        </View>
        <View style={styles.heroMetric}>
          <Text style={styles.heroLabel}>Focus time</Text>
          <Text style={styles.heroValue}>{formatTime(entry.durationSeconds)}</Text>
        </View>
        <View style={styles.metricGrid}>
          <MetricTile label="Confirmed lifts" value={String(entry.liftCount)} />
          <MetricTile label="Away time" value={formatTime(entry.violationDurationSeconds)} />
          <MetricTile label="Penalty score" value={`${entry.penaltyScore} pts`} wide />
        </View>
      </View>
    </GlassCard>
  );
}

function MetricTile({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.metricTile, wide ? styles.metricTileWide : null]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 32 },
  section: { gap: 12 },
  headingRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingText: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  secondary: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  error: { color: colors.error, fontSize: 13, lineHeight: 19 },
  backButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundSelected },
  backButtonPressed: { opacity: 0.72 },
  dateGroupHeader: { minHeight: 36, paddingTop: 4, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateGroupTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  dateGroupCount: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  row: { minHeight: 80, paddingVertical: 12, paddingHorizontal: 12, gap: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputSurface },
  pressed: { backgroundColor: colors.backgroundSelected },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionIconTile: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.backgroundSelected },
  cardTime: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  rowMetaText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  focusTime: { color: colors.authAccent, fontSize: 21, fontWeight: '800' },
  sessionTime: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  penaltyScore: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cleanPenalty: { color: colors.success },
  detailContent: { gap: 18 },
  detailTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modeLabel: { minHeight: 36, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, backgroundColor: colors.backgroundSelected },
  modeLabelText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  startedAt: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'right' },
  heroMetric: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  heroLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  heroValue: { color: colors.authAccent, fontSize: 36, fontWeight: '800', lineHeight: 44 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricTile: { width: '48%', minHeight: 84, padding: 12, justifyContent: 'space-between', borderRadius: 14, backgroundColor: colors.backgroundElement },
  metricTileWide: { width: '100%' },
  metricLabel: { color: colors.textSecondary, fontSize: 14, lineHeight: 18 },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: '700' },
});
