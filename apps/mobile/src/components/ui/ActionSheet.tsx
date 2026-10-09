import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

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
 * Bottom sheet of actions with a Cancel row, for options that shouldn't
 * crowd a screen (report, block). A plain RN Modal, so it works in Expo Go
 * and on web, where Alert-based sheets do nothing.
 */
export function ActionSheet({ visible, onClose, actions, title, message }: ActionSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        {/* Reanimated views carry the motion only; NativeWind classes go on plain Views. */}
        <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
          <Pressable
            className="flex-1 bg-black/60"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>

        <Animated.View entering={SlideInDown.duration(250)}>
          <View className="gap-2 px-3" style={{ paddingBottom: insets.bottom + 12 }}>
            <View className="overflow-hidden rounded-[20px] bg-surface">
              {title || message ? (
                <View className="items-center gap-1 border-b border-divider px-5 py-4">
                  {title ? (
                    <Text className="text-center font-sans-semibold text-[15px] text-ink">
                      {title}
                    </Text>
                  ) : null}
                  {message ? (
                    <Text className="text-center font-sans text-[13.5px] leading-[19px] text-muted">
                      {message}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {actions.map((action, i) => (
                <Pressable
                  key={action.label}
                  onPress={() => {
                    onClose();
                    action.onPress();
                  }}
                  accessibilityRole="button"
                  className={cn(
                    'h-[56px] items-center justify-center active:bg-surface-sunken',
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
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              className="h-[56px] items-center justify-center rounded-[20px] bg-surface active:bg-surface-sunken"
            >
              <Text className="font-sans-semibold text-[16.5px] text-ink">Cancel</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
