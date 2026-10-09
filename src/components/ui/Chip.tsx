import { Pressable, Text } from 'react-native';

import { cn } from '@/lib/cn';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** pill: 42px rounded pill. tile: 44px rounded-rect for grids. compact: 38px filter pill. */
  shape?: 'pill' | 'tile' | 'compact';
  mono?: boolean;
  className?: string;
}

const SHAPE = {
  pill: 'h-[42px] rounded-[21px] px-[17px]',
  compact: 'h-[38px] rounded-[19px] px-[17px]',
  tile: 'h-11 flex-1 rounded-[14px]',
};

/** Selectable chip: lime when selected, outlined otherwise. */
export function Chip({ label, selected, onPress, shape = 'pill', mono, className }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'items-center justify-center border active:opacity-80',
        SHAPE[shape],
        selected ? 'border-lime bg-lime' : 'border-chip-border bg-transparent',
        className,
      )}
    >
      <Text
        className={cn(
          mono ? 'font-mono-medium text-[14.5px]' : 'font-sans-medium text-[15px]',
          selected ? 'text-bg' : 'text-ink',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Read-only interest tag. `active` highlights shared interests in lime. */
export function Tag({ label, active = true }: { label: string; active?: boolean }) {
  return (
    <Text
      className={cn(
        'h-[34px] overflow-hidden rounded-[17px] px-[15px] font-sans-medium text-[14px] leading-[34px]',
        active ? 'bg-lime-deep text-lime' : 'bg-surface-raised text-ink-dim',
      )}
    >
      {label}
    </Text>
  );
}
