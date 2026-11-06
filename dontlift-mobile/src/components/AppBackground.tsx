import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

export function AppBackground() {
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Image source={require('../../assets/images/app-background.png')} contentFit="cover" transition={0} style={StyleSheet.absoluteFill} />
    </View>
  );
}
