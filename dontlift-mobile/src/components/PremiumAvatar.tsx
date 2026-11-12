import React, { useState } from 'react';
import { StyleSheet, Text, View, useColorScheme, type ImageStyle, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '../constants/theme';
import { usePremiumAvatarActive } from '../features/premium/use-premium-avatar';

type Props = {
  displayName: string;
  imageUri?: string | null;
  premiumExpiresAtUtcMs?: number | null;
  initials: string;
  size: number;
  backgroundColor: string;
  fallbackColor: string;
  borderColor?: string;
  borderWidth?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  recyclingKey?: string;
};

export function PremiumAvatar({ displayName, imageUri, premiumExpiresAtUtcMs, initials, size, backgroundColor,
  fallbackColor, borderColor = 'transparent', borderWidth = 2, style, imageStyle, textStyle,
  accessibilityLabel, recyclingKey }: Props) {
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  const isPremium = usePremiumAvatarActive(premiumExpiresAtUtcMs);
  const premiumBorderColor = useColorScheme() === 'dark' ? Colors.dark.premiumAvatarBorder : Colors.light.premiumAvatarBorder;
  const label = accessibilityLabel ?? `${displayName || 'Participant'} avatar`;
  return (
    <View style={[styles.frame, style, { width: size, height: size, borderRadius: size / 2, backgroundColor,
      borderWidth, borderColor: isPremium ? premiumBorderColor : borderColor }]}>
      {imageUri && failedImageUri !== imageUri ? (
        <Image source={{ uri: imageUri }} contentFit="cover" recyclingKey={recyclingKey ?? imageUri}
          style={[styles.image, imageStyle]} onError={() => setFailedImageUri(imageUri)} accessibilityLabel={label} />
      ) : (
        <Text style={[styles.initials, { color: fallbackColor }, textStyle]} numberOfLines={1}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%', borderRadius: 999 },
  initials: { fontWeight: '800' },
});
