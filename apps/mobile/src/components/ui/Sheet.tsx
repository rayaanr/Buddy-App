import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { KeyboardScreen } from './Keyboard';
import { AnimatedView } from './Motion';

/** vaul's curve and timing (the drawer behind shadcn/ui), so sheets move the same way. */
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const OPEN_MS = 500;
const CLOSE_MS = 400;
/** Let go past a quarter of the sheet, or flick down, and it closes. */
const DISMISS_FRACTION = 0.25;
const DISMISS_VELOCITY = 700;

interface SheetProps {
  open: boolean;
  /** The person asked to close: tapped outside, dragged down, or pressed back. */
  onClose: () => void;
  /** Runs once the sheet has finished sliding away (e.g. navigate after it's gone). */
  onClosed?: () => void;
  children: ReactNode;
}

/**
 * Bottom drawer that slides up, follows your finger when dragged down,
 * dismisses on a flick, and always animates out, like shadcn's Drawer.
 * Stays mounted until the exit animation finishes.
 */
export function Sheet({ open, onClose, onClosed, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const offscreen = Dimensions.get('window').height;
  const height = useSharedValue(offscreen);
  const y = useSharedValue(offscreen); // 0 = fully open
  const dragStart = useSharedValue(0);

  const closed = useEffectEvent(() => {
    setMounted(false);
    onClosed?.();
  });

  useEffect(() => {
    if (!mounted) return;
    if (open) {
      y.set(withTiming(0, { duration: OPEN_MS, easing: EASE }));
    } else {
      y.set(
        withTiming(height.get(), { duration: CLOSE_MS, easing: EASE }, (done) => {
          if (done) scheduleOnRN(closed);
        }),
      );
    }
  }, [open, mounted, y, height]);

  // Drag down only (taps and horizontal swipes inside still work).
  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-12, 12])
    .onStart(() => {
      dragStart.set(y.get());
    })
    .onUpdate((e) => {
      y.set(Math.max(0, dragStart.get() + e.translationY));
    })
    .onEnd((e) => {
      if (y.get() > height.get() * DISMISS_FRACTION || e.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(onClose);
      } else {
        y.set(withTiming(0, { duration: CLOSE_MS, easing: EASE }));
      }
    });

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
        <KeyboardScreen style={styles.end}>
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
              style={sheetStyle}
              onLayout={(e) => height.set(e.nativeEvent.layout.height)}
              accessibilityViewIsModal
            >
              <View
                className="rounded-t-[28px] bg-surface-sunken pt-2.5"
                style={{ paddingBottom: insets.bottom + 16 }}
              >
                <View className="mx-auto mb-[18px] h-[5px] w-10 rounded-[3px] bg-outline" />
                {children}
              </View>
            </AnimatedView>
          </GestureDetector>
        </KeyboardScreen>
      </GestureHandlerRootView>
    </Modal>
  );
}

// Style objects, not classes: NativeWind doesn't style Reanimated views.
const styles = StyleSheet.create({
  fill: { flex: 1 },
  end: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)' },
});
