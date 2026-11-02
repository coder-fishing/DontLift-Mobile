import React, { useRef, useState } from 'react';
import { useCameraPermissions } from 'expo-camera';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { PrimaryButton } from '../components/PrimaryButton';
import { RoomQrScanner } from '../components/RoomQrScanner';
import { parseRoomInvitation } from '../features/rooms/room-invite-parser';
import type { JoinedRoom } from '../features/rooms/room-repository';

interface JoinRoomScreenProps {
  result: JoinedRoom | null;
  isJoining: boolean;
  errorMessage?: string;
  onJoin: (pin: string) => void;
  onCancel: () => void;
  onOpenLobby?: () => void;
}

export function JoinRoomScreen({
  result,
  isJoining,
  errorMessage,
  onJoin,
  onCancel,
  onOpenLobby,
}: JoinRoomScreenProps) {
  const colors = {
    ...Colors.light,
    authFormSurface: Colors.light.authFormSurface ?? 'rgba(255, 255, 255, 0.42)',
    glassSurface: Colors.light.glassSurface ?? 'rgba(255, 255, 255, 0.58)',
    glassBorder: Colors.light.glassBorder ?? 'rgba(255, 255, 255, 0.88)',
    inputSurface: Colors.light.inputSurface ?? 'rgba(255, 255, 255, 0.66)',
    backgroundElement: Colors.light.backgroundElement ?? '#F3F4F6',
    backgroundSelected: Colors.light.backgroundSelected ?? '#EFF6FF',
    glassShadow: Colors.light.glassShadow ?? 'rgba(37, 74, 153, 0.12)',
    success: Colors.light.success ?? '#059669',
    successSurface: Colors.light.successSurface ?? '#DCFCE7',
    error: Colors.light.error ?? '#B42318',
    textSecondary: Colors.light.textSecondary ?? '#64748B',
    border: Colors.light.border ?? '#C3C6D7',
  };

  const [pin, setPin] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isScannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string>();
  const [cameraDeniedPermanently, setCameraDeniedPermanently] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const scannedRef = useRef(false);
  const textInputRef = useRef<TextInput>(null);

  const openScanner = async () => {
    setScanError(undefined);
    scannedRef.current = false;

    if (!cameraPermission?.granted) {
      try {
        const permission = await requestCameraPermission();
        if (!permission.granted) {
          setCameraDeniedPermanently(!permission.canAskAgain);
          setScanError('Chưa có quyền camera. Bạn vẫn có thể nhập PIN để tham gia.');
          return;
        }
      } catch {
        setScanError('Không kiểm tra được quyền camera. Bạn vẫn có thể nhập PIN để tham gia.');
        return;
      }
    }

    setCameraDeniedPermanently(false);
    setScannerOpen(true);
  };

  const handleBarcodeScanned = (scanned: { data: string; type: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScannerOpen(false);

    const scannedPin = scanned.type === 'qr' ? parseRoomInvitation(scanned.data) : null;
    if (!scannedPin) {
      setScanError('Mã QR này không phải lời mời vào phòng hợp lệ.');
      return;
    }

    setPin(scannedPin);
    setScanError(undefined);
    onJoin(scannedPin);
  };

  const isPinValid = pin.length === 4 || pin.length === 8;

  const formattedPinResult = result?.pin
    ? result.pin.length === 8
      ? `${result.pin.slice(0, 4)} ${result.pin.slice(4)}`
      : result.pin
    : '';

  return (
    <View style={styles.container}>
      {/* Top Bar Navigation */}
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isScannerOpen ? 'Quay về nhập PIN' : 'Quay lại'}
          disabled={isJoining}
          onPress={() => {
            if (isScannerOpen) {
              scannedRef.current = true;
              setScannerOpen(false);
            } else {
              onCancel();
            }
          }}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.tagPill}>
          <Text style={styles.tagText}>{isScannerOpen ? 'QR SCANNER' : 'GROUP ROOM'}</Text>
        </View>

        <View style={styles.backSpacer} />
      </View>

      {/* Title & Description Section (Consistent with Solo screen style) */}
      <View style={styles.titleSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {result
            ? 'Đã tham gia phòng'
            : isScannerOpen
              ? 'Quét mã QR phòng'
              : 'Nhập mã PIN phòng'}
        </Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          {result
            ? 'Bạn đã vào phòng đang chờ. Mã PIN được lưu trên thiết bị để mở lại phòng.'
            : isScannerOpen
              ? 'Canh mã QR trong khung để quét lời mời vào phòng.'
              : 'Nhập mã trên lời mời để tham gia cùng nhóm.'}
        </Text>
      </View>

      {/* Mode Selector Pill Tabs (Active when not in result state) */}
      {!result ? (
        <View style={styles.modeSelector} accessibilityRole="tablist">
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: !isScannerOpen }}
            disabled={isJoining}
            onPress={() => {
              if (isScannerOpen) {
                scannedRef.current = true;
                setScannerOpen(false);
                setScanError(undefined);
              }
            }}
            style={[styles.modeOption, !isScannerOpen && styles.modeOptionActive]}
          >
            <Ionicons
              name="keypad-outline"
              size={15}
              color={!isScannerOpen ? colors.primary : colors.textSecondary}
              style={styles.modeIcon}
            />
            <Text style={[styles.modeText, !isScannerOpen && styles.modeTextActive]}>
              Mã PIN
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isScannerOpen }}
            disabled={isJoining}
            onPress={() => {
              void openScanner();
            }}
            style={[styles.modeOption, isScannerOpen && styles.modeOptionActive]}
          >
            <Ionicons
              name="qr-code-outline"
              size={15}
              color={isScannerOpen ? colors.primary : colors.textSecondary}
              style={styles.modeIcon}
            />
            <Text style={[styles.modeText, isScannerOpen && styles.modeTextActive]}>
              Quét mã QR
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Main Content Area */}
      {result ? (
        /* Joined Room Result View */
        <View style={styles.resultCard}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.successBadgeText}>PHÒNG ĐÃ SẴN SÀNG</Text>
          </View>

          <View style={styles.pinDisplayBox}>
            <Text style={styles.pinBoxLabel}>MÃ PIN PHÒNG</Text>
            <Text selectable style={styles.pinValue}>
              {formattedPinResult}
            </Text>
            <View style={styles.rosterPill}>
              <Ionicons name="people" size={15} color={colors.primary} />
              <Text style={styles.rosterText}>
                Hiện có {result.participantCount} người trong phòng
              </Text>
            </View>
          </View>

          <PrimaryButton
            title="Mở sảnh chờ"
            icon={<Ionicons name="enter-outline" size={18} color="#FFFFFF" />}
            onPress={onOpenLobby ?? onCancel}
            style={styles.startCallToAction}
          />

          {!result.localCacheSaved ? (
            <View style={styles.warningBanner} accessibilityRole="alert">
              <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.warningBannerText}>
                Đã vào phòng nhưng chưa lưu được trên thiết bị. Bạn có thể nhập lại mã này để thử lại.
              </Text>
            </View>
          ) : null}
        </View>
      ) : isScannerOpen ? (
        /* Scanner Mode */
        <View style={styles.scannerCard}>
          <RoomQrScanner
            onBarcodeScanned={handleBarcodeScanned}
            onMountError={() => {
              scannedRef.current = true;
              setScannerOpen(false);
              setScanError('Không mở được camera. Bạn vẫn có thể nhập PIN để tham gia.');
            }}
          />

          <PrimaryButton
            title="Đóng máy quét · Nhập mã tay"
            variant="secondary"
            icon={<Ionicons name="keypad-outline" size={18} color={colors.primary} />}
            onPress={() => {
              scannedRef.current = true;
              setScannerOpen(false);
            }}
          />
        </View>
      ) : (
        /* PIN Entry Mode */
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="lock-closed-outline" size={15} color={colors.primary} />
              <Text style={styles.cardHeaderTitle}>MÃ PHÒNG CHỜ</Text>
            </View>
            {pin.length > 0 && !isJoining ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xóa mã PIN đã nhập"
                onPress={() => {
                  setPin('');
                  textInputRef.current?.focus();
                }}
                style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
              >
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                <Text style={styles.clearButtonText}>Xóa</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Interactive PIN Digits Display */}
          <Pressable
            accessibilityRole="none"
            onPress={() => textInputRef.current?.focus()}
            style={styles.pinDisplayContainer}
          >
            <View style={styles.digitsRow}>
              {/* First 4 digits */}
              <View style={styles.digitGroup}>
                {[0, 1, 2, 3].map((idx) => {
                  const char = pin[idx];
                  const isActive = isInputFocused && idx === pin.length;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.digitSlot,
                        char ? styles.digitSlotFilled : null,
                        isActive ? styles.digitSlotActive : null,
                      ]}
                    >
                      <Text style={[styles.digitChar, char ? styles.digitCharFilled : null]}>
                        {char || (isActive ? '|' : '•')}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.digitSeparator}>
                <View style={styles.separatorBar} />
              </View>

              {/* Second 4 digits */}
              <View style={styles.digitGroup}>
                {[4, 5, 6, 7].map((idx) => {
                  const char = pin[idx];
                  const isActive = isInputFocused && idx === pin.length;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.digitSlot,
                        char ? styles.digitSlotFilled : null,
                        isActive ? styles.digitSlotActive : null,
                      ]}
                    >
                      <Text style={[styles.digitChar, char ? styles.digitCharFilled : null]}>
                        {char || (isActive ? '|' : '•')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Native TextInput overlayed for touch & keyboard accessibility */}
            <TextInput
              ref={textInputRef}
              accessibilityLabel="Mã PIN phòng"
              accessibilityHint="Nhập mã gồm 8 số. Mã 4 số cũ vẫn được chấp nhận."
              autoComplete="off"
              autoCorrect={false}
              keyboardType="number-pad"
              maxLength={8}
              onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Nhập mã PIN"
              placeholderTextColor="transparent"
              returnKeyType="done"
              style={styles.realHiddenInput}
              value={pin}
              editable={!isJoining}
              onSubmitEditing={() => {
                if (pin.length === 4 || pin.length === 8) onJoin(pin);
              }}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
            />
          </Pressable>

          {/* Validation Status Indicator */}
          <View style={styles.statusRow}>
            {pin.length === 8 ? (
              <View style={styles.statusBadgeSuccess}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.statusTextSuccess}>Mã 8 số chuẩn · Sẵn sàng</Text>
              </View>
            ) : pin.length === 4 ? (
              <View style={styles.statusBadgeInfo}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                <Text style={styles.statusTextInfo}>Mã 4 số cũ · Sẵn sàng</Text>
              </View>
            ) : pin.length > 0 ? (
              <Text style={styles.counterText}>Đã nhập {pin.length}/8 chữ số</Text>
            ) : (
              <Text style={styles.hintSubtext}>
                Hỗ trợ mã 8 số (hoặc 4 số cũ) từ chủ phòng
              </Text>
            )}
          </View>

          {/* Primary Action Button */}
          {isJoining ? (
            <View style={[styles.loadingBox, styles.startCallToAction]}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.loadingButtonText}>Đang kiểm tra mã…</Text>
            </View>
          ) : (
            <PrimaryButton
              title="Tham gia phòng"
              disabled={!isPinValid}
              onPress={() => onJoin(pin)}
              icon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
              style={[styles.startCallToAction, !isPinValid && styles.startDisabled]}
            />
          )}

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>HOẶC</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Secondary Action: Quét mã QR */}
          <PrimaryButton
            title="Quét mã QR"
            variant="secondary"
            icon={<Ionicons name="qr-code-outline" size={18} color={colors.primary} />}
            onPress={() => {
              void openScanner();
            }}
            disabled={isJoining}
          />

          {cameraDeniedPermanently ? (
            <PrimaryButton
              title="Mở cài đặt quyền camera"
              variant="secondary"
              icon={<Ionicons name="settings-outline" size={18} color={colors.text} />}
              onPress={() => {
                void Linking.openSettings().catch(() =>
                  setScanError('Không mở được cài đặt. Bạn vẫn có thể nhập PIN để tham gia.')
                );
              }}
              disabled={isJoining}
            />
          ) : null}
        </View>
      )}

      {/* Error Banners */}
      {scanError ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={styles.errorBannerText}>{scanError}</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Subtle Footer Hint */}
      {!isScannerOpen && !result ? (
        <Text style={styles.footerHint}>
          Mã PIN do chủ phòng cung cấp. Hỗ trợ mã 8 số và mã 4 số cũ.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },

  /* Top Navigation Row */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.inputSurface,
  },
  backButtonPressed: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderColor: Colors.light.primary,
  },
  backSpacer: {
    width: 44,
  },
  tagPill: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: {
    color: Colors.light.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* Title Section - Matching SoloSelectScreen */
  titleSection: {
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },

  /* Segmented Mode Selector - Identical structure to SoloSelectScreen */
  modeSelector: {
    flexDirection: 'row',
    gap: 3,
    minHeight: 44,
    padding: 3,
    borderRadius: 999,
    backgroundColor: Colors.light.backgroundElement,
  },
  modeOption: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modeOptionActive: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  modeIcon: {
    marginRight: 6,
  },
  modeText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeTextActive: {
    color: Colors.light.primary,
    fontWeight: '800',
  },

  /* Main Interactive Card */
  card: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
    backgroundColor: Colors.light.authFormSurface,
    gap: 16,
    shadowColor: Colors.light.glassShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.light.textSecondary,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  clearButtonPressed: {
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
  },
  clearButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },

  /* PIN Display & Slots */
  pinDisplayContainer: {
    position: 'relative',
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  digitGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  digitSlot: {
    width: 32,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.inputSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitSlotFilled: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.backgroundSelected,
  },
  digitSlotActive: {
    borderColor: Colors.light.primary,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  digitChar: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.light.border,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  digitCharFilled: {
    color: Colors.light.primary,
    fontWeight: '900',
  },
  digitSeparator: {
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separatorBar: {
    width: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.light.border,
  },

  /* Hidden native input overlay */
  realHiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.01,
    color: 'transparent',
  },

  /* Status Row */
  statusRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 22,
  },
  statusBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.successSurface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusTextSuccess: {
    color: Colors.light.success,
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadgeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.backgroundSelected,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusTextInfo: {
    color: Colors.light.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  counterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  hintSubtext: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },

  /* CTA Button - Matches Solo startCallToAction */
  startCallToAction: {
    height: 54,
    borderRadius: 22,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  startDisabled: {
    opacity: 0.5,
  },
  loadingBox: {
    backgroundColor: Colors.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Divider */
  divider: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.border,
  },
  dividerText: {
    color: Colors.light.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* Scanner Mode Card */
  scannerCard: {
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
    backgroundColor: Colors.light.authFormSurface,
    gap: 16,
    alignItems: 'center',
    shadowColor: Colors.light.glassShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },

  /* Joined Room Result View */
  resultCard: {
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
    backgroundColor: Colors.light.authFormSurface,
    alignItems: 'center',
    gap: 16,
    shadowColor: Colors.light.glassShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.successSurface,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  successBadgeText: {
    color: Colors.light.success,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pinDisplayBox: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: Colors.light.inputSurface,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 8,
  },
  pinBoxLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.light.textSecondary,
  },
  pinValue: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    color: Colors.light.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontVariant: ['tabular-nums'],
    letterSpacing: 4,
  },
  rosterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.backgroundSelected,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 2,
  },
  rosterText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(100, 116, 139, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  warningBannerText: {
    flex: 1,
    color: Colors.light.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },

  /* Error Banners */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(180, 35, 24, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(180, 35, 24, 0.2)',
  },
  errorBannerText: {
    flex: 1,
    color: Colors.light.error,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },

  /* Footer */
  footerHint: {
    color: Colors.light.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
});
