import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';
import type { JoinedRoom } from '../features/rooms/room-repository';

interface JoinRoomScreenProps {
  result: JoinedRoom | null;
  isJoining: boolean;
  errorMessage?: string;
  onJoin: (pin: string) => void;
  onCancel: () => void;
}

export function JoinRoomScreen({ result, isJoining, errorMessage, onJoin, onCancel }: JoinRoomScreenProps) {
  const [pin, setPin] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>GROUP ROOM</Text>
        <Text style={styles.title}>{result ? 'Đã tham gia phòng' : 'Nhập mã PIN phòng'}</Text>
        {result ? (
          <>
            <Text style={styles.body}>Bạn đã vào phòng đang chờ. Mã PIN được giữ trên thiết bị này để mở lại phòng.</Text>
            <Text style={styles.pin}>{result.pin}</Text>
            <Text style={styles.body}>Hiện có {result.participantCount} người trong phòng.</Text>
            {!result.localCacheSaved ? (
              <Text accessibilityRole="alert" style={styles.body}>Đã tham gia trên Firebase, nhưng cache trên thiết bị chưa hoàn tất. Bạn có thể nhập lại mã này để thử cache lần nữa.</Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.body}>Nhập mã 8 số trên lời mời. Mã 4 số từ phòng cũ vẫn được chấp nhận.</Text>
            <TextInput
              accessibilityLabel="Mã PIN phòng"
              autoComplete="off"
              autoCorrect={false}
              keyboardType="number-pad"
              maxLength={8}
              onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 8))}
              placeholder="00000000"
              placeholderTextColor={Colors.light.textSecondary}
              returnKeyType="done"
              style={styles.input}
              value={pin}
              editable={!isJoining}
              onSubmitEditing={() => { if (pin.length === 4 || pin.length === 8) onJoin(pin); }}
            />
            {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
            {isJoining ? (
              <View style={styles.loading}>
                <ActivityIndicator color={Colors.light.primary} />
                <Text style={styles.body}>Đang kiểm tra mã…</Text>
              </View>
            ) : (
              <PrimaryButton
                title="Tham gia phòng"
                disabled={pin.length !== 4 && pin.length !== 8}
                onPress={() => onJoin(pin)}
              />
            )}
          </>
        )}
        <PrimaryButton title="Quay lại" variant="secondary" onPress={onCancel} disabled={isJoining} />
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
  input: {
    width: '100%', minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: Colors.light.border,
    backgroundColor: Colors.light.inputSurface, color: Colors.light.text,
    fontSize: 24, fontWeight: '800', letterSpacing: 5, textAlign: 'center',
  },
  pin: { color: Colors.light.text, fontSize: 28, fontWeight: '900', letterSpacing: 5, fontVariant: ['tabular-nums'] },
  error: { color: Colors.light.error, fontSize: 13, textAlign: 'center' },
  loading: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
