import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import {
  HOST_HEARTBEAT_INTERVAL_MS, HOST_STALE_AFTER_MS, STALE_ROOM_RETRY_MS,
  RoomLivenessError, createRoomLivenessRepository,
} from './room-liveness-repository';
import type { RoomLobbyState } from './room-listener';

type RoomLivenessRepository = ReturnType<typeof createRoomLivenessRepository>;

export function useRoomLiveness({
  roomId,
  uid,
  roomState,
  repository,
}: {
  roomId: string | undefined;
  uid: string;
  roomState: RoomLobbyState | null;
  repository: RoomLivenessRepository;
}) {
  useEffect(() => {
    const snapshot = roomState?.snapshot;
    const ownMember = snapshot?.members.find(member => member.uid === uid);
    if (!roomId || roomState?.kind !== 'live' || snapshot?.status !== 'ACTIVE'
      || ownMember?.role !== 'HOST' || ownMember.status !== 'ACTIVE') return undefined;

    let active = true;
    let heartbeatInFlight = false;
    let resumeCheckInFlight = false;
    const sendHeartbeat = async () => {
      if (!active || heartbeatInFlight || AppState.currentState !== 'active') return;
      heartbeatInFlight = true;
      try {
        await repository.sendHostHeartbeat(roomId);
      } catch (error) {
        if (__DEV__ && active) {
          const code = error instanceof RoomLivenessError ? error.code : 'unknown';
          console.warn('[room-liveness] heartbeat failed', { code });
        }
      } finally {
        heartbeatInFlight = false;
      }
    };
    const refreshOnResume = async () => {
      if (!active || resumeCheckInFlight || AppState.currentState !== 'active') return;
      resumeCheckInFlight = true;
      try {
        const result = await repository.abortStaleRoom(roomId);
        if (result === 'aborted' || result === 'terminal') return;
      } catch (error) {
        if (!(error instanceof RoomLivenessError) || error.code !== 'rejected') {
          if (__DEV__ && active) {
            const code = error instanceof RoomLivenessError ? error.code : 'unknown';
            console.warn('[room-liveness] resume check failed', { code });
          }
          return;
        }
      } finally {
        resumeCheckInFlight = false;
      }
      await sendHeartbeat();
    };
    void refreshOnResume();
    const timer = setInterval(() => { void sendHeartbeat(); }, HOST_HEARTBEAT_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshOnResume();
    });
    const networkSubscription = Network.addNetworkStateListener(state => {
      if (state.isConnected === true && state.isInternetReachable !== false) void refreshOnResume();
    });
    return () => {
      active = false;
      clearInterval(timer);
      appStateSubscription.remove();
      networkSubscription.remove();
    };
  }, [roomId, uid, repository, roomState?.kind, roomState?.snapshot?.status]);

  useEffect(() => {
    const snapshot = roomState?.snapshot;
    const ownMember = snapshot?.members.find(member => member.uid === uid);
    if (!roomId || roomState?.kind !== 'live' || snapshot?.status !== 'ACTIVE'
      || snapshot.startedAtUtcMs == null || ownMember == null || ownMember.role === 'HOST'
      || !['ACTIVE', 'EARLY_EXIT'].includes(ownMember.status)) return undefined;
    const heartbeatAt = snapshot.hostHeartbeatAtUtcMs;
    if (heartbeatAt == null) return undefined;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortInFlight = false;
    const cutoffUtcMs = Math.max(heartbeatAt, snapshot.startedAtUtcMs) + HOST_STALE_AFTER_MS;
    let attemptAbort: () => Promise<void>;
    const retry = () => {
      if (!active) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(attemptAbort, STALE_ROOM_RETRY_MS);
    };
    attemptAbort = async () => {
      if (!active || abortInFlight || AppState.currentState !== 'active') return;
      abortInFlight = true;
      try {
        await repository.abortStaleRoom(roomId);
      } catch (error) {
        if (__DEV__ && active && (!(error instanceof RoomLivenessError) || error.code !== 'rejected')) {
          const code = error instanceof RoomLivenessError ? error.code : 'unknown';
          console.warn('[room-liveness] stale check failed', { code });
        }
        retry();
      } finally {
        abortInFlight = false;
      }
    };
    const remainingMs = cutoffUtcMs - Date.now();
    timer = setTimeout(attemptAbort, Math.max(0, remainingMs) + 1);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void attemptAbort();
    });
    const networkSubscription = Network.addNetworkStateListener(state => {
      if (state.isConnected === true && state.isInternetReachable !== false) void attemptAbort();
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      appStateSubscription.remove();
      networkSubscription.remove();
    };
  }, [roomId, uid, repository, roomState?.kind, roomState?.snapshot?.hostHeartbeatAtUtcMs,
    roomState?.snapshot?.startedAtUtcMs, roomState?.snapshot?.status]);
}
