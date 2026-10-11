import * as DropdownMenu from '@rn-primitives/dropdown-menu';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { popIn, popOut } from '@/theme/motion';

import { cn } from '@/lib/cn';
import { colors, shadows } from '@/theme';
import { MoreIcon } from './icons';

export interface MenuItem {
  label: string;
  onPress: () => void;
  /** Red, for actions like Block or Delete (which then ask to confirm). */
  destructive?: boolean;
  icon?: ReactNode;
}

interface MenuProps {
  items: MenuItem[];
  /** What the button is called for screen readers, e.g. "More options". */
  label: string;
  /** The button's look; a round ⋯ by default. */
  trigger?: ReactNode;
  /** The ⋯ button floats over photos ("glass") or sits on the page ("solid"). */
  tone?: 'glass' | 'solid';
  /** Which edge of the button the menu lines up with. */
  align?: 'start' | 'end';
}

/**
 * A small menu that opens next to the button that opened it (a popover),
 * for a few short actions. Longer choices use a Dialog; confirmations, ConfirmDialog.
 * Built on @rn-primitives' dropdown menu: placement, flipping at the screen
 * edge, closing on an outside tap and screen reader roles come from there.
 */
export function Menu({ items, label, trigger, tone = 'solid', align = 'end' }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger accessibilityLabel={label} hitSlop={6}>
        {trigger ?? (
          <View
            className={cn(
              'h-11 w-11 items-center justify-center rounded-full',
              tone === 'glass' ? 'bg-glass' : 'bg-surface',
            )}
          >
            <MoreIcon />
          </View>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Overlay style={StyleSheet.absoluteFill}>
          <DropdownMenu.Content align={align} sideOffset={6} insets={INSETS}>
            <Animated.View entering={popIn} exiting={popOut} style={styles.card}>
              {items.map((item, i) => (
                // The primitive's own Pressable with fixed styles: a style
                // function passed through `asChild` is dropped on phones.
                <DropdownMenu.Item
                  key={item.label}
                  onPress={item.onPress}
                  textValue={item.label}
                  style={StyleSheet.flatten([styles.item, i > 0 && styles.divider])}
                  className="active:bg-surface"
                >
                  {item.icon ? <View className="w-5 items-center">{item.icon}</View> : null}
                  <Text
                    className={cn(
                      'font-sans-medium text-body',
                      item.destructive ? 'text-danger' : 'text-ink',
                    )}
                  >
                    {item.label}
                  </Text>
                </DropdownMenu.Item>
              ))}
            </Animated.View>
          </DropdownMenu.Content>
        </DropdownMenu.Overlay>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Keeps the menu clear of the screen's edges. */
const INSETS = { top: 12, bottom: 12, left: 12, right: 12 };

const styles = StyleSheet.create({
  card: {
    minWidth: 210,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors['surface-raised'],
    overflow: 'hidden',
    boxShadow: shadows.raised,
  },
  item: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
