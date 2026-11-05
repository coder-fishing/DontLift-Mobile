import React, { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/theme';
import { RoomInvitationQr } from './RoomInvitationQr';

export function RoomInviteCard({ pin, invitation }: { pin: string; invitation: string }) {
  const [expanded, setExpanded] = useState(false);
  const formattedPin = pin.length === 8 ? `${pin.slice(0, 4)} ${pin.slice(4)}` : pin;

  // The saturated PIN/QR surface is the lobby's focal point and keeps white labels legible over the backdrop.
  return (
    <LinearGradient
      colors={[...Colors.light.roomInviteGradient]}
      start={{ x: 0, y: 0.4 }}
      end={{ x: 1, y: 0.6 }}
      style={styles.card}
    >
      <View style={styles.code}>
        <View style={styles.labelRow}>
          <Ionicons name="key-outline" size={16} color={Colors.light.onPrimary} />
          <Text style={styles.label}>ROOM PIN</Text>
        </View>
        <Text selectable style={styles.pin}>{formattedPin}</Text>
        <Text style={styles.hint}>Share this PIN with friends</Text>
      </View>
      <View style={styles.divider} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View invitation QR code"
        accessibilityHint="Opens a larger QR code to scan"
        onPress={() => setExpanded(true)}
        style={({ pressed }) => [styles.qrButton, pressed ? styles.pressed : null]}
      >
        <View style={styles.qrFrame}><RoomInvitationQr value={invitation} size={88} /></View>
        <Text style={styles.qrLabel}>Scan to Join</Text>
      </Pressable>
      <Modal transparent visible={expanded} animationType="fade" onRequestClose={() => setExpanded(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Scan to Join</Text>
            <RoomInvitationQr value={invitation} size={240} />
            <Text selectable style={styles.dialogPin}>{formattedPin}</Text>
            <Pressable accessibilityRole="button" onPress={() => setExpanded(false)} style={styles.close}>
              <Text style={styles.closeText}>Close QR Code</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%', minHeight: 168, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 14, padding: 16, borderRadius: 24,
    borderWidth: 1, borderColor: Colors.light.roomInviteBorder, overflow: 'hidden',
  },
  code: { flex: 1, minWidth: 0, gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { color: Colors.light.onPrimary, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  pin: { color: Colors.light.onPrimary, fontSize: 26, fontWeight: '800', letterSpacing: 1.2, fontVariant: ['tabular-nums'] },
  hint: { color: Colors.light.roomInviteHint, fontSize: 12, lineHeight: 17 },
  divider: { width: 1, height: 112, backgroundColor: Colors.light.roomInviteDivider },
  qrButton: { minWidth: 106, minHeight: 128, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 8, borderRadius: 18 },
  qrFrame: { padding: 8, borderRadius: 14, backgroundColor: Colors.light.roomInviteQrSurface },
  qrLabel: { color: Colors.light.onPrimary, fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.82 },
  overlay: { flex: 1, backgroundColor: Colors.light.roomModalOverlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 340, alignItems: 'center', gap: 16, padding: 22, borderRadius: 24, backgroundColor: Colors.light.qrBackground },
  dialogTitle: { color: Colors.light.text, fontSize: 20, fontWeight: '800' },
  dialogPin: { color: Colors.light.primary, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  close: { minHeight: 48, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: Colors.light.primary },
  closeText: { color: Colors.light.onPrimary, fontSize: 14, fontWeight: '700' },
});
