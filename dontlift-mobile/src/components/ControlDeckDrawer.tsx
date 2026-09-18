import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { ScreenId } from '../types';

interface ControlDeckDrawerProps {
  visible: boolean;
  currentScreen: ScreenId;
  isHostRole: boolean;
  showEmptyState: boolean;
  onClose: () => void;
  onNavigate: (screen: ScreenId) => void;
  onToggleHostRole: () => void;
  onToggleEmptyState: () => void;
}

export function ControlDeckDrawer({
  visible,
  currentScreen,
  isHostRole,
  showEmptyState,
  onClose,
  onNavigate,
  onToggleHostRole,
  onToggleEmptyState,
}: ControlDeckDrawerProps) {
  const screens: Array<{ id: ScreenId; label: string }> = [
    { id: '01-login', label: '01. Log In / Sign Up' },
    { id: '02-solo-select', label: '02. Solo Time Selection' },
    { id: '03-solo-timer', label: '03. Solo Timer & Grace' },
    { id: '04-solo-summary', label: '04. Solo Summary Log' },
    { id: '05-group-lobby', label: '05. Group Room Lobby' },
    { id: '06-group-active', label: '06. Active Group Session' },
    { id: '07-bill-allocation', label: '07. Host Bill Allocation' },
    { id: '08-vietqr-settlement', label: '08. VietQR Settlement' },
    { id: '09-activation', label: '09. Pro License Key' },
    { id: '10-hardware-diagnostics', label: '10. Hardware Diagnostics' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Sheet Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <Text style={styles.deckIcon}>🛠️</Text>
              <Text style={styles.sheetTitle}>Prototype Control Deck</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Screen Jumps */}
            <Text style={styles.sectionHeader}>Jump to Screen (1–10)</Text>
            <View style={styles.gridContainer}>
              {screens.map((s) => {
                const isCurrent = currentScreen === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => {
                      onNavigate(s.id);
                      onClose();
                    }}
                    style={[styles.screenBtn, isCurrent && styles.screenBtnActive]}
                  >
                    <Text style={[styles.screenBtnText, isCurrent && styles.screenBtnTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Toggles */}
            <Text style={[styles.sectionHeader, { marginTop: 16 }]}>Testing Toggles</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                onPress={onToggleHostRole}
                style={[styles.toggleBtn, isHostRole && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleBtnText, isHostRole && styles.toggleBtnTextActive]}>
                  {isHostRole ? '👑 Role: Host View' : '👤 Role: Member View'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onToggleEmptyState}
                style={[styles.toggleBtn, showEmptyState && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleBtnText, showEmptyState && styles.toggleBtnTextActive]}>
                  {showEmptyState ? '📦 Empty: Simulated' : '📦 Empty: Normal'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deckIcon: {
    fontSize: 18,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
  },
  sheetBody: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  gridContainer: {
    gap: 8,
  },
  screenBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  screenBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  screenBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  screenBtnTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  toggleBtnTextActive: {
    color: '#2563EB',
  },
});
