import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import { colors } from '@/theme';
import { spring } from '@/theme/motion';

export const AnimatedView = Animated.View;

type Haptic = 'light' | 'selection';

/** How far a surface sinks while held. Literal classes, so Tailwind generates them. */
const PRESS = {
  /** Cards and rows: dim slightly, never move. */
  dim: 'active:opacity-90',
  normal: 'active:scale-[0.97]',
  strong: 'active:scale-[0.92]',
} as const;

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** dim for cards and rows (no movement), normal for buttons, strong for small round buttons. */
  scale?: keyof typeof PRESS;
  haptic?: Haptic;
}

const playHaptic = (kind: Haptic) => {
  if (Platform.OS === 'web') return;
  if (kind === 'selection') void Haptics.selectionAsync();
  else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Pressable that sinks slightly under your finger: the app's standard touch
 * feedback. It's a plain Pressable with NativeWind's `active:` classes, so
 * `className` styles it like any other view.
 *
 * No `transition-*` classes: NativeWind animates those by writing Reanimated
 * shared values during render, which Reanimated 4 warns about on every press.
 */
export function PressableScale({
  scale = 'normal',
  haptic,
  onPress,
  className,
  ...rest
}: PressableScaleProps) {
  return (
    <Pressable
      className={cn(PRESS[scale], className)}
      onPress={(e) => {
        if (haptic) playHaptic(haptic);
        onPress?.(e);
      }}
      {...rest}
    />
  );
}

/** Light haptic tick for selection changes (chips, tabs, segments). */
export const selectionHaptic = () => playHaptic('selection');

/** Success buzz for moments like joining an activity. */
export const successHaptic = () => {
  if (Platform.OS !== 'web') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
};

/**
 * Grey placeholder block that gently pulses while content loads, so screens
 * keep their shape instead of jumping when data arrives.
 */
export function Skeleton({ className, testID }: { className?: string; testID?: string }) {
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    opacity.set(
      withRepeat(
        withSequence(withTiming(1, { duration: 700 }), withTiming(0.55, { duration: 700 })),
        -1,
      ),
    );
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  // Classes size and shape a plain View; the pulsing fill is a style-only
  // Reanimated view, since NativeWind doesn't style Reanimated components.
  return (
    <View
      className={cn('overflow-hidden rounded-xl', className)}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AnimatedView style={[StyleSheet.absoluteFill, styles.fill, animated]} />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { backgroundColor: colors['surface-raised'] } });

/**
 * Replays a short entrance on the same element whenever `trigger` changes
 * (not on first render): "rise" for text like counts and statuses, "pop"
 * for buttons. Animates style only, so layout is never disturbed (unlike
 * remounting with a new key and an `entering` animation).
 */
export function useEnterOnChange(trigger: unknown, kind: 'rise' | 'pop' = 'rise') {
  const progress = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    progress.set(
      withSequence(
        withTiming(0, { duration: 0 }),
        withSpring(1, kind === 'pop' ? spring.bouncy : spring.gentle),
      ),
    );
  }, [trigger, kind, progress]);
  return useAnimatedStyle(() => {
    const p = progress.get();
    return kind === 'pop'
      ? { opacity: Math.min(1, 0.4 + p), transform: [{ scale: 0.92 + 0.08 * p }] }
      : { opacity: p, transform: [{ translateY: (1 - p) * 6 }] };
  });
}
