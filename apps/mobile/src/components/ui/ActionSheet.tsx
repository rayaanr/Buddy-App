import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { Button } from './Button';
import { CONTROL_FONT_SCALE } from '@/theme';
import { Sheet } from './Sheet';

export interface SheetAction {
  label: string;
  onPress: () => void;
  /** Red, for actions like Block or Delete. */
  destructive?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  actions: SheetAction[];
  /** Optional heading and explanation, e.g. for a confirmation. */
  title?: string;
  message?: string;
  /** Label for the dismiss button; "Cancel" unless an action is itself a cancel. */
  cancelLabel?: string;
}

/**
 * A drawer of actions with Cancel, for options that shouldn't crowd a screen
 * (report, block). The chosen action runs once the drawer has slid away, so
 * a follow-up (a confirmation, a new screen) never appears under it.
 */
export function ActionSheet({
  visible,
  onClose,
  actions,
  title,
  message,
  cancelLabel = 'Cancel',
}: ActionSheetProps) {
  const pending = useRef<(() => void) | null>(null);
  // Callers often clear what the sheet was about as it closes; keep showing
  // the last content while it slides away instead of reflowing mid-animation.
  // (Actions aren't kept: callers build them inline, and a tap runs the one it hit.)
  const [shown, setShown] = useState({ title, message });
  if (visible && (shown.title !== title || shown.message !== message)) {
    setShown({ title, message });
  }

  return (
    <Sheet
      open={visible}
      onClose={onClose}
      onClosed={() => {
        const run = pending.current;
        pending.current = null;
        run?.();
      }}
    >
      <View className="px-[22px]">
        {shown.title || shown.message ? (
          <View className="items-center gap-1 pb-4">
            {shown.title ? (
              <Text className="text-center font-sans-semibold text-[16px] text-ink">
                {shown.title}
              </Text>
            ) : null}
            {shown.message ? (
              <Text className="text-center font-sans text-[14px] leading-[20px] text-muted">
                {shown.message}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View className="overflow-hidden rounded-[20px] bg-surface">
          {actions.map((action, i) => (
            <Pressable
              key={i}
              onPress={() => {
                pending.current = action.onPress;
                onClose();
              }}
              accessibilityRole="button"
              className={cn(
                'h-[56px] items-center justify-center active:bg-surface-raised',
                i > 0 && 'border-t border-divider',
              )}
            >
              <Text
                maxFontSizeMultiplier={CONTROL_FONT_SCALE}
                className={cn(
                  'font-sans-medium text-[16.5px]',
                  action.destructive ? 'text-danger' : 'text-ink',
                )}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          label={cancelLabel}
          variant="outline"
          size="md"
          onPress={onClose}
          className="mt-3"
        />
      </View>
    </Sheet>
  );
}
