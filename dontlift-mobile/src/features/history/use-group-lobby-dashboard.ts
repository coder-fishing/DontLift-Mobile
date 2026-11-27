import { useCallback, useEffect, useRef, useState } from "react";
import * as Network from "expo-network";
import type {
  GroupActionableCursor,
  GroupActionableSession,
  GroupRoomRosterPreview,
} from "./group-history-repository";
import type { GroupHistoryEntry } from "./group-history-model";
import type {
  ActionableSessionsState,
  RecentSessionsState,
} from "../../components/GroupHomeDashboard";

type Repository = {
  readPage: (
    uid: string,
    options: {
      cursor: null;
      localPremium: boolean;
      serverPremium: boolean;
      nowUtcMs: number;
      online: boolean;
    },
  ) => Promise<{
    items: GroupHistoryEntry[];
    cloudError: boolean;
  }>;
  readRoomRosterPreview: (
    uid: string,
    roomId: string,
    online: boolean,
  ) => Promise<GroupRoomRosterPreview | null>;
  readActionablePage: (
    uid: string,
    options: { online: boolean; cursor: GroupActionableCursor | null },
  ) => Promise<{
    items: GroupActionableSession[];
    cursor: GroupActionableCursor | null;
    hasMore: boolean;
    cloudError: boolean;
  }>;
};

type Options = {
  repository: Repository;
  uid: string;
  isPremium: boolean;
  shouldLoad: boolean;
};

/** Tải lịch sử gần đây, roster xem trước và danh sách phiên cần xử lý cho Group Home. */
export function useGroupLobbyDashboard({
  repository,
  uid,
  isPremium,
  shouldLoad,
}: Options) {
  const [recentSessions, setRecentSessions] = useState<GroupHistoryEntry[]>([]);
  const [recentMemberPreviews, setRecentMemberPreviews] = useState<
    Record<string, GroupRoomRosterPreview | null>
  >({});
  const [recentSessionsState, setRecentSessionsState] =
    useState<RecentSessionsState>("loading");
  const recentSessionsRequest = useRef(0);
  const [actionableSessions, setActionableSessions] = useState<
    GroupActionableSession[]
  >([]);
  const [actionableSessionsState, setActionableSessionsState] =
    useState<ActionableSessionsState>("loading");
  const [actionableCursor, setActionableCursor] =
    useState<GroupActionableCursor | null>(null);
  const [actionableHasMore, setActionableHasMore] = useState(false);
  const [isLoadingMoreActionable, setIsLoadingMoreActionable] = useState(false);
  const [actionableErrorMessage, setActionableErrorMessage] =
    useState<string>();
  const actionableRequest = useRef(0);

  // Tải trang lịch sử gần đây và thông tin xem trước thành viên cho từng phòng.
  const loadRecentSessions = useCallback(async () => {
    const requestId = ++recentSessionsRequest.current;
    const isCurrent = () => recentSessionsRequest.current === requestId;
    const options = {
      cursor: null,
      localPremium: isPremium,
      serverPremium: isPremium,
      nowUtcMs: Date.now(),
    } as const;
    setRecentSessionsState("loading");
    try {
      const localPage = await repository.readPage(uid, {
        ...options,
        online: false,
      });
      if (!isCurrent()) return;
      setRecentSessions(localPage.items);
      const localPreviews = await Promise.all(
        localPage.items
          .slice(0, 5)
          .map(
            async (entry) =>
              [
                entry.summary.roomId,
                await repository.readRoomRosterPreview(
                  uid,
                  entry.summary.roomId,
                  false,
                ),
              ] as const,
          ),
      );
      if (!isCurrent()) return;
      setRecentMemberPreviews((previous) => ({
        ...Object.fromEntries(localPreviews),
        ...previous,
      }));
      const network = await Network.getNetworkStateAsync();
      if (!isCurrent()) return;
      const online =
        network.isConnected === true && network.isInternetReachable !== false;
      if (!online) {
        setRecentSessionsState("offline");
        return;
      }
      const page = await repository.readPage(uid, { ...options, online: true });
      if (!isCurrent()) return;
      setRecentSessions(page.items);
      const remotePreviews = await Promise.all(
        page.items
          .slice(0, 5)
          .map(
            async (entry) =>
              [
                entry.summary.roomId,
                await repository.readRoomRosterPreview(
                  uid,
                  entry.summary.roomId,
                  true,
                ),
              ] as const,
          ),
      );
      if (!isCurrent()) return;
      setRecentMemberPreviews((previous) => ({
        ...previous,
        ...Object.fromEntries(
          remotePreviews.map(([roomId, preview]) => [
            roomId,
            preview ?? previous[roomId] ?? null,
          ]),
        ),
      }));
      setRecentSessionsState(page.cloudError ? "cloud-error" : "ready");
    } catch {
      if (isCurrent()) setRecentSessionsState("error");
    }
  }, [repository, uid, isPremium]);

  // Tải các phiên cần hành động và cập nhật trạng thái hiển thị tương ứng.
  const loadActionableSessions = useCallback(async () => {
    const requestId = ++actionableRequest.current;
    const isCurrent = () => actionableRequest.current === requestId;
    setActionableErrorMessage(undefined);
    setActionableSessionsState("loading");
    try {
      const savedPage = await repository.readActionablePage(uid, {
        online: false,
        cursor: null,
      });
      if (!isCurrent()) return;
      setActionableSessions(savedPage.items);
      setActionableCursor(savedPage.cursor);
      setActionableHasMore(savedPage.hasMore);
      const network = await Network.getNetworkStateAsync();
      if (!isCurrent()) return;
      if (
        network.isConnected !== true ||
        network.isInternetReachable === false
      ) {
        setActionableSessionsState("offline");
        return;
      }
      const page = await repository.readActionablePage(uid, {
        online: true,
        cursor: null,
      });
      if (!isCurrent()) return;
      setActionableSessions(page.items);
      setActionableCursor(page.cursor);
      setActionableHasMore(page.hasMore);
      setActionableSessionsState(page.cloudError ? "cloud-error" : "ready");
    } catch {
      if (isCurrent()) setActionableSessionsState("error");
    }
  }, [repository, uid]);

  // Tải tiếp trang các phiên cần hành động khi người dùng yêu cầu xem thêm.
  const loadMoreActionableSessions = useCallback(async () => {
    if (
      !actionableHasMore ||
      isLoadingMoreActionable ||
      actionableCursor === null
    )
      return;
    const requestId = ++actionableRequest.current;
    const isCurrent = () => actionableRequest.current === requestId;
    setIsLoadingMoreActionable(true);
    setActionableErrorMessage(undefined);
    try {
      const network = await Network.getNetworkStateAsync();
      if (!isCurrent()) return;
      if (
        network.isConnected !== true ||
        network.isInternetReachable === false
      ) {
        setActionableSessionsState("offline");
        return;
      }
      const page = await repository.readActionablePage(uid, {
        online: true,
        cursor: actionableCursor,
      });
      if (!isCurrent()) return;
      setActionableSessions(page.items);
      setActionableCursor(page.cursor);
      setActionableHasMore(page.hasMore);
      setActionableSessionsState(page.cloudError ? "cloud-error" : "ready");
    } catch {
      if (isCurrent()) setActionableSessionsState("cloud-error");
    } finally {
      if (isCurrent()) setIsLoadingMoreActionable(false);
    }
  }, [
    actionableCursor,
    actionableHasMore,
    repository,
    isLoadingMoreActionable,
    uid,
  ]);

  useEffect(() => {
    if (!shouldLoad) return undefined;
    let active = true;
    void (async () => {
      await loadRecentSessions();
      if (active) await loadActionableSessions();
    })();
    return () => {
      active = false;
      recentSessionsRequest.current++;
      actionableRequest.current++;
    };
  }, [shouldLoad, loadActionableSessions, loadRecentSessions]);

  useEffect(() => {
    actionableRequest.current++;
    setActionableSessions([]);
    setActionableCursor(null);
    setActionableHasMore(false);
    setActionableSessionsState("loading");
    setActionableErrorMessage(undefined);
  }, [uid]);

  return {
    recentSessions,
    recentMemberPreviews,
    recentSessionsState,
    actionableSessions,
    actionableSessionsState,
    actionableHasMore,
    isLoadingMoreActionable,
    actionableErrorMessage,
    setActionableErrorMessage,
    loadRecentSessions,
    loadActionableSessions,
    loadMoreActionableSessions,
  };
}
