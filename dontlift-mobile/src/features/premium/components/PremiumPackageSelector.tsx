import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../../constants/theme';
import { getPremiumPlanLabels, type PremiumPackage } from '../premium-api';

type Props = {
  packages: readonly PremiumPackage[];
  bestValuePackageId: string | null;
  selectedPackageId: string;
  pendingPackageId?: string;
  disabled: boolean;
  onSelect: (packageId: string) => void;
};

const colors = Colors.light;
const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`;

export function PremiumPackageSelector({
  packages,
  bestValuePackageId,
  selectedPackageId,
  pendingPackageId,
  disabled,
  onSelect,
}: Props) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Premium plans" style={styles.packages}>
      {packages.map(pack => {
        const labels = getPremiumPlanLabels(pack);
        const isSelected = selectedPackageId === pack.id;
        const isBestValue = bestValuePackageId === pack.id && packages.length > 1;
        return (
          <Pressable
            key={pack.id}
            accessibilityRole="radio"
            accessibilityLabel={`${pack.paidMonths} ${pack.paidMonths === 1 ? 'month' : 'months'}, ${money(pack.amountVnd)}${labels.bonusMonths > 0 ? `, plus ${labels.bonusMonths} months free, use Premium for ${pack.grantedMonths} months` : ', basic access'}`}
            accessibilityHint={pendingPackageId && pack.id !== pendingPackageId
              ? 'Selecting this plan will cancel the current payment QR after a short pause, then replace it when cancellation is confirmed.'
              : 'Select this Premium package'}
            accessibilityState={{ checked: isSelected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(pack.id)}
            style={({ pressed }) => [styles.package, isSelected && styles.selected, pressed && styles.packagePressed]}
          >
            <View style={styles.packageRow}>
              <View style={styles.packageCopy}>
                {isBestValue ? <Text style={styles.bestValue}>BEST VALUE</Text> : null}
                <Text style={styles.duration}>{labels.duration}</Text>
                {labels.bonus ? <Text style={styles.bonus}>{labels.bonus}</Text> : null}
                <Text style={styles.caption}>{labels.access}</Text>
              </View>
              <View style={styles.priceChoice}>
                <Text style={styles.price}>{money(pack.amountVnd)}</Text>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                  style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected ? <View style={styles.radioDot} /> : null}
                </View>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  packages: { gap: 12 },
  package: {
    minHeight: 88,
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  selected: {
    borderColor: colors.primary,
    borderWidth: 2,
    padding: 14,
    backgroundColor: colors.backgroundSelected,
  },
  packagePressed: { opacity: 0.82 },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  packageCopy: { flex: 1, alignItems: 'flex-start', gap: 4 },
  priceChoice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexShrink: 0 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  bestValue: {
    color: colors.primary,
    backgroundColor: colors.backgroundSelected,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  bonus: {
    color: colors.success,
    backgroundColor: colors.successSurface,
    fontSize: 14,
    fontWeight: '700',
    overflow: 'hidden',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  duration: { color: colors.text, fontSize: 17, fontWeight: '700' },
  price: { color: colors.text, fontSize: 19, fontWeight: '700' },
  caption: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
});
