import * as Haptics from 'expo-haptics';
import { cssInterop } from 'nativewind';
import { useEffect, useRef, type ComponentProps } from 'react';
import {
  Platform,
  Pressable,
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
import { PRESS_SCALE, spring } from '@/theme/motion';

/**
 * Reanimated components that also take NativeWind `className`, so a view can
 * be styled with classes and animated (style, entering, layout) at once.
 */
export const AnimatedView = Animated.createAnimatedComponent(View);
cssInterop(AnimatedView, { className: 'style' });

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
cssInterop(AnimatedPressable, { className: 'style' });

export type AnimatedViewProps = ComponentProps<typeof AnimatedView> & { className?: string };

type Haptic = 'light' | 'selection';

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks while held; 1 turns the effect off. */
  scaleTo?: number;
  haptic?: Haptic;
}

const playHaptic = (kind: Haptic) => {
  if (Platform.OS === 'web') return;
  if (kind === 'selection') void Haptics.selectionAsync();
  else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Pressable that sinks slightly under your finger and springs back: the
 * app's standard touch feedback. Runs on the UI thread, so it stays smooth
 * while JavaScript is busy.
 */
export function PressableScale({
  scaleTo = PRESS_SCALE,
  haptic,
  onPressIn,
  onPressOut,
  onPress,
  style,
  disabled,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, spring.snappy));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, spring.snappy));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) playHaptic(haptic);
        onPress?.(e);
      }}
      style={[style, animated]}
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
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
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
  return (
    <AnimatedView
      className={cn('rounded-xl bg-surface-raised', className)}
      style={[style, animated]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** A screen's worth of placeholders, announced once to screen readers. */
export function SkeletonList({
  count = 3,
  children,
}: {
  count?: number;
  children: (index: number) => React.ReactNode;
}) {
  return (
    <View accessibilityLabel="Loading" accessible className="gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <View key={i}>{children(i)}</View>
      ))}
    </View>
  );
}

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
