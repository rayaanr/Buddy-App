import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { cn } from '@/lib/cn';
import { ArrowLeftIcon } from './icons';

interface BackButtonProps {
  /** "glass" floats over photos; "solid" sits on the page background. */
  tone?: 'glass' | 'solid';
  onPress?: () => void;
  className?: string;
}

export function BackButton({ tone = 'solid', onPress, className }: BackButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={6}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-full active:opacity-70',
        tone === 'glass' ? 'bg-[rgba(11,12,11,0.6)]' : 'bg-surface',
        className,
      )}
    >
      <ArrowLeftIcon />
    </Pressable>
  );
}
