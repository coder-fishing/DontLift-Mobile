import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Colors } from '../../constants/theme';
import type { BankAppOption, BankAppPlatform } from './bank-app-directory';

type Props = {
  visible: boolean;
  directory?: { list: (platform: BankAppPlatform) => Promise<BankAppOption[]> };
  onClose: () => void;
  onSelect: (app: BankAppOption) => Promise<void>;
};

export function BankAppPicker({ visible, directory, onClose, onSelect }: Props) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  const [apps, setApps] = useState<BankAppOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [attemptedLoad, setAttemptedLoad] = useState(false);
  const [openError, setOpenError] = useState(false);
  const [openingAppId, setOpeningAppId] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    setAttemptedLoad(true);
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : null;
    if (!directory || !platform) {
      setLoadError(true);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const loaded = await directory.list(platform);
      setApps(loaded);
      setLoadError(loaded.length === 0);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [directory]);

  useEffect(() => {
    if (visible && !attemptedLoad && !loading) void loadApps();
    if (!visible) {
      setOpenError(false);
      setOpeningAppId(null);
      setSearchQuery('');
    }
  }, [visible, attemptedLoad, loading, loadApps]);

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (app) =>
        app.appName.toLowerCase().includes(q) ||
        app.bankName.toLowerCase().includes(q)
    );
  }, [apps, searchQuery]);

  const retryLoad = () => {
    setAttemptedLoad(false);
    setLoadError(false);
  };

  async function choose(app: BankAppOption) {
    setOpeningAppId(app.appId);
    setOpenError(false);
    try {
      await onSelect(app);
      onClose();
    } catch {
      setOpenError(true);
    } finally {
      setOpeningAppId(null);
    }
  }

  // Fallback màu an toàn tránh trường hợp token trong theme bị undefined
  const cardBg = colors.backgroundElement ?? (isDark ? '#1E222B' : '#F8FAFC');
  const cardBorder = colors.border ?? (isDark ? '#2E3440' : '#E2E8F0');
  const pillBg = colors.backgroundSelected ?? (isDark ? '#2A303C' : '#EEF2F6');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.roomModalOverlay || 'rgba(0,0,0,0.45)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: colors.background, borderColor: cardBorder }]}
        >
          {/* Thanh kéo trang trí chuẩn Bottom Sheet */}
          <View style={styles.handleWrapper}>
            <View style={[styles.handle, { backgroundColor: cardBorder }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
                Choose your banking app
              </Text>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>
                Transfer details are prefilled when supported by the app.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close banking app list"
              onPress={onClose}
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pillBg },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Thanh tìm kiếm nhanh */}
          {!loading && !loadError && apps.length > 0 && (
            <View style={[styles.searchBox, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search bank name (e.g. Vietcombank, ACB, MB...)"
                placeholderTextColor={colors.textSecondary}
                style={[styles.searchInput, { color: colors.text }]}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
          )}

          {/* Thông báo lỗi mở app */}
          {openError ? (
            <View style={[styles.errorBanner, { backgroundColor: isDark ? '#3B1818' : '#FEF2F2' }]}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.error }]}>
                Could not open that app. Choose another app or use the QR code.
              </Text>
            </View>
          ) : null}

          {/* Nội dung danh sách */}
          {loading ? (
            <View style={styles.message}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                Loading supported apps…
              </Text>
            </View>
          ) : loadError ? (
            <View style={styles.message}>
              <Ionicons name="cloud-offline-outline" size={36} color={colors.textSecondary} />
              <Text accessibilityRole="alert" style={[styles.body, { color: colors.textSecondary }]}>
                Banking apps could not be loaded. The QR code is still available.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={retryLoad}
                style={({ pressed }) => [
                  styles.retry,
                  { backgroundColor: pillBg },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.actionText, { color: colors.primary }]}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={filteredApps}
              keyExtractor={(item) => item.appId}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptySearch}>
                  <Text style={[styles.body, { color: colors.textSecondary }]}>
                    No banking app matches "{searchQuery}"
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isOpening = openingAppId === item.appId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${item.appName} to transfer to ${item.bankName}`}
                    accessibilityState={{ disabled: openingAppId !== null }}
                    disabled={openingAppId !== null}
                    onPress={() => {
                      void choose(item);
                    }}
                    style={({ pressed }) => [
                      styles.row,
                      { backgroundColor: cardBg, borderColor: cardBorder },
                      pressed && styles.pressed,
                    ]}
                  >
                    {/* Bọc nội dung bằng View flexDirection: 'row' để ép layout ngang tuyệt đối trên mọi thiết bị */}
                    <View style={styles.rowInner}>
                      <View style={[styles.logoWrapper, { borderColor: cardBorder }]}>
                        {item.appLogo ? (
                          <Image
                            source={{ uri: item.appLogo }}
                            contentFit="cover"
                            style={styles.logo}
                          />
                        ) : (
                          <View style={[styles.logoFallback, { backgroundColor: pillBg }]}>
                            <Ionicons name="business-outline" size={22} color={colors.primary} />
                          </View>
                        )}
                      </View>

                      <View style={styles.appCopy}>
                        <Text numberOfLines={1} style={[styles.appName, { color: colors.text }]}>
                          {item.appName}
                        </Text>
                        <Text numberOfLines={1} style={[styles.bankName, { color: colors.textSecondary }]}>
                          {item.bankName}
                        </Text>
                      </View>

                      <View style={[styles.openIndicator, { backgroundColor: pillBg }]}>
                        {isOpening ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Ionicons name="open-outline" size={17} color={colors.primary} />
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '80%',
    maxHeight: '86%',
    minHeight: '50%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  handleWrapper: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 14,
  },
  heading: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  message: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retry: {
    minHeight: 42,
    paddingHorizontal: 20,
    borderRadius: 21,
    justifyContent: 'center',
    marginTop: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingBottom: 16,
  },
  emptySearch: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  row: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  logoWrapper: {
    width: 48,
    height: 48,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF', // Nền trắng giúp logo ngân hàng luôn rõ nét kể cả ở Dark Mode
    flexShrink: 0,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  logoFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
  },
  appName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  bankName: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  openIndicator: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});