import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../constants/theme';
import { formatTime } from '../constants';

const SIZE = 220;
const STROKE_WIDTH = 8;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface SoloTimerDialProps {
  mode: 'COUNTDOWN' | 'STOPWATCH';
  selectedDuration: number;
  secondsLeft: number;
  isViolationActive: boolean;
}

export function SoloTimerDial({
  mode,
  selectedDuration,
  secondsLeft,
  isViolationActive,
}: SoloTimerDialProps) {
  const totalSeconds = selectedDuration * 60;
  const progress = mode === 'COUNTDOWN' && totalSeconds > 0
    ? Math.max(0, Math.min(1, secondsLeft / totalSeconds))
    : 1;
  const progressValue = useSharedValue(progress);

  useEffect(() => {
    progressValue.set(withTiming(progress, {
      duration: 900,
      easing: Easing.linear,
    }));
  }, [progress, progressValue]);

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progressValue.get()),
  }));
  const progressColor = isViolationActive ? '#EF4444' : Colors.light.primary;
  const intervalLabel = mode === 'COUNTDOWN'
    ? `${formatTime(totalSeconds)} FOCUS SESSION`
    : 'OPEN-ENDED SOLO SESSION';

  return (
    <View
      accessible
      accessibilityLabel={`${formatTime(secondsLeft)} ${mode === 'COUNTDOWN' ? 'remaining' : 'elapsed'}`}
      style={styles.container}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={StyleSheet.absoluteFill}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="rgba(255,255,255,0.85)"
          stroke="#D9E2F1"
          strokeWidth={STROKE_WIDTH}
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={progressColor}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE},${CIRCUMFERENCE}`}
          animatedProps={animatedCircleProps}
          rotation={-90}
          originX={SIZE / 2}
          originY={SIZE / 2}
        />
      </Svg>
      <View style={styles.readout}>
        <Text style={styles.timerNumber}>{formatTime(secondsLeft)}</Text>
        <Text style={styles.intervalSub}>{intervalLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  readout: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerNumber: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  intervalSub: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
});
