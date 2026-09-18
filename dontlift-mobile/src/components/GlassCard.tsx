import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className = '', style, ...props }: GlassCardProps) {
  return (
    <View
      className={`rounded-3xl border border-white/90 bg-white/45 p-4 shadow-sm ${className}`}
      style={[styles.card, style]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
});
