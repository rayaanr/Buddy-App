import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView as NativeKeyboardAvoidingView,
  type ScrollViewProps,
} from 'react-native';
import { cssInterop } from 'nativewind';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView as LibraryScrollView,
  KeyboardStickyView,
  type KeyboardAvoidingViewProps,
} from 'react-native-keyboard-controller';

/**
 * Keyboard handling, from react-native-keyboard-controller (Android apps are
 * edge-to-edge, so the system no longer makes room for the keyboard itself).
 *
 * Two layouts:
 * - A screen whose content doesn't scroll (sign in, the code screen, chat):
 *   `KeyboardScreen` lifts everything above the keyboard.
 * - A form (`KeyboardAwareScrollView`, usually with a `Footer`): the form
 *   scrolls the focused field into view and the footer rides on the keyboard.
 *   Lifting the whole screen as well would leave the space twice, so the
 *   screen stops doing it as soon as a form is inside.
 */
interface KeyboardLayout {
  /** A form registered itself: the screen stops lifting its content. */
  setHasForm: (has: boolean) => void;
  hasForm: boolean;
  /** The footer's height, so the focused field stays above it too. */
  footerHeight: number;
  setFooterHeight: (height: number) => void;
}
const KeyboardLayoutContext = createContext<KeyboardLayout | null>(null);

// NativeWind only turns `className` into styles for components it knows.
cssInterop(KeyboardAvoidingView, { className: 'style' });
cssInterop(LibraryScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

/** Space kept between the focused field and whatever covers the bottom edge. */
const GAP = 24;

/** Root for any screen with a text field. */
export function KeyboardScreen({
  children,
  ...props
}: Omit<KeyboardAvoidingViewProps, 'behavior'> & { children: ReactNode }) {
  const [hasForm, setHasForm] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  return (
    <KeyboardLayoutContext value={{ hasForm, setHasForm, footerHeight, setFooterHeight }}>
      <KeyboardAvoidingView behavior="padding" enabled={!hasForm} {...props}>
        {children}
      </KeyboardAvoidingView>
    </KeyboardLayoutContext>
  );
}

/**
 * The same for content inside a Modal (drawers). Modals are separate windows
 * on Android, so this uses React Native's own view, which handles them.
 */
export function ModalKeyboardScreen(props: Omit<KeyboardAvoidingViewProps, 'behavior'>) {
  return <NativeKeyboardAvoidingView behavior="padding" {...props} />;
}

/** A form that keeps the focused field above the keyboard (and the footer). */
export function KeyboardAwareScrollView(props: ScrollViewProps) {
  const layout = use(KeyboardLayoutContext);
  const setHasForm = layout?.setHasForm;
  useEffect(() => {
    setHasForm?.(true);
    return () => setHasForm?.(false);
  }, [setHasForm]);
  return (
    <LibraryScrollView
      keyboardShouldPersistTaps="handled"
      bottomOffset={(layout?.footerHeight ?? 0) + GAP}
      {...props}
    />
  );
}

/**
 * Wraps a footer: in a form, it rides on top of the keyboard and reports its
 * height; anywhere else it's a plain view (the screen lifts it).
 */
export function KeyboardFooter({
  children,
  openedOffset = 0,
}: {
  children: ReactNode;
  /** Moves it this much lower while the keyboard is open. */
  openedOffset?: number;
}) {
  const layout = use(KeyboardLayoutContext);
  if (!layout?.hasForm) return children;
  return (
    <KeyboardStickyView
      offset={{ opened: openedOffset }}
      // What still shows above the keyboard.
      onLayout={(e) =>
        layout.setFooterHeight(Math.round(e.nativeEvent.layout.height - openedOffset))
      }
    >
      {children}
    </KeyboardStickyView>
  );
}
