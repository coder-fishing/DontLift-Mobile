import React from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { Colors } from '../constants/theme';

export function AppBackground() {
  const colors = useColorScheme() === 'dark' ? Colors.dark : Colors.light;

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.background]}>
      <View style={[styles.glow, styles.primary, { backgroundColor: colors.authGlow }]} />
      <View style={[styles.glow, styles.secondary, { backgroundColor: colors.authGlowSecondary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: Colors.light.authBackdrop, overflow: 'hidden' },
  glow: { position: 'absolute', borderRadius: 999 },
  primary: { width: 240, height: 240, top: -90, right: -80 },
  secondary: { width: 200, height: 200, bottom: 120, left: -100 },
});
