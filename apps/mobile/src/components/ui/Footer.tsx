import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useScreenInsets } from '@/hooks/useScreenInsets';
import { cn } from '@/lib/cn';
import { KeyboardFooter } from './Keyboard';

/** Sticky bottom action area with a hairline top border; rides on the keyboard in forms. */
export function Footer({ children, className }: { children: ReactNode; className?: string }) {
  const { bottom } = useScreenInsets();
  const padding = bottom(30);
  return (
    // On the keyboard, the room kept for the home indicator isn't needed.
    <KeyboardFooter openedOffset={padding - 12}>
      <View
        className={cn('border-t border-line bg-bg px-edge pt-3', className)}
        style={{ paddingBottom: padding }}
      >
        {children}
      </View>
    </KeyboardFooter>
  );
}
