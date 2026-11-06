import React from 'react';
import { Pressable, Text, type PressableProps, StyleSheet, View } from 'react-native';
import { Colors } from '../constants/theme';

interface PrimaryButtonProps extends PressableProps {
  title: string;
  className?: string;
  textClassName?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  shape?: 'pill' | 'rounded';
  colors?: typeof Colors.light | typeof Colors.dark;
}

export function PrimaryButton({
  title,
  className = '',
  textClassName = '',
  icon,
  variant = 'primary',
  shape = 'pill',
  colors = Colors.light,
  style,
  disabled,
  accessibilityState,
  ...props
}: PrimaryButtonProps) {
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';
  const backgroundColor = isSecondary ? colors.glassSurface : isDanger ? colors.error : colors.primary;
  const borderColor = isSecondary ? colors.glassBorder : 'transparent';
  const textColor = isSecondary ? colors.text : colors.onPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor, shadowColor: isDanger ? colors.error : colors.primary, borderRadius: shape === 'pill' ? 9999 : 18 },
        isSecondary ? styles.secondary : null,
        disabled ? styles.disabled : null,
        typeof style === 'function' ? style({ pressed, hovered: false }) : style,
        pressed && !disabled ? styles.pressed : null,
      ]}
      {...props}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text className={textClassName} style={[styles.buttonText, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    width: '100%',
    borderRadius: 9999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  secondary: { shadowColor: '#000', shadowOpacity: 0.05 },
  buttonText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  iconContainer: { marginRight: 8 },
  disabled: { opacity: 0.48, elevation: 0, shadowOpacity: 0 },
  pressed: { opacity: 0.78 },
});
