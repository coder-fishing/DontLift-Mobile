import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { PremiumAvatar } from '../../../components/PremiumAvatar';
import { Colors } from '../../../constants/theme';
import { formatVND } from '../../../constants';
import type { BillShare } from '../bill-repository';
import { OverrideMemberEditor, type OverrideDraft } from './OverrideMemberEditor';

export type BillAllocationMember = {
  uid: string;
  displayName: string;
  penaltyScore: number;
  avatarUri?: string;
  premiumExpiresAtUtcMs?: number | null;
};

type Props = {
  item: BillShare;
  member?: BillAllocationMember;
  colors: typeof Colors.light | typeof Colors.dark;
  showRank: boolean;
  rank: number;
  showPercentInput: boolean;
  percentValue: string;
  inputRef: (input: TextInputInstance | null) => void;
  percentReturnKey: 'next' | 'done';
  percentEditable: boolean;
  onPercentChange: (value: string) => void;
  onPercentFocus: () => void;
  onPercentSubmit: () => void;
  showPaymentStatus: boolean;
  hasSavedPaymentState: boolean;
  showUncalculatedAmount: boolean;
  showMarkPaid: boolean;
  paymentDisabled: boolean;
  onMarkPaid: () => void;
  showOverrideEditor: boolean;
  isApplyingOverride: boolean;
  hasPendingOverride: boolean;
  overrideDraft?: OverrideDraft;
  onOverrideDraftChange: (value: OverrideDraft | null) => void;
};

export function shareLabel(member: BillAllocationMember | undefined): string {
  return member?.displayName.trim() || 'Participant';
}

export function BillShareListRow({
  item,
  member,
  colors,
  showRank,
  rank,
  showPercentInput,
  percentValue,
  inputRef,
  percentReturnKey,
  percentEditable,
  onPercentChange,
  onPercentFocus,
  onPercentSubmit,
  showPaymentStatus,
  hasSavedPaymentState,
  showUncalculatedAmount,
  showMarkPaid,
  paymentDisabled,
  onMarkPaid,
  showOverrideEditor,
  isApplyingOverride,
  hasPendingOverride,
  overrideDraft,
  onOverrideDraftChange,
}: Props) {
  const name = shareLabel(member);
  return (
    <View>
      <View style={[styles.shareRow, { borderBottomColor: colors.border }]}>
        {showRank ? (
          <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.rankNumber}>{String(rank)}</Text>
          </View>
        ) : null}
        <PremiumAvatar
          displayName={name}
          imageUri={member?.avatarUri}
          premiumExpiresAtUtcMs={member?.premiumExpiresAtUtcMs}
          initials={name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || '?'}
          size={46}
          backgroundColor={colors.backgroundSelected}
          fallbackColor={colors.primary}
          borderColor={colors.border}
          style={styles.memberAvatar}
          textStyle={styles.memberAvatarInitials}
        />
        <View style={styles.memberInfo}>
          <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={2}>
            {name}
          </Text>
          {showPercentInput ? (
            <View style={[styles.percentInputWrap, { borderColor: colors.border, backgroundColor: colors.inputSurface }]}>
              <TextInput
                ref={inputRef}
                accessibilityLabel={`Bill percentage for ${name}`}
                keyboardType="decimal-pad"
                returnKeyType={percentReturnKey}
                blurOnSubmit={false}
                onFocus={onPercentFocus}
                onSubmitEditing={onPercentSubmit}
                editable={percentEditable}
                value={percentValue}
                onChangeText={onPercentChange}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={[styles.percentInput, { color: colors.text }]}
              />
              <Text style={[styles.percentSuffix, { color: colors.textSecondary }]}>%</Text>
            </View>
          ) : null}
          {showPaymentStatus ? (
            <Text style={[styles.helper, { color: item.paymentStatus === 'MARKED_AS_PAID' ? colors.primary : colors.textSecondary }]}>
              {item.shareVnd === 0
                ? 'No payment due'
                : item.paymentStatus === 'MARKED_AS_PAID'
                  ? `Paid · Host confirmed${hasSavedPaymentState ? ' (saved copy)' : ''}`
                  : 'Awaiting Host confirmation'}
            </Text>
          ) : null}
        </View>
        <Text
          accessibilityLabel={showUncalculatedAmount
            ? `Share amount for ${name} not calculated until percentages total 100 percent`
            : `${name} pays ${formatVND(item.shareVnd)} Vietnamese dong`}
          style={[styles.shareAmount, { color: colors.text }]}
        >
          {showUncalculatedAmount ? '— VND' : `${formatVND(item.shareVnd)} VND`}
        </Text>
      </View>
      {showMarkPaid ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mark ${name} as paid`}
          disabled={paymentDisabled}
          accessibilityState={{ disabled: paymentDisabled }}
          onPress={onMarkPaid}
          style={({ pressed }) => [styles.markPaidButton, { borderColor: colors.border }, pressed && styles.pressed, paymentDisabled && styles.disabled]}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Mark as paid</Text>
        </Pressable>
      ) : null}
      {showOverrideEditor && member ? (
        <OverrideMemberEditor
          member={member}
          currentShareVnd={item.shareVnd}
          draft={overrideDraft}
          colors={colors}
          disabled={isApplyingOverride || hasPendingOverride}
          onDraftChange={onOverrideDraftChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  markPaidButton: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderRadius: 14, alignSelf: 'flex-end', justifyContent: 'center', marginBottom: 12 },
  shareRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.light.border },
  memberAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  memberAvatarInitials: { fontSize: 15, fontWeight: '800' },
  rankBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rankNumber: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  percentInputWrap: { width: 92, minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, borderRadius: 10, borderWidth: 1 },
  percentInput: { flex: 1, minHeight: 36, paddingVertical: 0, fontSize: 15, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  percentSuffix: { marginLeft: 4, fontSize: 14, fontWeight: '700' },
  memberInfo: { flex: 1, gap: 3 },
  memberName: { color: Colors.light.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  helper: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  shareAmount: { maxWidth: '46%', color: Colors.light.text, fontSize: 15, lineHeight: 21, fontWeight: '800', fontVariant: ['tabular-nums'], textAlign: 'right' },
  secondaryButtonText: { fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.48 },
});
