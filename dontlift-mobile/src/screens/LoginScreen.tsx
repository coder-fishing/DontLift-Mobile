import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { GlassPill } from '../components/GlassPill';
import { PrimaryButton } from '../components/PrimaryButton';

interface LoginScreenProps {
  onAuthenticated: () => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authId, setAuthId] = useState<string>('minh.tran@example.com');
  const [authPin, setAuthPin] = useState<string>('882941');
  const [authConfirm, setAuthConfirm] = useState<string>('882941');
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);

  const handleSubmit = () => {
    if (!authId || !authPin) {
      Alert.alert('Incomplete Fields', 'Please enter your email/phone and 6-digit PIN.');
      return;
    }
    if (authMode === 'signup' && authPin !== authConfirm) {
      Alert.alert('PIN Mismatch', 'PIN and confirmation do not match.');
      return;
    }
    Alert.alert('Authenticated', 'Local SQLite profile initialized. Entering focus mode.');
    onAuthenticated();
  };

  return (
    <View style={styles.container}>
      {/* Title */}
      <View style={styles.heroSection}>
        <View style={styles.iconCircle}>
          <Text style={styles.heroEmoji}>🔒</Text>
        </View>
        <Text style={styles.heroTitle}>Welcome to DontLift</Text>
        <Text style={styles.heroSubtitle}>
          Offline-first phone discipline. Put your device down and cultivate deep focus.
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabPillContainer}>
        <TouchableOpacity
          onPress={() => setAuthMode('signin')}
          style={[styles.authTab, authMode === 'signin' && styles.authTabActive]}
        >
          <Text style={[styles.authTabText, authMode === 'signin' && styles.authTabTextActive]}>
            Sign In
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setAuthMode('signup')}
          style={[styles.authTab, authMode === 'signup' && styles.authTabActive]}
        >
          <Text style={[styles.authTabText, authMode === 'signup' && styles.authTabTextActive]}>
            Create Account
          </Text>
        </TouchableOpacity>
      </View>

      {/* Card Form */}
      <GlassCard style={styles.formCard}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone or Email Address</Text>
          <TextInput
            value={authId}
            onChangeText={setAuthId}
            placeholder="minh.tran@example.com"
            placeholderTextColor="#94A3B8"
            style={styles.textInput}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>6-Digit PIN or Password</Text>
          <TextInput
            value={authPin}
            onChangeText={setAuthPin}
            placeholder="••••••"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            keyboardType="numeric"
            maxLength={6}
            style={[styles.textInput, styles.pinInput]}
          />
        </View>

        {authMode === 'signup' && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm PIN</Text>
            <TextInput
              value={authConfirm}
              onChangeText={setAuthConfirm}
              placeholder="••••••"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              style={[styles.textInput, styles.pinInput]}
            />
          </View>
        )}

        {/* Remember Switch */}
        <View style={styles.rememberRow}>
          <View>
            <Text style={styles.rememberTitle}>Remember Device</Text>
            <Text style={styles.rememberSub}>Offline-first SQLite local store</Text>
          </View>
          <Switch
            value={rememberDevice}
            onValueChange={setRememberDevice}
            trackColor={{ false: '#CBD5E1', true: '#10B981' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <PrimaryButton
          title={authMode === 'signin' ? 'Enter Focus Mode' : 'Create & Arm Device'}
          onPress={handleSubmit}
          style={{ marginTop: 8 }}
        />
      </GlassCard>

      {/* SQLite Badge */}
      <GlassCard style={styles.sqliteNote}>
        <Text style={styles.sqliteIcon}>💾</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.sqliteNoteTitle}>Zero Intermediary Server Dependency</Text>
          <Text style={styles.sqliteNoteDesc}>
            Credentials and session logs persist securely in local SQLite.
          </Text>
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  heroSection: {
    alignItems: 'center',
    textAlign: 'center',
    paddingVertical: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroEmoji: {
    fontSize: 28,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  tabPillContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  authTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  authTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  authTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  authTabTextActive: {
    color: '#2563EB',
  },
  formCard: {
    padding: 20,
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  textInput: {
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  pinInput: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rememberTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  rememberSub: {
    fontSize: 11,
    color: '#64748B',
  },
  sqliteNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  sqliteIcon: {
    fontSize: 22,
  },
  sqliteNoteTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  sqliteNoteDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
