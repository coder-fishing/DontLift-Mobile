import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Colors } from '../constants/theme';

export function AppBackground({ colors = Colors.light }: { colors?: typeof Colors.light | typeof Colors.dark }) {
  if (colors === Colors.dark) {
    return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />;
  }
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Image source={require('../../assets/images/app-background.png')} contentFit="cover" transition={0} style={StyleSheet.absoluteFill} />
    </View>
  );
}
