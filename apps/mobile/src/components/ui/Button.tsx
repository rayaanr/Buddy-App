import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, Pressable, Text, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger' | 'danger-outline' | 'muted';
type Size = 'lg' | 'md' | 'sm';

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-lime',
  outline: 'border border-outline bg-transparent',
  ghost: 'bg-transparent',
  danger: 'bg-transparent',
  'danger-outline': 'border border-field bg-transparent',
  muted: 'bg-disabled',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-bg',
  outline: 'text-ink',
  ghost: 'text-muted',
  danger: 'text-danger',
  'danger-outline': 'text-danger',
  muted: 'text-muted',
};

const SIZE: Record<Size, { box: string; text: string }> = {
  lg: { box: 'h-[58px] rounded-[18px]', text: 'text-[17px]' },
  md: { box: 'h-[52px] rounded-2xl', text: 'text-[15.5px]' },
  sm: { box: 'h-[42px] self-center rounded-[21px] px-[18px]', text: 'text-[14.5px]' },
};

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: Variant;
  size?: Size;
  /** Renders the inactive grey style while staying pressable (so we can show validation). */
  inactive?: boolean;
  /** Medium-weight labels are used for quiet text buttons ("Log out", "Not you?"). */
  weight?: 'semibold' | 'medium';
  className?: string;
  icon?: ReactNode;
  haptic?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  inactive,
  weight = 'semibold',
  className,
  icon,
  haptic = variant === 'primary',
  onPress,
  ...rest
}: ButtonProps) {
  const v: Variant = inactive ? 'muted' : variant;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(inactive || rest.disabled) }}
      className={cn(
        'flex-row items-center justify-center gap-2 active:opacity-80',
        SIZE[size].box,
        CONTAINER[v],
        className,
      )}
      onPress={(e) => {
        if (haptic && !inactive && Platform.OS !== 'web')
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      {...rest}
    >
      {icon}
      <Text
        className={cn(
          weight === 'medium' ? 'font-sans-medium' : 'font-sans-semibold',
          weight === 'medium' && size === 'md' ? 'text-[15px]' : SIZE[size].text,
          LABEL[v],
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
