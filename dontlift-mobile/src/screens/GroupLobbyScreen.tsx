import React from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { RoomInvitationQr } from '../components/RoomInvitationQr';
import type { CreatedRoom } from '../features/rooms/room-repository';

interface GroupLobbyScreenProps {
  room: CreatedRoom | null;
  isCreating: boolean;
  errorMessage?: string;
  onCreateRoom: () => void;
}

export function GroupLobbyScreen({ room, isCreating, errorMessage, onCreateRoom }: GroupLobbyScreenProps) {
  if (!room) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>GROUP ROOM</Text>
          <Text style={styles.title}>Tạo phòng tập trung</Text>
          <Text style={styles.body}>Tạo phòng đang chờ. PIN và mã QR chỉ xuất hiện sau khi lưu thành công trên Firebase.</Text>
          {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
          {isCreating ? (
            <View style={styles.loading}>
              <ActivityIndicator color={Colors.light.primary} />
              <Text style={styles.body}>Đang tạo phòng…</Text>
            </View>
          ) : (
            <PrimaryButton title="Create Room" onPress={onCreateRoom} />
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
        <Text style={styles.body}>Chia sẻ mã mời để người khác tham gia. Lobby realtime và tham gia bằng PIN sẽ có ở slice sau.</Text>
        <View style={styles.qrCard} accessibilityLabel="Mã QR lời mời phòng">
          <RoomInvitationQr value={room.invitation} size={200} />
        </View>
        <Text style={styles.pinLabel}>PIN PHÒNG</Text>
        <Text selectable style={styles.pin}>{room.pin}</Text>
        <Text selectable style={styles.invitation}>{room.invitation}</Text>
        {!room.localCacheSaved ? (
          <Text accessibilityRole="alert" style={styles.error}>Phòng đã lưu trên Firebase, nhưng cache trên thiết bị chưa ghi được.</Text>
        ) : null}
        <PrimaryButton
          title="Chia sẻ lời mời"
          onPress={() => { void Share.share({ message: `Tham gia phòng DontLift ${room.pin}: ${room.invitation}` }); }}
        />
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
  pin: { color: Colors.light.text, fontSize: 34, fontWeight: '900', letterSpacing: 8, fontVariant: ['tabular-nums'] },
  invitation: { color: Colors.light.primary, fontSize: 13, textAlign: 'center' },
});
