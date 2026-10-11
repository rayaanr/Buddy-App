import { Image } from 'expo-image';
import { useLayoutEffect, useMemo } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CloseIcon, IconButton } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { project, rubberband } from '@/lib/gestures';
import { spring } from '@/theme/motion';

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
/** Pulled down (or flung) this far, the photo closes. */
const CLOSE_AT = 140;

/**
 * A chat photo full screen, on black, like WhatsApp: pinch to zoom, drag
 * around while zoomed, double-tap to zoom in or back out, and swipe down
 * to close (the black fades as it goes).
 */
export function PhotoViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  const { top } = useScreenInsets();
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  // Where each gesture started, so a second pinch or drag carries on from there.
  const fromScale = useSharedValue(1);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  // Pulling down to close (only when not zoomed in).
  const drop = useSharedValue(0);

  // Each photo opens as it is.
  useLayoutEffect(() => {
    scale.set(1);
    x.set(0);
    y.set(0);
    drop.set(0);
  }, [url, scale, x, y, drop]);

  const gestures = useMemo(() => {
    /** How far the zoomed photo can move before its edge leaves the screen's. */
    const bound = (s: number, size: number) => {
      'worklet';
      return Math.max(0, ((s - 1) * size) / 2);
    };
    const home = () => {
      'worklet';
      scale.set(withSpring(1, spring.snapBack));
      x.set(withSpring(0, spring.snapBack));
      y.set(withSpring(0, spring.snapBack));
    };

    const pinch = Gesture.Pinch()
      .onStart(() => {
        fromScale.set(scale.get());
      })
      .onUpdate((e) => {
        const next = fromScale.get() * e.scale;
        // Past the limits it resists rather than stopping dead.
        scale.set(
          next < 1
            ? 1 + rubberband(next - 1, 1)
            : next > MAX_ZOOM
              ? MAX_ZOOM + rubberband(next - MAX_ZOOM, MAX_ZOOM)
              : next,
        );
      })
      .onEnd(() => {
        if (scale.get() <= 1) home();
        else if (scale.get() > MAX_ZOOM) scale.set(withSpring(MAX_ZOOM, spring.snapBack));
      });

    const pan = Gesture.Pan()
      .averageTouches(true)
      .onStart(() => {
        fromX.set(x.get());
        fromY.set(y.get());
      })
      .onUpdate((e) => {
        if (scale.get() > 1) {
          x.set(fromX.get() + e.translationX);
          y.set(fromY.get() + e.translationY);
        } else {
          drop.set(Math.max(0, e.translationY));
        }
      })
      .onEnd((e) => {
        if (scale.get() > 1) {
          // Zoomed in: glide on and stop at the photo's edges.
          const bx = bound(scale.get(), width);
          const by = bound(scale.get(), height);
          x.set(withDecay({ velocity: e.velocityX, clamp: [-bx, bx] }));
          y.set(withDecay({ velocity: e.velocityY, clamp: [-by, by] }));
          return;
        }
        if (drop.get() + project(e.velocityY) > CLOSE_AT) {
          drop.set(
            withSpring(
              height,
              { ...spring.sheet, dampingRatio: 1, overshootClamping: true, velocity: e.velocityY },
              (done) => {
                if (done) scheduleOnRN(onClose);
              },
            ),
          );
        } else {
          drop.set(withSpring(0, { ...spring.snapBack, velocity: e.velocityY }));
        }
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((e) => {
        if (scale.get() > 1) return home();
        // Zoom in on the spot that was tapped.
        const s = DOUBLE_TAP_ZOOM;
        const bx = bound(s, width);
        const by = bound(s, height);
        scale.set(withSpring(s, spring.snapBack));
        x.set(
          withSpring(Math.min(bx, Math.max(-bx, (width / 2 - e.x) * (s - 1))), spring.snapBack),
        );
        y.set(
          withSpring(Math.min(by, Math.max(-by, (height / 2 - e.y) * (s - 1))), spring.snapBack),
        );
      });

    return Gesture.Simultaneous(pinch, pan, doubleTap);
  }, [scale, x, y, fromScale, fromX, fromY, drop, width, height, onClose]);

  const photoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() + drop.get() },
      { scale: scale.get() * interpolate(drop.get(), [0, height], [1, 0.85], 'clamp') },
    ],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drop.get(), [0, CLOSE_AT * 2], [1, 0], 'clamp'),
  }));

  return (
    <Modal
      visible={!!url}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Gestures inside a Modal need their own root on Android. */}
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={gestures}>
          <Animated.View style={[styles.fill, photoStyle]}>
            {url ? (
              <Image
                source={{ uri: url }}
                style={styles.fill}
                contentFit="contain"
                transition={150}
                accessibilityIgnoresInvertColors
              />
            ) : null}
          </Animated.View>
        </GestureDetector>
        <View style={[styles.close, { top: top(56) }]}>
          <IconButton tone="glass" icon={<CloseIcon />} label="Close photo" onPress={onClose} />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { backgroundColor: '#000' },
  close: { position: 'absolute', right: 18 },
});
