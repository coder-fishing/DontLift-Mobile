import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { Colors } from '../constants/theme';

interface RoomQrScannerProps {
  onBarcodeScanned: (result: { data: string; type: string }) => void;
  onMountError: () => void;
}

export function RoomQrScanner({ onBarcodeScanned, onMountError }: RoomQrScannerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.hint}>Align the invitation QR code within the frame</Text>
      <View style={styles.cameraFrame}>
        <CameraView
          testID="room-invite-camera"
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onBarcodeScanned}
          onMountError={onMountError}
        />
        <View pointerEvents="none" style={styles.target}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', gap: 10 },
  hint: { color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  cameraFrame: {
    width: '100%', height: 280, overflow: 'hidden', borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.text,
  },
  target: { width: '72%', aspectRatio: 1, maxWidth: 240, maxHeight: 240, position: 'relative' },
  corner: { width: 30, height: 30, position: 'absolute', borderColor: Colors.light.onPrimary, borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
});
