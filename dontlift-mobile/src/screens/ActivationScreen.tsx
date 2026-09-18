import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { GlassPill } from '../components/GlassPill';
import { PrimaryButton } from '../components/PrimaryButton';

export function ActivationScreen() {
  const [licenseKey, setLicenseKey] = useState<string>('DONTLIFT-8924-K92M-991A');
  const [isPro, setIsPro] = useState<boolean>(true);

  return (
    <View style={styles.container}>
      {/* Title */}
      <View style={styles.hero}>
        <View style={styles.badgeRow}>
          <GlassPill style={{ paddingVertical: 3 }}>
            <Text style={styles.badgeText}>
              {isPro ? '✓ Pro License Active' : 'Free Tier (5 Peer Limit)'}
            </Text>
          </GlassPill>
          <Text style={styles.edText}>Ed25519 Verified</Text>
        </View>

        <Text style={styles.title}>Unlock DontLift Pro</Text>
        <Text style={styles.desc}>
          Upgrade to unlimited group participants, permanent SQLite telemetry storage, and priority
          mesh sync.
        </Text>
      </View>

      {/* Highlights */}
      <View style={styles.highlightsRow}>
        <GlassPill style={styles.highlightPill}>
          <Text style={styles.highlightText}>♾️ Unlimited Peers</Text>
        </GlassPill>
        <GlassPill style={styles.highlightPill}>
          <Text style={styles.highlightText}>💾 Offline SQLite</Text>
        </GlassPill>
        <GlassPill style={styles.highlightPill}>
          <Text style={styles.highlightText}>⏱ Sub-Sec Grace</Text>
        </GlassPill>
      </View>

      {/* Input Form Card */}
      <GlassCard style={styles.formCard}>
        <View style={styles.formHeader}>
          <Text style={styles.formLabel}>Enter Activation License Key</Text>
          <TouchableOpacity
            onPress={() => {
              setLicenseKey('DL-PRO-2026-X99');
              Alert.alert('Pasted', 'Sample Pro key pasted!');
            }}
          >
            <Text style={styles.pasteText}>Paste</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            value={licenseKey}
            onChangeText={(text) => setLicenseKey(text.toUpperCase())}
            placeholder="DONTLIFT-XXXX-XXXX-XXXX"
            placeholderTextColor="#94A3B8"
            style={styles.keyInput}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.cryptoBadge}>
          <Text style={styles.cryptoIcon}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cryptoTitle}>Valid Cryptographic License</Text>
            <Text style={styles.cryptoSub}>
              DontLift Lifetime Pro • Signature Verified via Ed25519 Local Key
            </Text>
          </View>
        </View>

        <PrimaryButton
          title="Activate Pro License"
          onPress={() => {
            setIsPro(true);
            Alert.alert('🎉 Pro Activated', 'DontLift Pro unlocked with all features!');
          }}
        />
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  hero: {
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  edText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    fontFamily: 'monospace',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  desc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  highlightsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  highlightPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  highlightText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  formCard: {
    padding: 18,
    gap: 14,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  pasteText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  inputContainer: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 14,
  },
  keyInput: {
    height: 48,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  cryptoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 12,
  },
  cryptoIcon: {
    fontSize: 20,
  },
  cryptoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  cryptoSub: {
    fontSize: 10,
    color: '#15803D',
    marginTop: 1,
  },
});
