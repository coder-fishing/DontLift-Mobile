import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { createGroupHistoryRepository } from './group-history-repository';

type GroupHistoryRepository = ReturnType<typeof createGroupHistoryRepository>;

export function useGroupHistorySync(repository: GroupHistoryRepository, uid: string) {
  useEffect(() => {
    let disposed = false;
    void repository.recoverLocal(uid).catch(() => undefined);
    const retry = async () => {
      try {
        const network = await Network.getNetworkStateAsync();
        if (!disposed && network.isConnected && network.isInternetReachable !== false) {
          await repository.syncPending(uid);
        }
      } catch {
        // The durable outbox will retry on the next foreground or reconnect event.
      }
    };
    void retry();
    const network = Network.addNetworkStateListener(() => { void retry(); });
    const lifecycle = AppState.addEventListener('change', state => { if (state === 'active') void retry(); });
    const timer = setInterval(() => { void retry(); }, 30_000);
    return () => { disposed = true; network.remove(); lifecycle.remove(); clearInterval(timer); };
  }, [repository, uid]);
}
