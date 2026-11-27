import React from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../../../constants/theme';
import { formatVND } from '../../../constants';
import type { BillShareOverride } from '../bill-allocation';

export type OverrideDraft = { type: BillShareOverride['type']; value: string };
type Member = { uid: string; displayName: string };

export function OverrideMemberEditor({
  member,
  currentShareVnd,
  draft,
  colors,
  disabled,
  onDraftChange,
}: {
  member: Member;
  currentShareVnd: number;
  draft?: OverrideDraft;
  colors: typeof Colors.light | typeof Colors.dark;
  disabled: boolean;
  onDraftChange: (value: OverrideDraft | null) => void;
}) {
  const name = member.displayName.trim() || 'Participant';
  return (
    <View style={[styles.overrideRow, { borderTopColor: colors.border }]}>
      <View style={styles.overrideRowHeading}>
        <View style={styles.memberInfo}>
          <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={2}>{name}</Text>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>Current share · {formatVND(currentShareVnd)} VND</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${draft ? 'Remove custom amount for' : 'Set custom amount for'} ${name}`}
          accessibilityState={{ checked: Boolean(draft), disabled }} disabled={disabled}
          onPress={() => onDraftChange(draft ? null : { type: 'FIXED_VND', value: '' })}
          style={({ pressed }) => [styles.rowToggle, { borderColor: colors.border }, pressed && styles.pressed, disabled && styles.disabled]}>
          <Text style={[styles.rowToggleText, { color: colors.primary }]}>{draft ? 'Use default' : 'Customize'}</Text>
        </Pressable>
      </View>
      {draft ? (
        <View style={styles.overrideInputs}>
          <View style={styles.overrideTypes}>
            {(['FIXED_VND', 'PERCENT_BPS'] as const).map(type => (
              <Pressable key={type} accessibilityRole="button" accessibilityState={{ selected: draft.type === type, disabled }}
                accessibilityLabel={type === 'FIXED_VND' ? `Set fixed VND for ${name}` : `Set percentage for ${name}`}
                disabled={disabled} onPress={() => onDraftChange({ ...draft, type })}
                style={({ pressed }) => [styles.typeButton,
                  { backgroundColor: draft.type === type ? colors.primary : colors.inputSurface,
                    borderColor: draft.type === type ? colors.primary : colors.border }, pressed && styles.pressed, disabled && styles.disabled]}>
                <Text style={[styles.typeButtonText, { color: draft.type === type ? colors.onPrimary : colors.textSecondary }]}>
                  {type === 'FIXED_VND' ? 'Fixed VND' : 'Percent'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.inputSurface }]}>
            <Text accessibilityElementsHidden style={[styles.currency, { color: colors.textSecondary }]}>{draft.type === 'FIXED_VND' ? '₫' : '%'}</Text>
            <TextInput accessibilityLabel={`${draft.type === 'FIXED_VND' ? 'Fixed VND amount' : 'Bill percentage'} for ${name}`}
              accessibilityHint={draft.type === 'FIXED_VND' ? 'Whole Vietnamese dong.' : 'Zero to one hundred percent, up to two decimal places.'}
              editable={!disabled} keyboardType={draft.type === 'FIXED_VND' ? 'number-pad' : 'decimal-pad'}
              returnKeyType="done" value={draft.value}
              onChangeText={value => onDraftChange({ ...draft, value: value.replace(draft.type === 'FIXED_VND' ? /[^\d]/g : /[^\d.]/g, '') })}
              onSubmitEditing={Keyboard.dismiss} placeholder={draft.type === 'FIXED_VND' ? 'e.g. 150000' : 'e.g. 25.00'}
              placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text }]} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overrideRow: { gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  overrideRowHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  memberInfo: { flex: 1, gap: 3 },
  memberName: { color: Colors.light.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  helper: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  rowToggle: { minHeight: 48, minWidth: 92, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderRadius: 12 },
  rowToggleText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.48 },
  overrideInputs: { gap: 8, paddingBottom: 8 },
  overrideTypes: { flexDirection: 'row', gap: 8 },
  typeButton: { minWidth: 64, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  typeButtonText: { fontSize: 13, fontWeight: '800' },
  inputWrap: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  currency: { color: Colors.light.textSecondary, fontSize: 21, fontWeight: '700' },
  input: { flex: 1, minHeight: 52, color: Colors.light.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
