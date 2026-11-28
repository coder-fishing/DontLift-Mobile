import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { Colors } from '../../../constants/theme';

/** Ô nhập PIN thủ công để tham gia phòng, kèm trạng thái focus và gửi mã. */
export function RoomPinInput({
  pin,
  inputRef,
  isFocused,
  disabled,
  onChange,
  onFocusChange,
  onSubmit,
}: {
  pin: string;
  inputRef: React.RefObject<TextInputInstance | null>;
  isFocused: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onFocusChange: (focused: boolean) => void;
  onSubmit: () => void;
}) {
  const colors = Colors.light;
  return (
    <>
      <Pressable
        accessibilityRole="none"
        onPress={() => inputRef.current?.focus()}
        style={styles.pinDisplayContainer}
      >
        <View style={styles.digitsRow}>
          <View style={styles.digitGroup}>
            {[0, 1, 2, 3].map(idx => {
              const char = pin[idx];
              const active = isFocused && idx === pin.length;
              return (
                <View key={idx} style={[
                  styles.digitSlot,
                  char ? styles.digitSlotFilled : null,
                  active ? styles.digitSlotActive : null,
                ]}>
                  <Text style={[styles.digitChar, char ? styles.digitCharFilled : null]}>
                    {char || (active ? '|' : '•')}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.digitSeparator}><View style={styles.separatorBar} /></View>
          <View style={styles.digitGroup}>
            {[4, 5, 6, 7].map(idx => {
              const char = pin[idx];
              const active = isFocused && idx === pin.length;
              return (
                <View key={idx} style={[
                  styles.digitSlot,
                  char ? styles.digitSlotFilled : null,
                  active ? styles.digitSlotActive : null,
                ]}>
                  <Text style={[styles.digitChar, char ? styles.digitCharFilled : null]}>
                    {char || (active ? '|' : '•')}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
        <TextInput
          ref={inputRef}
          accessibilityLabel="Room PIN"
          accessibilityHint="Enter an 8-digit PIN. Older 4-digit PINs are also accepted."
          autoComplete="off"
          autoCorrect={false}
          keyboardType="number-pad"
          maxLength={8}
          onChangeText={value => onChange(value.replace(/\D/g, '').slice(0, 8))}
          placeholder="Enter PIN"
          placeholderTextColor="transparent"
          returnKeyType="done"
          style={styles.realHiddenInput}
          value={pin}
          editable={!disabled}
          onSubmitEditing={onSubmit}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
        />
      </Pressable>
      <View style={styles.statusRow}>
        {pin.length === 8 ? (
          <View style={styles.statusBadgeSuccess}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.statusTextSuccess}>8-digit PIN · Ready</Text>
          </View>
        ) : pin.length === 4 ? (
          <View style={styles.statusBadgeInfo}>
            <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
            <Text style={styles.statusTextInfo}>Legacy 4-digit PIN · Ready</Text>
          </View>
        ) : pin.length > 0 ? (
          <Text style={styles.counterText}>{pin.length}/8 digits entered</Text>
        ) : (
          <Text style={styles.hintSubtext}>Use the host’s 8-digit PIN or an older 4-digit PIN</Text>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  pinDisplayContainer: { position: 'relative', paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
  digitsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  digitGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  digitSlot: { width: 32, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.light.border, backgroundColor: Colors.light.inputSurface, alignItems: 'center', justifyContent: 'center' },
  digitSlotFilled: { borderColor: Colors.light.primary, backgroundColor: Colors.light.backgroundSelected },
  digitSlotActive: { borderColor: Colors.light.primary, borderWidth: 2, backgroundColor: '#FFFFFF', shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2 },
  digitChar: { fontSize: 20, fontWeight: '800', color: Colors.light.border, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontVariant: ['tabular-nums'], textAlign: 'center' },
  digitCharFilled: { color: Colors.light.primary, fontWeight: '900' },
  digitSeparator: { paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  separatorBar: { width: 6, height: 2, borderRadius: 1, backgroundColor: Colors.light.border },
  realHiddenInput: { ...StyleSheet.absoluteFill, opacity: 0.01, color: 'transparent' },
  statusRow: { alignItems: 'center', justifyContent: 'center', minHeight: 22 },
  statusBadgeSuccess: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.successSurface, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  statusTextSuccess: { color: Colors.light.success, fontSize: 11, fontWeight: '800' },
  statusBadgeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.backgroundSelected, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  statusTextInfo: { color: Colors.light.primary, fontSize: 11, fontWeight: '800' },
  counterText: { fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary, fontVariant: ['tabular-nums'] },
  hintSubtext: { fontSize: 12, color: Colors.light.textSecondary },
});
