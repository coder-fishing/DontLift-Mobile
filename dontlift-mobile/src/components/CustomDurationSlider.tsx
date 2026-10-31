
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "../constants/theme";
import {
  COUNTDOWN_DURATION_STEP_MINUTES,
  MAX_COUNTDOWN_DURATION_MINUTES,
  MIN_COUNTDOWN_DURATION_MINUTES,
} from "../features/solo/session-controller";
import { GlassCard } from "./GlassCard";

interface CustomDurationSliderProps {
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
}

const THUMB_SIZE = 18;
const TRACK_HEIGHT = 5;

const MIN = MIN_COUNTDOWN_DURATION_MINUTES;
const MAX = MAX_COUNTDOWN_DURATION_MINUTES;
const STEP = COUNTDOWN_DURATION_STEP_MINUTES;
const RANGE = MAX - MIN;

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const snapValue = (minutes: number) =>
  clamp(
    MIN + Math.round((minutes - MIN) / STEP) * STEP,
    MIN,
    MAX,
  );

const formatDuration = (totalMinutes: number) => {
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;

  return `${hours} hr ${minutes} min`;
};

export function CustomDurationSlider({
  value,
  onChange,
  disabled = false,
}: CustomDurationSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [displayValue, setDisplayValue] = useState(value);

  const trackWidthRef = useRef(0);
  const displayValueRef = useRef(value);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);

  valueRef.current = value;
  onChangeRef.current = onChange;
  disabledRef.current = disabled;

  const draggingRef = useRef(false);
  const startValueRef = useRef(value);
  const lastSnappedRef = useRef(value);

  useEffect(() => {
    if (!draggingRef.current) {
      displayValueRef.current = value;
      setDisplayValue(value);
    }
  }, [value]);

  const updateDisplay = useCallback((next: number) => {
    const clamped = clamp(next, MIN, MAX);
    displayValueRef.current = clamped;
    setDisplayValue(clamped);

    // Update parent only when reaching a new 5-minute step.
    const snapped = snapValue(clamped);

    if (snapped !== lastSnappedRef.current) {
      lastSnappedRef.current = snapped;
      onChangeRef.current(snapped);
    }
  }, []);

  const positionToValue = useCallback((x: number) => {
    const width = trackWidthRef.current;
    const usableWidth = Math.max(1, width - THUMB_SIZE);

    const position = clamp(
      x - THUMB_SIZE / 2,
      0,
      usableWidth,
    );

    return MIN + (position / usableWidth) * RANGE;
  }, []);

  const finishDrag = useCallback(() => {
    if (!draggingRef.current) return;

    draggingRef.current = false;

    const snapped = snapValue(displayValueRef.current);
    displayValueRef.current = snapped;
    setDisplayValue(snapped);

    lastSnappedRef.current = snapped;
    onChangeRef.current(snapped);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          !disabledRef.current,

        onMoveShouldSetPanResponder: () =>
          !disabledRef.current,

        onPanResponderGrant: (event) => {
          if (disabledRef.current) return;

          draggingRef.current = true;
          startValueRef.current = displayValueRef.current;

          updateDisplay(
            positionToValue(event.nativeEvent.locationX),
          );
        },

        onPanResponderMove: (_event, gesture) => {
          if (disabledRef.current) return;

          const usableWidth = Math.max(
            1,
            trackWidthRef.current - THUMB_SIZE,
          );

          const deltaValue =
            (gesture.dx / usableWidth) * RANGE;

          updateDisplay(startValueRef.current + deltaValue);
        },

        onPanResponderRelease: finishDrag,

        onPanResponderTerminate: finishDrag,

        onPanResponderTerminationRequest: () => false,
      }),
    [finishDrag, positionToValue, updateDisplay],
  );

  const progress = clamp(
    (displayValue - MIN) / RANGE,
    0,
    1,
  );

  const usableWidth = Math.max(
    0,
    trackWidth - THUMB_SIZE,
  );

  const thumbLeft = progress * usableWidth;
  const fillWidth = thumbLeft + THUMB_SIZE / 2;

  const handleAccessibilityAction = useCallback(
    (actionName: string) => {
      if (disabled) return;

      const delta =
        actionName === "increment" ? STEP : -STEP;

      const next = snapValue(valueRef.current + delta);

      displayValueRef.current = next;
      lastSnappedRef.current = next;
      setDisplayValue(next);
      onChangeRef.current(next);
    },
    [disabled],
  );

  return (
    <GlassCard style={styles.card}>
      <View style={styles.valueRow}>
        <Text style={styles.label}>
          Drag to adjust
        </Text>

        <Text
          style={styles.value}
          accessibilityLiveRegion="polite"
        >
          {formatDuration(displayValue)}
        </Text>
      </View>

      <View
        style={[
          styles.sliderArea,
          disabled && styles.disabled,
        ]}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          trackWidthRef.current = width;
          setTrackWidth(width);
        }}
        accessibilityRole="adjustable"
        accessibilityLabel="Custom focus duration"
        accessibilityState={{ disabled }}
        accessibilityValue={{
          min: MIN,
          max: MAX,
          now: snapValue(displayValue),
          text: formatDuration(displayValue),
        }}
        accessibilityActions={[
          { name: "increment", label: "Increase duration" },
          { name: "decrement", label: "Decrease duration" },
        ]}
        onAccessibilityAction={(event) =>
          handleAccessibilityAction(
            event.nativeEvent.actionName,
          )
        }
        {...panResponder.panHandlers}
      >
        <View pointerEvents="none" style={styles.track}>
          <View
            style={[
              styles.trackFill,
              { width: fillWidth },
            ]}
          />
        </View>

        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            { left: thumbLeft },
          ]}
        />
      </View>

      <View style={styles.rangeLabels}>
        <Text style={styles.rangeLabel}>
          {formatDuration(MIN)}
        </Text>

        <Text style={styles.rangeLabel}>
          {formatDuration(MAX)}
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 0,
  },

  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
  },

  label: {
    color: Colors.light.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },

  value: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  sliderArea: {
    height: 26,
    justifyContent: "center",
    position: "relative",
  },

  track: {
    height: TRACK_HEIGHT,
    marginHorizontal: THUMB_SIZE / 2,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: Colors.light.border,
    overflow: "hidden",
  },

  trackFill: {
    height: "100%",
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: Colors.light.primary,
  },

  thumb: {
    position: "absolute",
    top: (26 - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2.5,
    borderColor: Colors.light.background,
    backgroundColor: Colors.light.primary,
    elevation: 2,
  },

  rangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -2,
  },

  rangeLabel: {
    color: Colors.light.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },

  disabled: {
    opacity: 0.45,
  },
});

