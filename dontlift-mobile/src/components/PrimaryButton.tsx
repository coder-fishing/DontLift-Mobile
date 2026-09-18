import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps, StyleSheet, View } from 'react-native';

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
  ...props
}: PrimaryButtonProps) {
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';

  const buttonStyle = [
    styles.button,
    isSecondary ? styles.buttonSecondary : isDanger ? styles.buttonDanger : styles.buttonPrimary,
    style,
  ];

  const textStyle = [
    styles.buttonText,
    isSecondary ? styles.textSecondary : isDanger ? styles.textDanger : styles.textPrimary,
  ];

  return (
    <TouchableOpacity activeOpacity={0.8} style={buttonStyle} {...props}>
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
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonPrimary: {
    backgroundColor: '#2563EB',
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
  },
  buttonDanger: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  textSecondary: {
    color: '#0F172A',
  },
  textDanger: {
    color: '#FFFFFF',
  },
  iconContainer: {
    marginRight: 8,
  },
});
