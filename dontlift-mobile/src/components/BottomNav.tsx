import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  GlassView,
   isGlassEffectAPIAvailable,
} from "expo-glass-effect";
import { ScreenId } from "../types";
import { Colors } from "../constants/theme";

interface BottomNavProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  pendingGroupSyncCount?: number;
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

export function BottomNav({ currentScreen, onNavigate, pendingGroupSyncCount = 0 }: BottomNavProps) {
  const insets = useSafeAreaInsets();

  // Render native glass whenever the iOS runtime exposes UIGlassEffect.
  const useLiquidGlass =
    Platform.OS === "ios" &&
    isGlassEffectAPIAvailable();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", Colors.light.bottomNavSurface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.bottomFade}
      />
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
            style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
          />
        )}

        {TABS.map((tab) => {
          const active = tab.screens.includes(currentScreen);
          const isGroup = tab.label === "Group";
          const tabLabel = isGroup && pendingGroupSyncCount > 0
            ? `${tab.label}, ${pendingGroupSyncCount} violations waiting to sync` : tab.label;

          return (
            <Pressable
              key={tab.label}
              accessibilityRole="button"
              accessibilityLabel={tabLabel}
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
                <View style={styles.iconWithBadge}>
                  <View style={styles.iconSlot}>
                    <Ionicons
                      name={active ? tab.activeIcon : tab.icon}
                      size={22}
                      color={active ? Colors.light.primary : Colors.light.textSecondary}
                    />
                  </View>
                  {isGroup && pendingGroupSyncCount > 0 ? (
                    <View accessibilityElementsHidden style={styles.syncBadge}>
                      <Text style={styles.syncBadgeText}>{pendingGroupSyncCount > 99 ? "99+" : pendingGroupSyncCount}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={[styles.label, active && styles.activeLabel]}>
                  {tab.label}
                </Text>
                <View style={[styles.activeIndicator, active && styles.activeIndicatorSelected]} />
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
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 8,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    elevation: 0,
  },

  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 108,
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
    zIndex: 50,
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
    backgroundColor: Colors.light.bottomNavSurface,
    borderColor: Colors.light.bottomNavBorder,
  },

  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginHorizontal: 0,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 2,
  },

  iconSlot: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  iconWithBadge: {
    position: "relative",
    width: 28,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
  },

  syncBadge: {
    position: "absolute",
    top: -3,
    right: -8,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.warningSurface,
    borderWidth: 1,
    borderColor: Colors.light.warning,
  },

  syncBadgeText: {
    color: Colors.light.warning,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  activeIndicator: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: "transparent",
  },

  activeIndicatorSelected: {
    backgroundColor: Colors.light.primary,
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
    fontSize: 10,
    lineHeight: 13,
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
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  }
});
