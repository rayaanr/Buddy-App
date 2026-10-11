import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { selectionHaptic } from '@/components/ui';
import { spring } from '@/theme/motion';

const ITEM = 46;
/** Rows shown: the picked one in the middle, two either side. */
const VISIBLE = 5;

interface WheelProps {
  /** What each row shows, e.g. "07". */
  values: string[];
  index: number;
  onChange: (index: number) => void;
  /** Read by screen readers, e.g. "Hour". */
  label: string;
  width?: number;
}

/**
 * A scrolling picker column, like the phone's own time picker: drag or flick
 * and it settles on the nearest row; tap a row to jump to it.
 *
 * Built on a pan gesture rather than a ScrollView, so it rubber-bands at the
 * ends and settles exactly on a row.
 */
export function Wheel({ values, index, onChange, label, width = 92 }: WheelProps) {
  const last = values.length - 1;
  const offset = useSharedValue(-index * ITEM);
  const start = useSharedValue(0);

  // Taps and screen reader steps change `index` from outside: roll to it.
  // (After a drag the wheel is already heading there.)
  useEffect(() => {
    if (Math.round(-offset.get() / ITEM) !== index) {
      offset.set(withSpring(-index * ITEM, spring.snappy));
    }
  }, [index, offset]);

  const pan = Gesture.Pan()
    .activeOffsetY([-4, 4])
    .onStart(() => {
      start.set(offset.get());
    })
    .onUpdate((e) => {
      const next = start.get() + e.translationY;
      // A little give past either end.
      const min = -last * ITEM;
      offset.set(next > 0 ? next / 3 : next < min ? min + (next - min) / 3 : next);
    })
    .onEnd((e) => {
      // Where a flick would carry it, then the nearest row.
      const projected = offset.get() + e.velocityY * 0.12;
      const i = Math.min(last, Math.max(0, Math.round(-projected / ITEM)));
      offset.set(withSpring(-i * ITEM, { ...spring.settle, velocity: e.velocityY }));
      scheduleOnRN(onChange, i);
    });

  // A tap picks the row it lands on. Part of the same gesture system as the
  // drag, so letting go of a drag is never also a tap on the row underneath.
  const tap = Gesture.Tap()
    .maxDistance(8)
    .onEnd((e) => {
      const i = Math.round(-offset.get() / ITEM + (e.y - (ITEM * VISIBLE) / 2) / ITEM);
      if (i < 0 || i > last) return;
      offset.set(withSpring(-i * ITEM, spring.snappy));
      scheduleOnRN(onChange, i);
    });

  // A tick each time a new row passes the middle.
  useAnimatedReaction(
    () => Math.min(last, Math.max(0, Math.round(-offset.get() / ITEM))),
    (now, before) => {
      if (before !== null && now !== before) scheduleOnRN(selectionHaptic);
    },
  );

  const listStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: values[index] }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const i = index + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
          if (i >= 0 && i <= last) onChange(i);
        }}
        style={{ width, height: ITEM * VISIBLE, overflow: 'hidden' }}
      >
        {/* The band behind the picked row. */}
        <View
          className="absolute inset-x-0 rounded-2xl bg-surface"
          style={{ top: ITEM * 2, height: ITEM }}
        />
        <Animated.View style={[{ paddingVertical: ITEM * 2 }, listStyle]}>
          {values.map((v, i) => (
            <Row key={v} value={v} i={i} offset={offset} />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function Row({ value, i, offset }: { value: string; i: number; offset: SharedValue<number> }) {
  // Rows fade and shrink with distance from the middle.
  const style = useAnimatedStyle(() => {
    const away = Math.abs(i + offset.get() / ITEM);
    return {
      opacity: interpolate(away, [0, 1, 2.5], [1, 0.45, 0.12], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(away, [0, 1, 2.5], [1, 0.86, 0.72], Extrapolation.CLAMP) }],
    };
  });
  return (
    <View
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={{ height: ITEM }}
      className="items-center justify-center"
    >
      <Animated.View style={style}>
        <Text className="font-mono-medium text-[26px] text-ink">{value}</Text>
      </Animated.View>
    </View>
  );
}
