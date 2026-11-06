import React, { useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { ScreenId } from '../types';
import { SCREEN_TITLES } from '../constants';
import { Colors } from '../constants/theme';

interface HeaderProps {
  currentScreen: ScreenId;
  displayName: string;
  email: string;
  avatarUri?: string;
  onNavigate: (screen: ScreenId) => void;
  onOpenSettings: () => void;
  colors?: typeof Colors.light | typeof Colors.dark;
}

function getInitials(displayName: string, email: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || email.slice(0, 1) || 'D').toUpperCase();
}

function getFirstName(displayName: string, email: string): string {
  return displayName.trim().split(/\s+/).filter(Boolean)[0] || email.split('@')[0] || 'there';
}

function AccountAvatar({
  initials,
  imageUri,
  size,
  colors,
  style,
}: {
  initials: string;
  imageUri?: string;
  size: number;
  colors?: typeof Colors.light | typeof Colors.dark;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.avatarFrame, { width: size, height: size, borderRadius: size / 2 }, colors ? { backgroundColor: colors.roomMemberAvatar } : null, style]}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} contentFit="cover" style={styles.avatarImage} />
      ) : (
        <Text style={[styles.avatarText, colors ? { color: colors.roomMemberAccent } : null]}>{initials}</Text>
      )}
    </View>
  );
}

export function Header({ currentScreen, displayName, email, avatarUri, onNavigate, onOpenSettings, colors }: HeaderProps) {
  const palette = colors ?? Colors.light;
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [menuHeight, setMenuHeight] = useState(0);
  const avatarRef = useRef<React.ElementRef<typeof View>>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const headerSurface = colors
    ? useLiquidGlass ? [styles.nativeGlass, { borderColor: palette.glassBorder }] : { backgroundColor: palette.glassSurface, borderColor: palette.glassBorder }
    : useLiquidGlass ? styles.nativeGlass : styles.fallbackGlass;

  const openDestination = (screen: ScreenId) => {
    setMenuVisible(false);
    onNavigate(screen);
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.headerContainer, headerSurface]}>
        {useLiquidGlass ? <GlassView pointerEvents="none" glassEffectStyle="regular" style={styles.glassLayer} /> : null}
        <View style={styles.brandGroup}>
          <Pressable
            ref={avatarRef}
            accessibilityRole="button"
            accessibilityLabel={`Open account menu for ${displayName || email}`}
            accessibilityState={{ expanded: menuVisible }}
            onPress={() => avatarRef.current?.measureInWindow((x, y, width, height) => {
              setMenuAnchor({ top: y + height + 8, left: Math.max(16, x) });
              setMenuVisible(true);
            })}
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
          >
            <AccountAvatar initials={getInitials(displayName, email)} imageUri={avatarUri} size={40} colors={colors} />
          </Pressable>
          <View style={styles.brandInfo}>
            <Text style={[styles.brandTitle, { color: palette.text }]} numberOfLines={1}>Hello, {getFirstName(displayName, email)}</Text>
            <Text style={[styles.brandSubtitle, { color: palette.textSecondary }]} numberOfLines={1}>{SCREEN_TITLES[currentScreen]}</Text>
          </View>
        </View>
      </View>

      <Modal transparent visible={menuVisible} animationType="fade" presentationStyle="overFullScreen" statusBarTranslucent onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close account menu" style={[styles.dismissArea, colors ? { backgroundColor: colors === Colors.dark ? 'rgba(0,0,0,0.4)' : 'rgba(15,23,42,0.12)' } : null]} onPress={() => setMenuVisible(false)} />
          <View onLayout={event => setMenuHeight(event.nativeEvent.layout.height)} style={[styles.menu, colors ? { backgroundColor: palette.glassSurface, shadowColor: palette.glassShadow } : null, { top: Math.min(menuAnchor?.top ?? 80, windowHeight - menuHeight - 12), left: menuAnchor?.left ?? 16, width: Math.min(270, windowWidth - 32) }]}>
            <View style={styles.menuIdentity}>
              <AccountAvatar initials={getInitials(displayName, email)} imageUri={avatarUri} size={42} colors={colors} style={colors ? { borderColor: colors.glassBorder } : undefined} />
              <View style={styles.menuIdentityText}>
                <Text numberOfLines={1} style={[styles.menuName, { color: palette.text }]}>{displayName || 'DontLift user'}</Text>
                <Text numberOfLines={1} style={[styles.menuEmail, { color: palette.textSecondary }]}>{email}</Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
            <View style={styles.menuActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => openDestination('16-profile')} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: palette.backgroundSelected }]}>
                <View style={styles.menuItemMain}>
                  <Ionicons name="person-outline" size={20} color={palette.textSecondary} />
                  <Text style={[styles.menuItemText, { color: palette.text }]}>Profile</Text>
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => { setMenuVisible(false); onOpenSettings(); }} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: palette.backgroundSelected }]}>
                <View style={styles.menuItemMain}>
                  <Ionicons name="settings-outline" size={20} color={palette.textSecondary} />
                  <Text style={[styles.menuItemText, { color: palette.text }]}>Settings</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 10, paddingHorizontal: 18, paddingTop: 6 },
  headerContainer: { position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 24, borderWidth: 1 },
  glassLayer: { ...StyleSheet.absoluteFill, borderRadius: 24 },
  nativeGlass: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.48)' },
  fallbackGlass: { backgroundColor: 'rgba(255,255,255,0.68)', borderColor: 'rgba(255,255,255,0.78)' },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  brandInfo: { flex: 1, minWidth: 0 },
  brandTitle: { fontSize: 15, fontWeight: '800', color: Colors.light.text },
  brandSubtitle: { fontSize: 11, fontWeight: '600', color: Colors.light.textSecondary, marginTop: 2 },
  avatarButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarFrame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#DBEAFE' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 999 },
  avatarText: { color: '#1D4ED8', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.75 },
  modalRoot: { flex: 1 },
  dismissArea: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.12)' },
  menu: { position: 'absolute', width: 270, borderRadius: 22, padding: 10, backgroundColor: Colors.light.glassSurface, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 },
  menuIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8 },
  menuAvatar: { borderColor: '#BFDBFE' },
  menuIdentityText: { flex: 1 },
  menuName: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  menuEmail: { color: '#64748B', fontSize: 12, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E2E8F0', marginVertical: 4 },
  menuActions: { gap: 8, paddingVertical: 4 },
  menuItem: { minHeight: 52, width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderRadius: 14 },
  menuItemMain: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuItemPressed: { backgroundColor: '#EFF6FF' },
  menuItemText: { flex: 1, color: '#0F172A', fontSize: 14, fontWeight: '700' },
});
