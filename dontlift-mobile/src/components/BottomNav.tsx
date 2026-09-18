import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenId } from '../types';

interface BottomNavProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}

export function BottomNav({ currentScreen, onNavigate }: BottomNavProps) {
  const insets = useSafeAreaInsets();

  const isSolo =
    currentScreen === '02-solo-select' ||
    currentScreen === '03-solo-timer' ||
    currentScreen === '04-solo-summary';

  const isGroup =
    currentScreen === '05-group-lobby' ||
    currentScreen === '06-group-active' ||
    currentScreen === '07-bill-allocation' ||
    currentScreen === '08-vietqr-settlement';

  return (
    <View
      style={[
        styles.bottomNavContainer,
        {
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onNavigate('02-solo-select')}
        style={[styles.navTab, isSolo && styles.navTabActive]}
      >
        <Text style={[styles.navIcon, isSolo && styles.navIconActive]}>⏱</Text>
        <Text style={[styles.navLabel, isSolo && styles.navLabelActive]}>Solo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onNavigate('05-group-lobby')}
        style={[styles.navTab, isGroup && styles.navTabActive]}
      >
        <Text style={[styles.navIcon, isGroup && styles.navIconActive]}>👥</Text>
        <Text style={[styles.navLabel, isGroup && styles.navLabelActive]}>Group</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onNavigate('10-hardware-diagnostics')}
        style={[styles.navTab, currentScreen === '10-hardware-diagnostics' && styles.navTabActive]}
      >
        <Text style={[styles.navIcon, currentScreen === '10-hardware-diagnostics' && styles.navIconActive]}>
          📡
        </Text>
        <Text
          style={[styles.navLabel, currentScreen === '10-hardware-diagnostics' && styles.navLabelActive]}
        >
          Sensors
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onNavigate('09-activation')}
        style={[styles.navTab, currentScreen === '09-activation' && styles.navTabActive]}
      >
        <Text style={[styles.navIcon, currentScreen === '09-activation' && styles.navIconActive]}>
          👑
        </Text>
        <Text style={[styles.navLabel, currentScreen === '09-activation' && styles.navLabelActive]}>
          Pro
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onNavigate('01-login')}
        style={[styles.navTab, currentScreen === '01-login' && styles.navTabActive]}
      >
        <Text style={[styles.navIcon, currentScreen === '01-login' && styles.navIconActive]}>
          👤
        </Text>
        <Text style={[styles.navLabel, currentScreen === '01-login' && styles.navLabelActive]}>
          Account
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.95)',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  navTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    minWidth: 54,
  },
  navTabActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  navIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
});
