import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { cn } from '@/lib/cn';
import { ArrowLeftIcon, MoreIcon } from './icons';

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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-full active:opacity-70',
        tone === 'glass' ? 'bg-[rgba(11,12,11,0.6)]' : 'bg-surface',
        className,
      )}
    >
      {icon}
    </Pressable>
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
