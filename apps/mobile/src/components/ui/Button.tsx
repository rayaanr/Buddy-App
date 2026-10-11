import {
  ActivityIndicator,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { cn } from '@/lib/cn';
import { PressableScale } from './Motion';
import { colors, CONTROL_FONT_SCALE } from '@/theme';

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
  lg: { box: 'h-[58px] rounded-card', text: 'text-headline' },
  md: { box: 'h-[52px] rounded-2xl', text: 'text-body' },
  sm: { box: 'h-[42px] self-center rounded-full px-[18px]', text: 'text-subhead' },
};

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  style?: StyleProp<ViewStyle>;
  label: string;
  variant?: Variant;
  size?: Size;
  /** Renders the inactive grey style while staying pressable (so we can show validation). */
  inactive?: boolean;
  /** Working on it: a spinner beside the label, and presses are ignored. */
  loading?: boolean;
  /** Medium-weight labels are used for quiet text buttons ("Log out", "Not you?"). */
  weight?: 'semibold' | 'medium';
  className?: string;
  haptic?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  inactive,
  loading,
  weight = 'semibold',
  className,
  haptic = variant === 'primary',
  onPress,
  ...rest
}: ButtonProps) {
  const v: Variant = inactive ? 'muted' : variant;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(inactive || loading || rest.disabled), busy: !!loading }}
      haptic={haptic && !inactive && !loading ? 'light' : undefined}
      // The small size is 42pt tall: reach 44+ for a fingertip.
      hitSlop={size === 'sm' ? 4 : undefined}
      className={cn(
        'flex-row items-center justify-center gap-2',
        SIZE[size].box,
        CONTAINER[v],
        className,
      )}
      onPress={loading ? undefined : onPress}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v === 'primary' ? colors.bg : colors.muted} />
      ) : null}
      <Text
        maxFontSizeMultiplier={CONTROL_FONT_SCALE}
        className={cn(
          weight === 'medium' ? 'font-sans-medium' : 'font-sans-semibold',
          weight === 'medium' && size === 'md' ? 'text-subhead' : SIZE[size].text,
          LABEL[v],
        )}
      >
        {label}
      </Text>
    </PressableScale>
  );
}
