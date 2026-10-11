import * as AlertDialog from '@rn-primitives/alert-dialog';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import { colors } from '@/theme';
import type { SheetAction } from './ActionSheet';

interface ConfirmDialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  /** One choice sits beside Cancel; more stack above it. */
  actions: SheetAction[];
  cancelLabel?: string;
}

/**
 * "Are you sure?" before something that can't easily be undone: a small
 * dialog in the middle of the screen. Built on @rn-primitives' alert dialog
 * (screen readers treat it as one; it only closes on a choice or Cancel).
 * Menus of options use a drawer or a popover instead.
 */
export function ConfirmDialog({
  visible,
  onClose,
  title,
  message,
  actions,
  cancelLabel = 'Cancel',
}: ConfirmDialogProps) {
  // Side by side only when both buttons fit on one line.
  const stacked =
    actions.length > 1 || [cancelLabel, ...actions.map((a) => a.label)].some((l) => l.length > 12);
  const cancel = (
    <AlertDialog.Cancel asChild>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.cancel,
          !stacked && styles.half,
          pressed && styles.pressed,
        ]}
      >
        <Text className="font-sans-semibold text-[15.5px] text-ink">{cancelLabel}</Text>
      </Pressable>
    </AlertDialog.Cancel>
  );

  return (
    <AlertDialog.Root open={visible} onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay style={StyleSheet.absoluteFill}>
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
            style={styles.backdrop}
          >
            <AlertDialog.Content style={styles.content}>
              <Animated.View entering={ZoomIn.duration(180)} style={styles.card}>
                <AlertDialog.Title asChild>
                  <Text className="font-display text-[20px] leading-[25px] text-ink">{title}</Text>
                </AlertDialog.Title>
                {message ? (
                  <AlertDialog.Description asChild>
                    <Text className="mt-2 font-sans text-[14.5px] leading-[21px] text-muted">
                      {message}
                    </Text>
                  </AlertDialog.Description>
                ) : null}
                <View className={cn('mt-6 gap-2.5', !stacked && 'flex-row')}>
                  {stacked ? null : cancel}
                  {actions.map((a) => (
                    <AlertDialog.Action key={a.label} asChild onPress={a.onPress}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.button,
                          a.destructive ? styles.destructive : styles.primary,
                          !stacked && styles.half,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          className={cn(
                            'text-center font-sans-semibold text-[15.5px]',
                            a.destructive ? 'text-ink' : 'text-bg',
                          )}
                        >
                          {a.label}
                        </Text>
                      </Pressable>
                    </AlertDialog.Action>
                  ))}
                  {stacked ? cancel : null}
                </View>
              </Animated.View>
            </AlertDialog.Content>
          </Animated.View>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: { width: '100%', maxWidth: 360 },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors['surface-raised'],
    padding: 22,
  },
  button: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  half: { flex: 1 },
  cancel: { backgroundColor: colors.surface },
  primary: { backgroundColor: colors.lime },
  destructive: { backgroundColor: colors.danger },
  pressed: { opacity: 0.8 },
});
