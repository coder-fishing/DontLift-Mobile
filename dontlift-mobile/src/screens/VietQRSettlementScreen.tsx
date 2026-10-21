import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { Colors } from '../constants/theme';
import { formatVND } from '../constants';
import type { PublishedBill } from '../features/settlement/bill-repository';
import type { SettlementDetails } from '../features/settlement/settlement-details-repository';

type Props = {
  bill: PublishedBill | null;
  actorUid: string;
  settlementDetails: SettlementDetails | null;
};

export function VietQRSettlementScreen({ bill, actorUid, settlementDetails }: Props) {
  const myShare = bill?.shares.find(participant => participant.uid === actorUid)?.shareVnd;

  return (
    <View style={styles.container}>
      <GlassCard style={styles.card}>
        <Text style={styles.eyebrow}>YOUR SHARE</Text>
        {myShare == null
          ? <Text style={styles.body}>No published bill split is available for this room.</Text>
          : <Text style={styles.amount}>{formatVND(myShare)} <Text style={styles.currency}>VND</Text></Text>}
        <Text style={styles.body}>Payment tracking and scannable VietQR are planned for a later slice.</Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.title}>Host payment details</Text>
        {settlementDetails ? (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Bank</Text>
              <Text selectable style={styles.value}>{settlementDetails.bankId}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Account number</Text>
              <Text selectable style={styles.value}>{settlementDetails.accountNumber}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Account holder</Text>
              <Text selectable style={styles.value}>{settlementDetails.accountName}</Text>
            </View>
            <Text style={styles.expiry}>Details available until {new Date(settlementDetails.expiresAtUtcMs).toLocaleDateString()}.</Text>
          </>
        ) : (
          <Text style={styles.body}>Host payment details are not available for this room.</Text>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  card: { gap: 10, padding: 20 },
  eyebrow: { color: Colors.light.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: Colors.light.text, fontSize: 18, fontWeight: '800' },
  amount: { color: Colors.light.text, fontSize: 28, fontWeight: '900' },
  currency: { color: Colors.light.primary, fontSize: 14, fontWeight: '800' },
  body: { color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20 },
  row: { gap: 4, borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 10 },
  label: { color: Colors.light.textSecondary, fontSize: 12, fontWeight: '700' },
  value: { color: Colors.light.text, fontSize: 16, fontWeight: '800' },
  expiry: { color: Colors.light.textSecondary, fontSize: 12 },
});
