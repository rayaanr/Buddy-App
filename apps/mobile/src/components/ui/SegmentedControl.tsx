import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import { colors, CONTROL_FONT_SCALE } from '@/theme';
import { spring } from '@/theme/motion';
import { AnimatedView, selectionHaptic } from './Motion';

interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

const PAD = 4;
const GAP = 4;

/** Two or more options with a highlight that slides to the selected one. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    segments.findIndex((s) => s.value === value),
  );
  const segmentWidth = width
    ? (width - PAD * 2 - GAP * (segments.length - 1)) / segments.length
    : 0;

  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!segmentWidth) return;
    const target = index * (segmentWidth + GAP);
    // Start in place; only later changes slide.
    x.set(placed.current ? withSpring(target, spring.settle) : target);
    placed.current = true;
  }, [index, segmentWidth, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className={cn('flex-row gap-1 rounded-2xl bg-surface p-1', className)}
    >
      {segmentWidth ? (
        <AnimatedView
          pointerEvents="none"
          style={[styles.indicator, { left: PAD, top: PAD, width: segmentWidth }, indicator]}
        />
      ) : null}
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <Pressable
            key={s.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              selectionHaptic();
              onChange(s.value);
            }}
            className="h-[42px] flex-1 items-center justify-center rounded-xl"
          >
            <Text
              maxFontSizeMultiplier={CONTROL_FONT_SCALE}
              className={cn('font-sans-semibold text-subhead', active ? 'text-ink' : 'text-muted')}
            >
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Style objects, not classes: NativeWind doesn't style Reanimated views.
const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.disabled,
  },
});
