
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GlassView,
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from 'expo-glass-effect';

import { ScreenId } from '../types';
import { SCREEN_TITLES } from '../constants';
import { Colors } from '../constants/theme';

interface HeaderProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  onOpenSettings: () => void;
}

export function Header({
  currentScreen,
  onNavigate,
  onOpenSettings,
}: HeaderProps) {
  const useLiquidGlass =
    Platform.OS === 'ios' &&
    isLiquidGlassAvailable() &&
    isGlassEffectAPIAvailable();

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.headerContainer,
          useLiquidGlass
            ? styles.nativeGlass
            : styles.fallbackGlass,
        ]}
      >
        {useLiquidGlass && (
          <GlassView
            pointerEvents="none"
            glassEffectStyle="regular"
            style={StyleSheet.absoluteFill}
          />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to Solo Focus"
          onPress={() => onNavigate('02-solo-select')}
          style={({ pressed }) => [
            styles.brandGroup,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>DL</Text>
          </View>

          <View style={styles.brandInfo}>
            <Text style={styles.brandTitle}>DontLift</Text>
            <Text
              style={styles.brandSubtitle}
              numberOfLines={1}
            >
              {SCREEN_TITLES[currentScreen]}
            </Text>
          </View>
        </Pressable>

        {currentScreen !== '17-settings' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            onPress={onOpenSettings}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="settings-outline"
              size={17}
              color={Colors.light.primary}
            />
            <Text style={styles.settingsText}>Settings</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 14,
    paddingTop: 6,
  },

  headerContainer: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },

  nativeGlass: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.35)',
  },

  fallbackGlass: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: 'rgba(255,255,255,0.9)',
  },

  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },

  brandInfo: {
    flex: 1,
    minWidth: 0,
  },

  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },

  logoText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: -0.5,
  },

  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },

  brandSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },

  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },

  settingsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },

  pressed: {
    opacity: 0.7,
  },
});
