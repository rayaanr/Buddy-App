import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { cn } from '@/lib/cn';
import { PressableScale } from './Motion';
import { CONTROL_FONT_SCALE } from '@/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** pill: 42px rounded pill. tile: 44px rounded-rect for grids. compact: 38px filter pill. */
  shape?: 'pill' | 'tile' | 'compact';
  mono?: boolean;
  className?: string;
  testID?: string;
  /** Shown before the label (or alone, with an empty label). */
  icon?: ReactNode;
  /** Needed when the chip shows only an icon. */
  accessibilityLabel?: string;
}

const SHAPE = {
  pill: 'h-[42px] rounded-full px-[17px]',
  compact: 'h-[38px] rounded-full px-[17px]',
  tile: 'h-11 flex-1 rounded-tile',
};

/** Selectable chip: lime when selected, outlined otherwise. */
export function Chip({
  label,
  selected,
  onPress,
  shape = 'pill',
  mono,
  className,
  testID,
  icon,
  accessibilityLabel,
}: ChipProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      haptic="selection"
      scale="strong"
      // Compact chips are 38 px tall; reach the 44 pt minimum touch area.
      hitSlop={shape === 'compact' ? 4 : undefined}
      className={cn(
        'flex-row items-center justify-center gap-1.5 border',
        SHAPE[shape],
        selected ? 'border-lime bg-lime' : 'border-chip-border bg-transparent',
        className,
      )}
    >
      {icon}
      {label ? (
        <Text
          maxFontSizeMultiplier={CONTROL_FONT_SCALE}
          className={cn(
            mono ? 'font-mono-medium text-subhead' : 'font-sans-medium text-subhead',
            selected ? 'text-bg' : 'text-ink',
          )}
        >
          {label}
        </Text>
      ) : null}
    </PressableScale>
  );
}

/** Read-only interest tag. `active` highlights shared interests in lime. */
export function Tag({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <Text
      maxFontSizeMultiplier={CONTROL_FONT_SCALE}
      className={cn(
        // Grows with larger text instead of clipping inside a fixed height.
        'min-h-[34px] overflow-hidden rounded-card px-[15px] py-2 font-sans-medium text-label leading-footnote',
        active ? 'bg-lime-deep text-lime' : 'bg-surface-raised text-ink-dim',
      )}
    >
      {label}
    </Text>
  );
}
