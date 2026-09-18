import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

interface GlassPillProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassPill({ children, className = '', style, ...props }: GlassPillProps) {
  return (
    <View
      className={`rounded-full border border-white/90 bg-white/55 px-3 py-1.5 shadow-xs ${className}`}
      style={[styles.pill, style]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
});
