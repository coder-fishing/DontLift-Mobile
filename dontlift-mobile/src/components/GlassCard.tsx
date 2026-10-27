import React from 'react';
import {
  View,
  ViewProps,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  GlassView,
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from 'expo-glass-effect';
import { Colors } from '../constants/theme';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({
  children,
  className = '',
  style,
  ...props
}: GlassCardProps) {
  const colors = Colors.light;

  // Chỉ sử dụng Liquid Glass khi API thực sự khả dụng trên iOS.
  const useLiquidGlass =
    Platform.OS === 'ios' &&
    isLiquidGlassAvailable() &&
    isGlassEffectAPIAvailable();

  return (
    <View
      className={`p-4 ${className}`}
      style={[
        styles.card,
        {
          backgroundColor: useLiquidGlass
            ? 'transparent'
            : colors.authFormSurface,
          borderColor: colors.glassBorder,
          shadowColor: colors.glassShadow,
        },
        !useLiquidGlass && styles.fallback,
        style,
      ]}
      {...props}
    >
      {useLiquidGlass && (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          style={styles.glassBackground}
        />
      )}

      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 28,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
  },

  glassBackground: {
    ...StyleSheet.absoluteFill,
    borderRadius: 27,
  },

  content: {
    zIndex: 1,
  },

  fallback: {
    elevation: 5,
  },
});
