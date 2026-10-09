import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { ArrowLeftIcon, MoreIcon } from './icons';
import { PressableScale } from './Motion';

interface IconButtonProps {
  icon: ReactNode;
  /** Read by screen readers; the button has no visible text. */
  label: string;
  onPress: () => void;
  /** "glass" floats over photos; "solid" sits on the page background. */
  tone?: 'glass' | 'solid';
  className?: string;
}

/** Round 44px icon button used in screen headers. */
export function IconButton({ icon, label, onPress, tone = 'solid', className }: IconButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      scaleTo={0.9}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-full',
        tone === 'glass' ? 'bg-[rgba(11,12,11,0.6)]' : 'bg-surface',
        className,
      )}
    >
      {icon}
    </PressableScale>
  );
}

type HeaderButtonProps = Omit<IconButtonProps, 'icon' | 'label' | 'onPress'> & {
  onPress?: () => void;
};

export function BackButton({ onPress, ...rest }: HeaderButtonProps) {
  return (
    <IconButton
      icon={<ArrowLeftIcon />}
      label="Back"
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      {...rest}
    />
  );
}

/** "⋯": opens less common actions (report, block) without crowding the screen. */
export function MoreButton({ onPress, ...rest }: HeaderButtonProps & { onPress: () => void }) {
  return <IconButton icon={<MoreIcon />} label="More options" onPress={onPress} {...rest} />;
}
