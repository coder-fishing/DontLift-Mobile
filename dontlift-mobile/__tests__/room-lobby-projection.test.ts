import { persistEarlyExitProjection, persistRoomLobbyProjection, persistTerminalRoomProjection, restoreCachedActiveRoom } from '../src/features/rooms/room-lobby-projection';
import type { RoomLobbySnapshot } from '../src/features/rooms/room-listener';

describe('room lobby SQLite projection', () => {
  it('replaces the roster and persists each member join timestamp atomically', async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const database = {
      withExclusiveTransactionAsync: async (operation: (transaction: { getFirstAsync: () => Promise<null>; runAsync: (sql: string, ...params: unknown[]) => Promise<void> }) => Promise<void>) => {
        await operation({
          getFirstAsync: async () => null,
          runAsync: async (sql, ...params) => { statements.push({ sql, params }); },
        });
      },
    };
    const joinedAt = '2026-10-20T00:00:00.000Z';
    const snapshot: RoomLobbySnapshot = {
      roomId: 'room-1', hostUid: 'host', pin: '12345678', status: 'WAITING',
      participantCount: 2, startedAtUtcMs: null,
      createdAt: joinedAt, updatedAt: joinedAt,
      members: [
        { uid: 'host', displayName: 'Host', role: 'HOST', status: 'ACTIVE', penaltyScore: 0, liftCount: 0, violationDurationSeconds: 0, joinedAt },
        { uid: 'member', displayName: 'Member', role: 'MEMBER', status: 'ACTIVE', penaltyScore: 0, liftCount: 0, violationDurationSeconds: 0, joinedAt },
      ],
    };

    await persistRoomLobbyProjection(Promise.resolve(database as never), snapshot);

    expect(statements).toHaveLength(4);
    expect(statements[0]).toMatchObject({
      sql: expect.stringContaining('INSERT OR REPLACE INTO rooms'),
      params: ['room-1', 'host', '12345678', 'WAITING', joinedAt, joinedAt, null, null, null],
    });
    expect(statements[1]).toMatchObject({
      sql: 'DELETE FROM room_members WHERE room_id = ?', params: ['room-1'],
    });
    expect(statements.slice(2).map(statement => statement.params)).toEqual([
      ['room-1', 'host', 'Host', 'HOST', 'ACTIVE', joinedAt, null],
      ['room-1', 'member', 'Member', 'MEMBER', 'ACTIVE', joinedAt, null],
    ]);
  });

  it('does not write an incomplete snapshot that has unresolved server timestamps', async () => {
    const withExclusiveTransactionAsync = jest.fn();
    const snapshot: RoomLobbySnapshot = {
      roomId: 'room-1', hostUid: 'host', pin: '12345678', status: 'WAITING',
      participantCount: 1, startedAtUtcMs: null, createdAt: null, updatedAt: null, members: [],
    };

    await expect(persistRoomLobbyProjection(Promise.resolve({ withExclusiveTransactionAsync } as never), snapshot))
      .rejects.toThrow('room-lobby-server-timestamp-pending');
    expect(withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it('closes the local group session at the approved cutoff and keeps the member in the room cache', async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const database = {
      withExclusiveTransactionAsync: async (operation: (transaction: { getFirstAsync: () => Promise<null>; runAsync: (sql: string, ...params: unknown[]) => Promise<void> }) => Promise<void>) => {
        await operation({ getFirstAsync: async () => null, runAsync: async (sql, ...params) => { statements.push({ sql, params }); } });
      },
    };
    await persistEarlyExitProjection(Promise.resolve(database as never), {
      roomId: 'room-1', userId: 'member', cutoffUtcMs: 12_000, startedAtUtcMs: 2_000,
    });
    expect(statements).toEqual([
      expect.objectContaining({ params: [10, new Date(12_000).toISOString(), 'room-1', 'member'] }),
      expect.objectContaining({ params: ['room-1', 'member'] }),
    ]);
    expect(statements[0].sql).toContain("status = 'COMPLETED'");
    expect(statements[1].sql).toContain("status = 'EARLY_EXIT'");
  });

  it('projects unanimous termination as a terminal cancelled room without settlement writes', async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const database = {
      withExclusiveTransactionAsync: async (operation: (transaction: { getFirstAsync: () => Promise<null>; runAsync: (sql: string, ...params: unknown[]) => Promise<void> }) => Promise<void>) => {
        await operation({ getFirstAsync: async () => null, runAsync: async (sql, ...params) => { statements.push({ sql, params }); } });
      },
    };
    const endedAtUtcMs = 20_000;
    await persistTerminalRoomProjection(Promise.resolve(database as never), {
      roomId: 'room-1', userId: 'member', status: 'CANCELLED', endedAtUtcMs,
    });
    expect(statements).toEqual([
      expect.objectContaining({ params: ['CANCELLED', null, null, null, 'room-1'] }),
      expect.objectContaining({ params: ['CANCELLED', new Date(endedAtUtcMs).toISOString(), 'room-1', 'member'] }),
    ]);
  });

  it('restores the latest locally cached active membership after app relaunch', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({
      room_id: 'room-1', host_uid: 'host', pin: '12345678',
      host_display_name: 'Host', created_at: '2026-10-20T00:00:00.000Z',
    });

    await expect(restoreCachedActiveRoom(Promise.resolve({ getFirstAsync } as never), 'member'))
      .resolves.toEqual({
        roomId: 'room-1', pin: '12345678', invitation: 'dontliftmobile://room/12345678',
        hostUid: 'host', hostDisplayName: 'Host', createdAt: '2026-10-20T00:00:00.000Z', localCacheSaved: true,
      });
    expect(getFirstAsync).toHaveBeenCalledWith(expect.stringContaining("mine.uid = ? AND mine.status IN ('ACTIVE', 'EARLY_EXIT')"), 'member');
  });
});
