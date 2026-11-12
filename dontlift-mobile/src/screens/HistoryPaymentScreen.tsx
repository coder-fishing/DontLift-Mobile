import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, ScrollView, StyleSheet } from 'react-native';
import * as Network from 'expo-network';
import { BottomTabInset } from '../constants/theme';
import { VietQRSettlementScreen } from './VietQRSettlementScreen';
import { emptyHistoryPayment, type HistoryPaymentState } from '../features/history/history-payment-state';
import type { GroupHistoryRepository } from '../features/history/group-history-repository';

type Props = { roomId: string; userId: string; repository: GroupHistoryRepository; onBack: () => void; bankDirectory?: { list: () => Promise<{ name: string; shortName: string; code: string; bin: string }[]> } };
export function HistoryPaymentScreen({ roomId, userId, repository, onBack, bankDirectory }: Props) {
  const [online, setOnline] = useState(false);
  const [revision, setRevision] = useState(0);
  const [received, setReceived] = useState<{ revision: number; state: HistoryPaymentState } | null>(null);
  const onlineRef = useRef(false);
  useEffect(() => {
    let active = true;
    let probe = 0;
    const check = async () => {
      const token = ++probe;
      const state = await Network.getNetworkStateAsync().catch(() => null);
      if (!active || token !== probe) return;
      const nextOnline = AppState.currentState === 'active'
        && state?.isConnected === true && state.isInternetReachable !== false;
      if (nextOnline !== onlineRef.current) {
        onlineRef.current = nextOnline;
        // Đổi epoch đúng một lần khi chuyển trạng thái mạng để bỏ dữ liệu live cũ trước khi mở lại QR.
        setReceived(null);
        setRevision(value => value + 1);
      }
      setOnline(nextOnline);
    };
    void check();
    const network = Network.addNetworkStateListener(() => {
      void check();
    });
    const lifecycle = AppState.addEventListener('change', state => {
      if (state === 'active') void check();
      else {
        probe++;
        if (onlineRef.current) {
          onlineRef.current = false;
          setReceived(null);
          setRevision(value => value + 1);
        }
        setOnline(false);
      }
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
  return <ScrollView contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + 32 }]}>
    <VietQRSettlementScreen roomId={roomId} roomPin={state.roomPin} actorUid={userId} member={state.member}
      billState={state.billState} detailsState={state.detailsState} isOnline={online}
      onRefresh={() => { setReceived(null); setRevision(value => value + 1); }} onBack={onBack} backLabel="Group session" bankDirectory={bankDirectory} />
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: 20, paddingBottom: 32 } });
