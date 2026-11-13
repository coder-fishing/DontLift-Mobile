import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/theme';

export function BankTransferButton({ onPress, disabled = false, busy = false }: { onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <View style={styles.frame}>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose a supported banking app to transfer"
        accessibilityHint="Opens a list of banking apps. Your payment details will be filled in when supported by the app."
        accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy} onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
        {busy ? <ActivityIndicator color={Colors.light.onPrimary} /> : <Text style={styles.label}>Transfer in a bank app</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderWidth: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary, shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 5, elevation: 3 },
  button: { width: '100%', minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  label: { color: Colors.light.onPrimary, fontSize: 18, lineHeight: 24, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
