import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { createCompletedGroupViolationSyncRetry } from './completed-group-violation-sync-retry';
import { createGroupViolationRepository } from './group-violation-repository';

type GroupViolationRepository = ReturnType<typeof createGroupViolationRepository>;

/** Tự thử đồng bộ vi phạm còn chờ của các phòng đã kết thúc khi app có mạng và đang hoạt động. */
export function useCompletedGroupViolationSync(repository: GroupViolationRepository) {
  useEffect(() => {
    let active = true;
    const retry = createCompletedGroupViolationSyncRetry(repository);
    const updateConnectivity = (state: Network.NetworkState) => {
      retry.setOnline(state.isConnected === true && state.isInternetReachable !== false);
    };
    const networkSubscription = Network.addNetworkStateListener(updateConnectivity);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        retry.setOnline(false);
        return;
      }
      void Network.getNetworkStateAsync().then(state => {
        if (active) updateConnectivity(state);
      }).catch(() => retry.setOnline(false));
    });
    void Network.getNetworkStateAsync().then(state => {
      if (active) updateConnectivity(state);
    }).catch(() => retry.setOnline(false));
    return () => {
      active = false;
      networkSubscription.remove();
      appStateSubscription.remove();
      retry.dispose();
    };
  }, [repository]);
}
