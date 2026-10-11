import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { colors } from '@/theme';
import { ease } from '@/theme/motion';
import { ModalKeyboardScreen } from './Keyboard';
import { AnimatedView } from './Motion';

const OPEN_MS = 180;
const CLOSE_MS = 140;

interface DialogProps {
  open: boolean;
  /** The person asked to close: tapped outside or pressed back. */
  onClose: () => void;
  /** Runs once the dialog has finished fading away (e.g. navigate after it's gone). */
  onClosed?: () => void;
  /**
   * Where the card sits. `top` for dialogs whose content grows as you type
   * (search results), so the field under your finger doesn't move.
   */
  position?: 'center' | 'top';
  children: ReactNode;
}

/**
 * Buddy's popup: a card over the dimmed screen, the same on iPhone and
 * Android. Grows in from just under full size, fades out, and stays mounted
 * until it's gone. Taller content scrolls inside the card.
 */
export function Dialog({ open, onClose, onClosed, position = 'center', children }: DialogProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const shown = useSharedValue(0); // 0 hidden, 1 open
  const closed = useEffectEvent(() => {
    setMounted(false);
    onClosed?.();
  });
  useEffect(() => {
    if (!mounted) return;
    if (open) {
      shown.set(withTiming(1, { duration: OPEN_MS, easing: ease.out }));
      return;
    }
    shown.set(
      withTiming(0, { duration: CLOSE_MS, easing: ease.out }, (done) => {
        if (done) scheduleOnRN(closed);
      }),
    );
  }, [open, mounted, shown]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: shown.get() }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ scale: 0.95 + 0.05 * shown.get() }],
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
      {/* Gestures inside a Modal (e.g. the time wheels) need their own root on Android. */}
      <GestureHandlerRootView style={styles.fill}>
        <ModalKeyboardScreen
          style={[
            styles.fill,
            position === 'top' ? styles.top : styles.center,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <AnimatedView style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
            <Pressable
              style={styles.fill}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
          </AnimatedView>
          <AnimatedView style={[styles.card, cardStyle]} accessibilityViewIsModal>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </AnimatedView>
        </ModalKeyboardScreen>
      </GestureHandlerRootView>
    </Modal>
  );
}

// Style objects, not classes: NativeWind doesn't style Reanimated views.
const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { justifyContent: 'center', paddingHorizontal: 16 },
  top: { justifyContent: 'flex-start', paddingHorizontal: 16 },
  backdrop: { backgroundColor: colors.scrim },
  // Never taller than the room it has; content scrolls inside.
  card: {
    flexShrink: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors['surface-sunken'],
    overflow: 'hidden',
  },
  scroll: { flexGrow: 0 },
  content: { paddingTop: 20, paddingBottom: 20 },
});
