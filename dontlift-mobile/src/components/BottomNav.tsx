import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  GlassView,
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from "expo-glass-effect";
import { ScreenId } from "../types";
import { Colors } from "../constants/theme";

interface BottomNavProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}

const TABS = [
  {
    label: "Solo",
    icon: "timer-outline" as const,
    activeIcon: "timer" as const,
    screen: "02-solo-select" as ScreenId,
    screens: [
      "02-solo-select",
      "03-solo-timer",
      "04-solo-summary",
      "11-solo-history",
    ],
  },
  {
    label: "Group",
    icon: "people-outline" as const,
    activeIcon: "people" as const,
    screen: "05-group-lobby" as ScreenId,
    screens: [
      "05-group-lobby",
      "12-join-room",
      "06-group-active",
      "13-group-summary",
      "07-bill-allocation",
      "08-vietqr-settlement",
      "14-settlement-details",
      "15-group-history",
    ],
  },
  // {
  //   label: 'Sensors',
  //   icon: 'hardware-chip-outline' as const,
  //   activeIcon: 'hardware-chip' as const,
  //   screen: '10-hardware-diagnostics' as ScreenId,
  //   screens: ['10-hardware-diagnostics'],
  // },
  {
    label: "Pro",
    icon: "diamond-outline" as const,
    activeIcon: "diamond" as const,
    screen: "09-activation" as ScreenId,
    screens: ["09-activation"],
  },
  {
    label: "Account",
    icon: "person-outline" as const,
    activeIcon: "person" as const,
    screen: "16-profile" as ScreenId,
    screens: ["16-profile", "17-settings"],
  },
];

export function BottomNav({ currentScreen, onNavigate }: BottomNavProps) {
  const insets = useSafeAreaInsets();

  // Only check the native Liquid Glass API on iOS.
  const useLiquidGlass =
    Platform.OS === "ios" &&
    isLiquidGlassAvailable() &&
    isGlassEffectAPIAvailable();

  return (
    <View
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <View
        style={[
          styles.bar,
          useLiquidGlass ? styles.nativeGlassBar : styles.fallbackBar,
        ]}
      >
        {useLiquidGlass && (
          <GlassView
            pointerEvents="none"
            glassEffectStyle="regular"
            style={StyleSheet.absoluteFill}
          />
        )}

        {TABS.map((tab) => {
          const active = tab.screens.includes(currentScreen);

          return (
            <Pressable
              key={tab.label}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              hitSlop={0}
              onPress={() => onNavigate(tab.screen)}
              style={({ pressed }) => [
                styles.tab,
                active && styles.activeTab,
                pressed && styles.pressedTab,
              ]}
            >
              <View pointerEvents="none" style={styles.tabContent}>
                <View style={styles.iconSlot}>
                  <Ionicons
                    name={active ? tab.activeIcon : tab.icon}
                    size={24}
                    color={active ? Colors.light.primary : Colors.light.textSecondary}
                  />
                </View>

                <Text style={[styles.label, active && styles.activeLabel]}>
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },

  bar: {
    position: "relative",
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-around",
    borderRadius: 28,
    paddingHorizontal: 5,
    paddingVertical: 6,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },

  nativeGlassBar: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.35)",
  },

  fallbackBar: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderColor: "rgba(255,255,255,0.85)",
  },

  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginHorizontal: 0,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 6,
  },

  iconSlot: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },

  activeTab: {
    backgroundColor: "rgba(37,99,235,0.10)",
    borderColor: "rgba(37,99,235,0.12)",
  },

  pressedTab: {
    opacity: 0.72,
  },

  label: {
    width: "100%",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: Colors.light.textSecondary,
    textAlign: "center",
    includeFontPadding: false,
  },

  activeLabel: {
    color: Colors.light.primary,
    fontWeight: "800",
  },

  tabContent: {
    
  }
});
