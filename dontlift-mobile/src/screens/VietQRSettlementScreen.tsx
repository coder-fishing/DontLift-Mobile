import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { BillParticipantShare } from '../types';
import { formatVND } from '../constants';

interface VietQRSettlementScreenProps {
  billBreakdown: BillParticipantShare[];
}

export function VietQRSettlementScreen({ billBreakdown }: VietQRSettlementScreenProps) {
  const [isSettled, setIsSettled] = useState<boolean>(false);
  const myShare = billBreakdown.find((p) => p.isCurrentUser)?.totalShare || 55000;

  return (
    <View style={styles.container}>
      {/* Share Header Card */}
      <GlassCard style={styles.shareCard}>
        <View style={styles.shareRow}>
          <View>
            <Text style={styles.shareLabel}>YOUR ASSIGNED SHARE</Text>
            <Text style={styles.shareAmount}>
              {formatVND(myShare)} <Text style={styles.vndUnit}>VND</Text>
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              setIsSettled(!isSettled);
              Alert.alert('Status Updated', isSettled ? 'Marked Unpaid' : 'Marked Settled');
            }}
            style={[styles.settledBadge, isSettled ? styles.settledActive : styles.settledPending]}
          >
            <Text
              style={[
                styles.settledText,
                isSettled ? styles.settledTextActive : styles.settledTextPending,
              ]}
            >
              {isSettled ? '✓ Settled' : 'Unpaid'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.shareDetails}>
          <Text style={styles.detailText}>Base Share (40%): 55,000 VND</Text>
          <Text style={styles.detailText}>Penalty Share: 0 VND (Clean Run)</Text>
        </View>
      </GlassCard>

      {/* VietQR Graphic Card */}
      <GlassCard style={styles.qrCard}>
        <View style={styles.qrHeader}>
          <View>
            <Text style={styles.qrTitle}>VietQR P2P Direct</Text>
            <Text style={styles.qrSub}>NAPAS 24/7 Fast Transfer • No Fee</Text>
          </View>
          <View style={styles.noFeeBadge}>
            <Text style={styles.noFeeText}>NO FEE</Text>
          </View>
        </View>

        {/* Vector VietQR Representation */}
        <View style={styles.qrBox}>
          <Svg width={140} height={140} viewBox="0 0 100 100">
            {/* 3 Alignment Finder Patterns */}
            <Rect x="10" y="10" width="24" height="24" rx="3" fill="#0F172A" />
            <Rect x="14" y="14" width="16" height="16" rx="2" fill="#FFFFFF" />
            <Rect x="18" y="18" width="8" height="8" rx="1" fill="#0F172A" />

            <Rect x="66" y="10" width="24" height="24" rx="3" fill="#0F172A" />
            <Rect x="70" y="14" width="16" height="16" rx="2" fill="#FFFFFF" />
            <Rect x="74" y="18" width="8" height="8" rx="1" fill="#0F172A" />

            <Rect x="10" y="66" width="24" height="24" rx="3" fill="#0F172A" />
            <Rect x="14" y="70" width="16" height="16" rx="2" fill="#FFFFFF" />
            <Rect x="18" y="74" width="8" height="8" rx="1" fill="#0F172A" />

            {/* Simulated Data Matrix Bits */}
            <Rect x="40" y="14" width="6" height="6" rx="1" fill="#0F172A" />
            <Rect x="52" y="14" width="6" height="6" rx="1" fill="#0F172A" />
            <Rect x="40" y="26" width="6" height="6" rx="1" fill="#0F172A" />
            <Rect x="48" y="36" width="6" height="6" rx="1" fill="#0F172A" />
            <Rect x="20" y="44" width="6" height="6" rx="1" fill="#0F172A" />
            <Rect x="32" y="48" width="6" height="6" rx="1" fill="#0F172A" />
            <Rect x="66" y="44" width="6" height="6" rx="1" fill="#0F172A" />
            <Rect x="76" y="48" width="6" height="6" rx="1" fill="#0F172A" />
            <Rect x="44" y="56" width="12" height="6" rx="1" fill="#0F172A" />
            <Rect x="64" y="66" width="6" height="6" rx="1" fill="#0F172A" />
            <Rect x="76" y="66" width="6" height="6" rx="1" fill="#0F172A" />
            <Rect x="68" y="76" width="14" height="6" rx="1" fill="#0F172A" />
          </Svg>
        </View>

        {/* Transfer Memo Details */}
        <View style={styles.bankDetails}>
          <View style={styles.bankDetailRow}>
            <View>
              <Text style={styles.detailLabel}>Host Account</Text>
              <Text style={styles.detailValue}>Techcombank • 1903 8821 0092 11</Text>
            </View>
            <TouchableOpacity
              onPress={() => Alert.alert('Copied', 'Account number copied!')}
              style={styles.copySmallBtn}
            >
              <Text style={styles.copySmallText}>Copy</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bankDetailRow}>
            <View>
              <Text style={styles.detailLabel}>Transfer Memo</Text>
              <Text style={[styles.detailValue, { color: '#2563EB', fontWeight: '900' }]}>
                DL8821 MINH TRAN
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => Alert.alert('Copied', 'Transfer memo copied!')}
              style={styles.copySmallBtn}
            >
              <Text style={styles.copySmallText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GlassCard>

      <PrimaryButton
        title={isSettled ? 'Payment Confirmed & Settled' : 'Confirm VietQR Payment'}
        onPress={() => {
          setIsSettled(true);
          Alert.alert('✅ Settlement Complete', 'VietQR payment confirmed & reconciled in SQLite!');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  shareCard: {
    padding: 16,
    gap: 10,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  shareAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  vndUnit: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '800',
  },
  settledBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  settledActive: {
    backgroundColor: '#DCFCE7',
  },
  settledPending: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  settledText: {
    fontSize: 11,
    fontWeight: '800',
  },
  settledTextActive: {
    color: '#166534',
  },
  settledTextPending: {
    color: '#0F172A',
  },
  shareDetails: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    padding: 10,
    borderRadius: 10,
    gap: 2,
  },
  detailText: {
    fontSize: 11,
    color: '#475569',
  },
  qrCard: {
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  qrTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  qrSub: {
    fontSize: 10,
    color: '#64748B',
  },
  noFeeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  noFeeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  bankDetails: {
    width: '100%',
    gap: 8,
  },
  bankDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.6)',
    padding: 10,
    borderRadius: 10,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  copySmallBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copySmallText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
});
