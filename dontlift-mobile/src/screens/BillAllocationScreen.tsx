import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { BillParticipantShare } from '../types';
import { formatVND } from '../constants';

interface BillAllocationScreenProps {
  totalBillAmount: number;
  billBreakdown: BillParticipantShare[];
  hostOverrideMode: boolean;
  onUpdateTotalBill: (amount: number) => void;
  onToggleHostOverride: () => void;
  onPublishBill: () => void;
}

export function BillAllocationScreen({
  totalBillAmount,
  billBreakdown,
  hostOverrideMode,
  onUpdateTotalBill,
  onToggleHostOverride,
  onPublishBill,
}: BillAllocationScreenProps) {
  const [billInput, setBillInput] = useState<string>(formatVND(totalBillAmount));

  const handleBillChange = (val: string) => {
    const raw = val.replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10) || 0;
    onUpdateTotalBill(num);
    setBillInput(raw ? formatVND(num) : '');
  };

  return (
    <View style={styles.container}>
      <GlassCard style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Host Bill Allocation</Text>
          <View style={styles.roomBadge}>
            <Text style={styles.roomBadgeText}>ROOM #8821</Text>
          </View>
        </View>
        <Text style={styles.headerSub}>⏱ 45m Session • ⚠️ 3 Total Violations</Text>
      </GlassCard>

      {/* Bill Input Card */}
      <GlassCard style={styles.inputCard}>
        <Text style={styles.inputLabel}>Enter Total Bill Amount (VND)</Text>
        <View style={styles.inputRow}>
          <Text style={styles.currencySymbol}>₫</Text>
          <TextInput
            value={billInput}
            onChangeText={handleBillChange}
            placeholder="550,000"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            style={styles.billTextInput}
          />
        </View>

        <View style={styles.formulaNote}>
          <Text style={styles.formulaText}>
            💡 <Text style={{ fontWeight: '800' }}>40% Flat Base</Text> +{' '}
            <Text style={{ fontWeight: '800' }}>60% Penalty Share</Text> formula applied.
          </Text>
        </View>
      </GlassCard>

      {/* Member Shares */}
      <View style={styles.sharesSection}>
        <View style={styles.sharesHeaderRow}>
          <Text style={styles.sharesHeaderTitle}>Allocated Member Shares</Text>
          <TouchableOpacity onPress={onToggleHostOverride}>
            <Text style={styles.overrideToggleText}>
              {hostOverrideMode ? 'Auto Formula' : 'Host Override'}
            </Text>
          </TouchableOpacity>
        </View>

        {billBreakdown.map((m) => (
          <GlassCard key={m.id} style={styles.memberShareCard}>
            <View style={styles.memberShareTop}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{m.initials}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberViolationSub}>
                  {m.lifts === 0 ? '✓ 0 violations (Clean)' : `⚠️ ${m.lifts} violations`}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.shareTotal}>{formatVND(m.totalShare)} ₫</Text>
                <Text style={styles.shareTotalLabel}>Assigned Share</Text>
              </View>
            </View>

            <View style={styles.shareBreakdownRow}>
              <Text style={styles.breakdownSub}>Base: {formatVND(m.baseShare)} ₫</Text>
              <Text style={styles.breakdownSub}>Penalty: {formatVND(m.penaltyShare)} ₫</Text>
            </View>
          </GlassCard>
        ))}
      </View>

      <PrimaryButton
        title="Publish & Settle via VietQR"
        onPress={() => {
          Alert.alert('Bill Published', 'VietQR settlement generated!');
          onPublishBill();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  headerCard: {
    padding: 16,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  roomBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roomBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  headerSub: {
    fontSize: 11,
    color: '#64748B',
  },
  inputCard: {
    padding: 16,
    gap: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '900',
    color: '#64748B',
    marginRight: 8,
  },
  billTextInput: {
    flex: 1,
    height: 50,
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  formulaNote: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 10,
  },
  formulaText: {
    fontSize: 11,
    color: '#1E40AF',
  },
  sharesSection: {
    gap: 8,
  },
  sharesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sharesHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  overrideToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  memberShareCard: {
    padding: 12,
    gap: 8,
  },
  memberShareTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2563EB',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  memberViolationSub: {
    fontSize: 10,
    color: '#64748B',
  },
  shareTotal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  shareTotalLabel: {
    fontSize: 9,
    color: '#64748B',
  },
  shareBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  breakdownSub: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'monospace',
  },
});
