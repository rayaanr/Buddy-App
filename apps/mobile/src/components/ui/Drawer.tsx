import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { project } from '@/lib/gestures';
import { colors } from '@/theme';
import { ease, spring } from '@/theme/motion';
import { ModalKeyboardScreen } from './Keyboard';
import { AnimatedView } from './Motion';

/** Opening and closing by a tap: iOS's sheet curve. */
const OPEN_MS = 320;
const CLOSE_MS = 260;
/** Let go heading past 40% of the drawer (a flick counts) and it closes. */
const DISMISS_FRACTION = 0.4;

interface DrawerProps {
  open: boolean;
  /** The person asked to close: tapped outside, dragged down, or pressed back. */
  onClose: () => void;
  /** Runs once the drawer has finished sliding away (e.g. navigate after it's gone). */
  onClosed?: () => void;
  children: ReactNode;
}

/**
 * Buddy's bottom drawer, the same on iPhone and Android: slides up, follows
 * your finger when dragged down, closes on a flick (carrying its speed) or a
 * tap outside, and always animates out. For lists you scroll or pick from
 * (who's going, a list of actions); confirmations and forms use Dialog.
 * Stays mounted until the exit animation finishes.
 */
export function Drawer({ open, onClose, onClosed, children }: DrawerProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const offscreen = useWindowDimensions().height;
  const height = useSharedValue(offscreen);
  const y = useSharedValue(offscreen); // 0 = fully open
  const dragStart = useSharedValue(0);
  // A flick down hands its speed to the closing animation (0: closed by a tap).
  const releaseVelocity = useSharedValue(0);
  // Content scrolls when the drawer is taller than the room it has (e.g. with
  // the keyboard up); dragging only moves the drawer once that's at the top.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const closed = useEffectEvent(() => {
    setMounted(false);
    onClosed?.();
  });

  useEffect(() => {
    if (!mounted) return;
    if (open) {
      y.set(withTiming(0, { duration: OPEN_MS, easing: ease.sheet }));
      return;
    }
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(closed);
    };
    const velocity = releaseVelocity.get();
    releaseVelocity.set(0);
    y.set(
      velocity
        ? // Dragged away: carry on at the finger's speed, never bouncing back up.
          withSpring(
            height.get(),
            { ...spring.sheet, dampingRatio: 1, overshootClamping: true, velocity },
            done,
          )
        : withTiming(height.get(), { duration: CLOSE_MS, easing: ease.sheet }, done),
    );
  }, [open, mounted, y, height, releaseVelocity]);

  // Drag down only (taps and horizontal swipes inside still work). Built
  // once: rebuilding a gesture mid-drag can drop it.
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .failOffsetX([-12, 12])
        .simultaneousWithExternalGesture(scrollGesture)
        .onStart(() => {
          dragStart.set(y.get());
        })
        .onUpdate((e) => {
          if (scrollY.get() > 0) {
            // Still scrolling the content: keep the drawer put, and pick up from
            // here once the content reaches its top.
            dragStart.set(y.get() - e.translationY);
            return;
          }
          y.set(Math.max(0, dragStart.get() + e.translationY));
        })
        .onEnd((e) => {
          if (y.get() + project(e.velocityY) > height.get() * DISMISS_FRACTION) {
            releaseVelocity.set(Math.max(0, e.velocityY));
            scheduleOnRN(onClose);
          } else {
            // Back up, with the finger's speed; clamped so no gap shows below.
            y.set(
              withSpring(0, { ...spring.sheet, overshootClamping: true, velocity: e.velocityY }),
            );
          }
        }),
    [scrollGesture, dragStart, y, scrollY, height, releaseVelocity, onClose],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [0, height.get()], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* Gestures inside a Modal need their own root on Android. */}
      <GestureHandlerRootView style={styles.fill}>
        <ModalKeyboardScreen style={[styles.end, { paddingTop: insets.top + 12 }]}>
          <AnimatedView style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
            <Pressable
              style={styles.fill}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
          </AnimatedView>
          <GestureDetector gesture={pan}>
            <AnimatedView
              style={[styles.shrink, sheetStyle]}
              onLayout={(e) => height.set(e.nativeEvent.layout.height)}
              accessibilityViewIsModal
            >
              <View className="shrink rounded-t-modal border-x border-t border-line bg-surface-sunken pt-2.5">
                <View className="mx-auto mb-[18px] h-[5px] w-10 rounded-[3px] bg-outline" />
                <GestureDetector gesture={scrollGesture}>
                  <Animated.ScrollView
                    style={styles.scroll}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                    overScrollMode="never"
                    showsVerticalScrollIndicator={false}
                  >
                    {children}
                  </Animated.ScrollView>
                </GestureDetector>
              </View>
            </AnimatedView>
          </GestureDetector>
        </ModalKeyboardScreen>
      </GestureHandlerRootView>
    </Modal>
  );
}

// Style objects, not classes: NativeWind doesn't style Reanimated views.
const styles = StyleSheet.create({
  fill: { flex: 1 },
  end: { flex: 1, justifyContent: 'flex-end' },
  // Never taller than the space above the keyboard (or below the status bar).
  shrink: { flexShrink: 1 },
  scroll: { flexGrow: 0 },
  backdrop: { backgroundColor: colors.scrim },
});
