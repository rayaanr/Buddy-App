import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { PressableScale } from './Motion';

export interface IconButtonProps {
  icon: ReactNode;
  /** Read by screen readers; the button has no visible text. */
  label: string;
  onPress: () => void;
  /** "glass" floats over photos; "solid" sits on the page background. */
  tone?: 'glass' | 'solid';
  className?: string;
  testID?: string;
  /** Dimmed, ignores taps, and is announced as unavailable. */
  disabled?: boolean;
}

/** Round 44px icon button used in screen headers. */
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'solid',
  className,
  testID,
  disabled,
}: IconButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      testID={testID}
      scale="strong"
      className={cn(
        'h-11 w-11 items-center justify-center rounded-full',
        tone === 'glass' ? 'bg-glass' : 'bg-surface',
        disabled && 'opacity-50',
        className,
      )}
    >
      {icon}
    </PressableScale>
  );
}
