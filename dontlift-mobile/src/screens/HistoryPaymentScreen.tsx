import React, { useEffect, useState } from 'react';
import { AppState, BackHandler, ScrollView, StyleSheet } from 'react-native';
import * as Network from 'expo-network';
import { VietQRSettlementScreen } from './VietQRSettlementScreen';
import { emptyHistoryPayment, type HistoryPaymentState } from '../features/history/history-payment-state';
import type { GroupHistoryRepository } from '../features/history/group-history-repository';

type Props = { roomId: string; userId: string; repository: GroupHistoryRepository; onBack: () => void };
export function HistoryPaymentScreen({ roomId, userId, repository, onBack }: Props) {
  const [online, setOnline] = useState(false);
  const [revision, setRevision] = useState(0);
  const [received, setReceived] = useState<{ revision: number; state: HistoryPaymentState } | null>(null);
  useEffect(() => {
    let active = true;
    let probe = 0;
    const check = async () => {
      const token = ++probe;
      const state = await Network.getNetworkStateAsync().catch(() => null);
      if (!active || token !== probe) return;
      // Đổi epoch trước khi mở lại QR: không lóe mã từ lần online trước trong lúc effect gắn lại listener.
      setRevision(value => value + 1);
      setOnline(AppState.currentState === 'active' && state?.isConnected === true && state.isInternetReachable !== false);
    };
    void check();
    const network = Network.addNetworkStateListener(() => {
      setOnline(false); setRevision(value => value + 1);
      void check();
    });
    const lifecycle = AppState.addEventListener('change', state => {
      if (state === 'active') void check();
      else { probe++; setOnline(false); setRevision(value => value + 1); }
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => { active = false; probe++; network.remove(); lifecycle.remove(); back.remove(); };
  }, [onBack]);
  useEffect(() => {
    if (!online) return;
    let active = true;
    const stop = repository.listenPayment(userId, roomId, state => { if (active) setReceived({ revision, state }); });
    return () => { active = false; stop(); };
  }, [repository, userId, roomId, revision, online]);
  const state = received?.revision === revision ? received.state : emptyHistoryPayment();
  return <ScrollView contentContainerStyle={styles.content}>
    <VietQRSettlementScreen roomId={roomId} roomPin={state.roomPin} actorUid={userId} member={state.member}
      billState={state.billState} detailsState={state.detailsState} isOnline={online}
      onRefresh={() => setRevision(value => value + 1)} onBack={onBack} backLabel="Group session" />
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: 20, paddingBottom: 32 } });
