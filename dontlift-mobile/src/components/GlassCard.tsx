import React from 'react';
import { View, ViewProps, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className = '', style, ...props }: GlassCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <View
      className={`p-4 ${className}`}
      style={[
        styles.card,
        {
          backgroundColor: colors.authFormSurface,
          borderColor: colors.glassBorder,
          shadowColor: colors.glassShadow,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
});
