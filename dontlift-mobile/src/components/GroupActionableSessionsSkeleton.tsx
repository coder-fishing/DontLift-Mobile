import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Colors } from '../constants/theme';

const ROW_COUNT = 3;
const AVATAR_SLOT_WIDTH = 32 + 3 * (32 - 9);

export function GroupActionableSessionsSkeleton() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const skeletonColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.light.backgroundSelected, Colors.light.groupHomeSessionBorder],
  });
  const animatedSkeletonStyle = { backgroundColor: skeletonColor };

  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading sessions that need attention" style={styles.list}>
      {Array.from({ length: ROW_COUNT }, (_, index) => (
        <View key={index} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.row}>
          <View style={styles.rowContent}>
            <View style={styles.avatarSlot}>
              <Animated.View style={[styles.avatar, animatedSkeletonStyle]} />
            </View>
            <View style={styles.details}>
              <Animated.View style={[styles.title, animatedSkeletonStyle]} />
              <Animated.View style={[styles.subtitle, animatedSkeletonStyle, index === 1 && styles.shortSubtitle]} />
            </View>
            <Animated.View style={[styles.action, animatedSkeletonStyle]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { width: '100%', minHeight: 72, justifyContent: 'center', padding: 10, borderRadius: 18,
    backgroundColor: Colors.light.groupHomeSessionSurface, borderWidth: 1, borderColor: Colors.light.groupHomeSessionBorder },
  rowContent: { width: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarSlot: { width: AVATAR_SLOT_WIDTH, flexShrink: 0, alignItems: 'flex-start', justifyContent: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  details: { flex: 1, minWidth: 0, gap: 7 },
  title: { height: 13, width: '58%', borderRadius: 7 },
  subtitle: { height: 11, width: '88%', borderRadius: 6 },
  shortSubtitle: { width: '69%' },
  action: { width: 82, height: 13, borderRadius: 7 },
});
