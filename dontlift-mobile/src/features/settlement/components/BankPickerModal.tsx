import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../../../constants/theme';
import type { BankOption } from '../bank-directory';

export function BankLogo({ bank }: { bank: BankOption }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [bank.bin, bank.logo]);
  return (
    <View style={styles.bankLogo}>
      {bank.logo && !failed ? (
        <Image source={{ uri: bank.logo }} contentFit="contain" transition={120} style={styles.bankLogoImage}
          accessibilityIgnoresInvertColors onError={() => setFailed(true)} />
      ) : (
        <Text style={styles.bankLogoFallback}>{bank.shortName.slice(0, 3).toUpperCase()}</Text>
      )}
    </View>
  );
}

export function BankPickerModal({
  visible,
  banks,
  loading,
  selectedBank,
  search,
  onSearchChange,
  onSelect,
  onManualEntry,
  onClose,
}: {
  visible: boolean;
  banks: BankOption[];
  loading: boolean;
  selectedBank: BankOption | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (bank: BankOption) => void;
  onManualEntry: () => void;
  onClose: () => void;
}) {
  const filteredBanks = banks.filter(bank =>
    `${bank.name} ${bank.shortName} ${bank.code} ${bank.bin}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modal}>
        <Text style={styles.eyebrow}>ROOM SETTLEMENT</Text>
        <Text style={styles.title}>Choose a bank</Text>
        <TextInput accessibilityLabel="Search banks" value={search} onChangeText={onSearchChange}
          placeholder="Search by bank name or code" placeholderTextColor={Colors.light.textSecondary} style={styles.input} />
        <FlatList
          style={styles.bankList}
          data={filteredBanks}
          keyExtractor={item => item.bin}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.shortName}, ${item.name}`}
              accessibilityState={{ selected: selectedBank?.bin === item.bin }} onPress={() => onSelect(item)} style={styles.bankRow}>
              <BankLogo bank={item} />
              <View style={styles.bankRowText}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.bankValue}>{item.shortName}</Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.bankMeta}>{item.name}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Loading banks…' : 'No matching banks.'}</Text>}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Enter bank manually" onPress={onManualEntry} style={styles.manualPickerAction}>
          <Text style={styles.manualToggleText}>Enter bank manually</Text>
          <Text style={styles.manualPickerHint}>Use a bank name or identifier not listed here</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.closePicker}>
          <Text style={styles.backText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, padding: 20, paddingTop: Platform.OS === 'android' ? 32 : 56, gap: 12, backgroundColor: Colors.light.background },
  eyebrow: { color: Colors.light.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: Colors.light.text, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  input: { minHeight: 48, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 12, backgroundColor: Colors.light.inputSurface, color: Colors.light.text, paddingHorizontal: 14, fontSize: 16 },
  bankList: { flex: 1 },
  bankRow: { minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.light.border, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  bankRowText: { flex: 1, gap: 4 },
  bankValue: { color: Colors.light.text, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  bankMeta: { color: Colors.light.textSecondary, fontSize: 12, lineHeight: 16 },
  bankLogo: { width: 48, height: 48, borderRadius: 13, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bankLogoImage: { width: 44, height: 44 },
  bankLogoFallback: { color: Colors.light.primary, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  manualPickerAction: { minHeight: 58, justifyContent: 'center', gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.light.border },
  manualPickerHint: { color: Colors.light.textSecondary, fontSize: 12, lineHeight: 16 },
  closePicker: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  manualToggleText: { color: Colors.light.primary, fontSize: 14, fontWeight: '700' },
  empty: { paddingVertical: 16, color: Colors.light.textSecondary, fontSize: 15, lineHeight: 22 },
  backText: { color: Colors.light.primary, fontSize: 14, fontWeight: '700' },
});
