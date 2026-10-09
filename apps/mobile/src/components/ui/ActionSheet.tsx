import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { Button } from './Button';
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
}

/**
 * A drawer of actions with Cancel, for options that shouldn't crowd a screen
 * (report, block). The chosen action runs once the drawer has slid away, so
 * a follow-up (a confirmation, a new screen) never appears under it.
 */
export function ActionSheet({ visible, onClose, actions, title, message }: ActionSheetProps) {
  const pending = useRef<(() => void) | null>(null);

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
        {title || message ? (
          <View className="items-center gap-1 pb-4">
            {title ? (
              <Text className="text-center font-sans-semibold text-[16px] text-ink">{title}</Text>
            ) : null}
            {message ? (
              <Text className="text-center font-sans text-[14px] leading-[20px] text-muted">
                {message}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View className="overflow-hidden rounded-[20px] bg-surface">
          {actions.map((action, i) => (
            <Pressable
              key={action.label}
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
        <Button label="Cancel" variant="outline" size="md" onPress={onClose} className="mt-3" />
      </View>
    </Sheet>
  );
}
