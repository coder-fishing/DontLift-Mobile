import React from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { RoomInvitationQr } from '../components/RoomInvitationQr';
import type { RoomLobbyState } from '../features/rooms/room-listener';

type LobbyRoom = { roomId: string; pin: string; invitation: string; hostUid: string; hostDisplayName?: string; createdAt: string | null; localCacheSaved: boolean };

interface GroupLobbyScreenProps {
  room: LobbyRoom | null;
  isCreating: boolean;
  errorMessage?: string;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onCancelCreate: () => void;
  lobbyState?: RoomLobbyState | null;
  isHost?: boolean;
  isStarting?: boolean;
  startError?: string;
  onStartRoom?: () => void;
}

export function GroupLobbyScreen({ room, isCreating, errorMessage, onCreateRoom, onJoinRoom, onCancelCreate, lobbyState, isHost, isStarting, startError, onStartRoom }: GroupLobbyScreenProps) {
  // Snapshot của phòng trước không được lóe lên giữa lần đổi room và effect cleanup.
  const visibleLobbyState = lobbyState?.snapshot && lobbyState.snapshot.roomId !== room?.roomId ? null : lobbyState;
  if (!room) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>GROUP ROOM</Text>
          <Text style={styles.title}>Tạo phòng tập trung</Text>
          <Text style={styles.body}>Tạo phòng đang chờ. PIN và mã QR chỉ xuất hiện sau khi lưu thành công trên Firebase.</Text>
          {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
          {isCreating ? (
            <>
              <View style={styles.loading}>
                <ActivityIndicator color={Colors.light.primary} />
                <Text style={styles.body}>Đang tạo phòng…</Text>
              </View>
              <PrimaryButton title="Hủy tạo, chuyển sang tham gia" variant="secondary" onPress={onCancelCreate} />
            </>
          ) : (
            <>
              <PrimaryButton title="Create Room" onPress={onCreateRoom} />
              <PrimaryButton title="Tham gia bằng PIN" variant="secondary" onPress={onJoinRoom} />
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ROOM ĐANG CHỜ</Text>
        <Text style={styles.title}>Phòng đã sẵn sàng</Text>
        <Text style={styles.body}>Chia sẻ mã mời để người khác tham gia. Danh sách bên dưới được cập nhật trực tiếp từ Firebase.</Text>
        <View style={styles.qrCard} accessibilityLabel="Mã QR lời mời phòng">
          <RoomInvitationQr value={room.invitation} size={200} />
        </View>
        <Text style={styles.pinLabel}>PIN PHÒNG</Text>
        <Text selectable style={styles.pin}>{room.pin}</Text>
        <Text selectable style={styles.invitation}>{room.invitation}</Text>
        {!visibleLobbyState || visibleLobbyState.kind === 'loading' ? <Text style={styles.body}>Đang tải danh sách thành viên…</Text> : null}
        {visibleLobbyState?.kind === 'cached' ? <Text style={styles.body}>Đang hiển thị dữ liệu đã lưu trên máy; chờ kết nối Firebase để cập nhật trực tiếp.</Text> : null}
        {visibleLobbyState?.kind === 'error' ? <Text accessibilityRole="alert" style={styles.error}>Mất kết nối tới danh sách realtime. Đang giữ dữ liệu gần nhất.</Text> : null}
        {visibleLobbyState?.snapshot ? (
          <View style={styles.roster} accessibilityLabel="Danh sách thành viên trong phòng">
            <Text style={styles.pinLabel}>{visibleLobbyState.snapshot.status === 'ACTIVE' ? 'PHÒNG ĐÃ BẮT ĐẦU' : 'ĐANG CHỜ'} · {visibleLobbyState.snapshot.participantCount} NGƯỜI</Text>
            {visibleLobbyState.snapshot.members.map(member => (
              <Text key={member.uid} style={styles.member}>{member.displayName}{member.uid === room.hostUid ? ' · Host' : ''}</Text>
            ))}
          </View>
        ) : null}
        {isHost && visibleLobbyState?.kind === 'live' && visibleLobbyState.snapshot.status === 'WAITING' ? (
          <>
            {startError ? <Text accessibilityRole="alert" style={styles.error}>{startError}</Text> : null}
            <PrimaryButton title={isStarting ? 'Đang bắt đầu…' : 'Bắt đầu phòng'} onPress={onStartRoom ?? (() => {})} disabled={isStarting} />
          </>
        ) : null}
        {!room.localCacheSaved && room.createdAt === null ? (
          <Text accessibilityRole="alert" style={styles.body}>Phòng đã lưu trên Firebase. Thời gian máy chủ đang chờ xác nhận nên chưa lưu cache cục bộ.</Text>
        ) : null}
        {!room.localCacheSaved && room.createdAt !== null ? (
          <Text accessibilityRole="alert" style={styles.error}>Phòng đã lưu trên Firebase, nhưng cache trên thiết bị chưa ghi được.</Text>
        ) : null}
        <PrimaryButton
          title="Chia sẻ lời mời"
          onPress={() => { void Share.share({ message: `Tham gia phòng DontLift ${room.pin}: ${room.invitation}` }); }}
        />
        <PrimaryButton title="Tham gia phòng khác" variant="secondary" onPress={onJoinRoom} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  card: {
    alignItems: 'center', gap: 14, padding: 20, borderRadius: 24,
    backgroundColor: Colors.light.glassSurface, borderColor: Colors.light.glassBorder, borderWidth: 1,
  },
  eyebrow: { color: Colors.light.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: Colors.light.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  body: { color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  error: { color: Colors.light.error, fontSize: 13, textAlign: 'center' },
  loading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  qrCard: { backgroundColor: Colors.light.qrBackground, padding: 14, borderRadius: 16 },
  pinLabel: { color: Colors.light.textSecondary, fontSize: 11, fontWeight: '800' },
  pin: { color: Colors.light.text, fontSize: 30, fontWeight: '900', letterSpacing: 5, fontVariant: ['tabular-nums'] },
  invitation: { color: Colors.light.primary, fontSize: 13, textAlign: 'center' },
  roster: { width: '100%', gap: 8, padding: 14, borderRadius: 16, backgroundColor: Colors.light.backgroundElement },
  member: { color: Colors.light.text, fontSize: 14, textAlign: 'center' },
});
