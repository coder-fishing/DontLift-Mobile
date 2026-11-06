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
  colors?: typeof Colors.light | typeof Colors.dark;
  variant?: 'glass' | 'solid';
}

export function GlassCard({
  children,
  className = '',
  colors = Colors.light,
  variant = 'glass',
  style,
  ...props
}: GlassCardProps) {
  // Chỉ sử dụng Liquid Glass khi API thực sự khả dụng trên iOS.
  const useLiquidGlass =
    variant === 'glass' &&
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
            : variant === 'solid' ? colors.backgroundElement : colors.authFormSurface,
          borderColor: colors.glassBorder,
          shadowColor: colors.glassShadow,
        },
        variant === 'solid' ? styles.solid : !useLiquidGlass ? styles.fallback : null,
        style,
      ]}
      {...props}
    >
      {useLiquidGlass ? (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          style={styles.glassBackground}
        />
      ) : null}

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
  solid: {
    shadowOpacity: 0,
    elevation: 0,
  },
});
