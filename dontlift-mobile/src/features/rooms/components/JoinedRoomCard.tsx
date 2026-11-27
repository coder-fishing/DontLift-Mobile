import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { Colors } from '../../../constants/theme';
import type { JoinedRoom } from '../room-repository';

export function JoinedRoomCard({ result, onOpenLobby }: { result: JoinedRoom; onOpenLobby: () => void }) {
  const formattedPin = result.pin
    ? result.pin.length === 8 ? `${result.pin.slice(0, 4)} ${result.pin.slice(4)}` : result.pin
    : '';

  return (
    <View style={styles.resultCard}>
      <View style={styles.successBadge}>
        <Ionicons name="checkmark-circle" size={16} color={Colors.light.success} />
        <Text style={styles.successBadgeText}>ROOM READY</Text>
      </View>
      <View style={styles.pinDisplayBox}>
        <Text style={styles.pinBoxLabel}>ROOM PIN</Text>
        <Text selectable style={styles.pinValue}>{formattedPin}</Text>
        <View style={styles.rosterPill}>
          <Ionicons name="people" size={15} color={Colors.light.primary} />
          <Text style={styles.rosterText}>Members: {result.participantCount}</Text>
        </View>
      </View>
      <PrimaryButton title="Open Lobby" icon={<Ionicons name="enter-outline" size={18} color="#FFFFFF" />}
        onPress={onOpenLobby} style={styles.startCallToAction} />
      {!result.localCacheSaved ? (
        <View style={styles.warningBanner} accessibilityRole="alert">
          <Ionicons name="information-circle-outline" size={16} color={Colors.light.textSecondary} />
          <Text style={styles.warningBannerText}>You joined, but the room could not be saved on this device. Enter the PIN again to retry.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  resultCard: { borderRadius: 28, padding: 22, borderWidth: 1, borderColor: Colors.light.glassBorder, backgroundColor: Colors.light.authFormSurface, alignItems: 'center', gap: 16, shadowColor: Colors.light.glassShadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 4 },
  successBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.successSurface, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  successBadgeText: { color: Colors.light.success, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  pinDisplayBox: { width: '100%', alignItems: 'center', backgroundColor: Colors.light.inputSurface, paddingVertical: 18, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: Colors.light.border, gap: 8 },
  pinBoxLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: Colors.light.textSecondary },
  pinValue: { fontSize: 30, lineHeight: 36, fontWeight: '900', color: Colors.light.primary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontVariant: ['tabular-nums'], letterSpacing: 4 },
  rosterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.backgroundSelected, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginTop: 2 },
  rosterText: { fontSize: 12, fontWeight: '700', color: Colors.light.primary },
  startCallToAction: { height: 54, borderRadius: 22, shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 3 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(100, 116, 139, 0.08)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  warningBannerText: { flex: 1, color: Colors.light.textSecondary, fontSize: 11, lineHeight: 16 },
});
