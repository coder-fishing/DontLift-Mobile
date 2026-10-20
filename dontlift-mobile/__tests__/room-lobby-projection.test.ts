import { persistRoomLobbyProjection } from '../src/features/rooms/room-lobby-projection';
import type { RoomLobbySnapshot } from '../src/features/rooms/room-listener';

describe('room lobby SQLite projection', () => {
  it('replaces the roster and persists each member join timestamp atomically', async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const database = {
      withExclusiveTransactionAsync: async (operation: (transaction: { runAsync: (sql: string, ...params: unknown[]) => Promise<void> }) => Promise<void>) => {
        await operation({
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
      params: ['room-1', 'host', '12345678', 'WAITING', joinedAt, joinedAt],
    });
    expect(statements[1]).toMatchObject({
      sql: 'DELETE FROM room_members WHERE room_id = ?', params: ['room-1'],
    });
    expect(statements.slice(2).map(statement => statement.params)).toEqual([
      ['room-1', 'host', 'Host', 'HOST', 'ACTIVE', joinedAt],
      ['room-1', 'member', 'Member', 'MEMBER', 'ACTIVE', joinedAt],
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
});
