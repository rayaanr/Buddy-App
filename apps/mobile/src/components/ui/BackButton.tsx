import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useScreenInsets } from '@/hooks/useScreenInsets';
import { cn } from '@/lib/cn';
import { ArrowLeftIcon } from './icons';
import { PressableScale } from './Motion';

interface IconButtonProps {
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
        tone === 'glass' ? 'bg-[rgba(11,12,11,0.6)]' : 'bg-surface',
        disabled && 'opacity-50',
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

/** The plain screen header: Back on the left, an optional button on the right. */
export function ScreenHeader({ right }: { right?: ReactNode }) {
  const { top } = useScreenInsets();
  return (
    <View className="flex-row justify-between px-[18px]" style={{ paddingTop: top(56) }}>
      <BackButton />
      {right}
    </View>
  );
}
