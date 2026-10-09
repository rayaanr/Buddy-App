import { useEffect, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  type KeyboardAvoidingViewProps,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';

/**
 * Root for any screen with a text field: makes room for the keyboard on
 * both platforms.
 *
 * Android apps are edge-to-edge (always, since Expo SDK 54), so the system no
 * longer shrinks the window when the keyboard opens. Without this, Android
 * leaves inputs behind the keyboard. Padding is measured against the
 * keyboard's actual position, so it never doubles up if the window does
 * resize.
 */
export function KeyboardScreen(props: Omit<KeyboardAvoidingViewProps, 'behavior'>) {
  return <KeyboardAvoidingView behavior="padding" {...props} />;
}

/** Space kept between the focused field and whatever covers the bottom edge. */
const GAP = 24;

/**
 * A ScrollView for forms: once the keyboard is open and the screen has made
 * room for it, scrolls the focused field into view if it ended up below the
 * visible area (behind the keyboard or a footer).
 */
export function KeyboardAwareScrollView({ onScroll, onLayout, ...props }: ScrollViewProps) {
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);

  const revealFocusedInput = () => {
    // Browsers handle the on-screen keyboard themselves (and lack these APIs).
    if (Platform.OS === 'web') return;
    const input = TextInput.State.currentlyFocusedInput();
    const view = scroll.current;
    const node = view?.getNativeScrollRef();
    if (!input || !view || !node || !Keyboard.isVisible()) return;
    node.measureInWindow((_vx, viewY, _vw, viewHeight) => {
      input.measureInWindow((_x, y, _w, height) => {
        const visibleBottom = Math.min(
          viewY + viewHeight,
          Keyboard.metrics()?.screenY ?? Number.POSITIVE_INFINITY,
        );
        const hidden = y + height + GAP - visibleBottom;
        if (hidden > 0) view.scrollTo({ y: offset.current + hidden, animated: true });
      });
    });
  };

  // The keyboard opening usually shrinks this view (via KeyboardScreen), which
  // triggers onLayout below; this covers screens where nothing resizes.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => setTimeout(revealFocusedInput, 50));
    return () => sub.remove();
  });

  return (
    <ScrollView
      ref={scroll}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      {...props}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offset.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
      onLayout={(e: LayoutChangeEvent) => {
        revealFocusedInput();
        onLayout?.(e);
      }}
    />
  );
}
