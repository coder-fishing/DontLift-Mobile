import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ScreenId } from '../types';
import { SCREEN_TITLES } from '../constants';
import { Colors } from '../constants/theme';

interface HeaderProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  onOpenSettings: () => void;
}

export function Header({ currentScreen, onNavigate, onOpenSettings }: HeaderProps) {
  return (
    <View style={styles.headerContainer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go to Solo Focus"
        onPress={() => onNavigate('02-solo-select')}
        style={styles.brandGroup}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>DL</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>DontLift</Text>
          <Text style={styles.brandSubtitle}>{SCREEN_TITLES[currentScreen]}</Text>
        </View>
      </Pressable>

      {currentScreen !== '17-settings' ? <View style={styles.rightGroup}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Settings"
          onPress={onOpenSettings}
          style={styles.menuButton}
        >
          <Text style={[styles.menuText, { color: Colors.light.primary }]}>Settings</Text>
        </Pressable>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.9)',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  logoText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
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
    marginTop: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuButton: {
    minWidth: 76,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#004AC6',
  },
});
