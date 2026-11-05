import React from 'react';
import { TouchableOpacity, Text, type TouchableOpacityProps, StyleSheet, View } from 'react-native';
import { Colors } from '../constants/theme';

interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
  className?: string;
  textClassName?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function PrimaryButton({
  title,
  className = '',
  textClassName = '',
  icon,
  variant = 'primary',
  style,
  disabled,
  accessibilityState,
  ...props
}: PrimaryButtonProps) {
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';

  const variantStyle = isSecondary ? styles.buttonSecondary : isDanger ? styles.buttonDanger : styles.buttonPrimary;

  const textStyle = [
    styles.buttonText,
    isSecondary ? styles.textSecondary : isDanger ? styles.textDanger : styles.textPrimary,
  ];

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled) }}
      disabled={disabled}
      style={[
        styles.button,
        variantStyle,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}
      {...props}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={textStyle}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    width: '100%',
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonPrimary: {
    backgroundColor: Colors.light.primary,
  },
  buttonSecondary: {
    backgroundColor: Colors.light.glassSurface,
    borderColor: Colors.light.glassBorder,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
  },
  buttonDanger: {
    backgroundColor: Colors.light.error,
    shadowColor: Colors.light.error,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  textSecondary: {
    color: Colors.light.text,
  },
  textDanger: {
    color: Colors.light.onPrimary,
  },
  buttonDisabled: { opacity: 0.48, elevation: 0, shadowOpacity: 0 },
  iconContainer: {
    marginRight: 8,
  },
});
