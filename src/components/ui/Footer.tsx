import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useScreenInsets } from '@/hooks/useScreenInsets';
import { cn } from '@/lib/cn';

/** Sticky bottom action area with a hairline top border. */
export function Footer({ children, className }: { children: ReactNode; className?: string }) {
  const { bottom } = useScreenInsets();
  return (
    <View
      className={cn('border-t border-line bg-bg px-[22px] pt-3', className)}
      style={{ paddingBottom: bottom(30) }}
    >
      {children}
    </View>
  );
}
