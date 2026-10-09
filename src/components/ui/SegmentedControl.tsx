import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      className={cn('flex-row gap-1 rounded-2xl bg-surface p-1', className)}
    >
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <Pressable
            key={s.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(s.value)}
            className={cn(
              'h-[42px] flex-1 items-center justify-center rounded-xl',
              active ? 'bg-disabled' : 'bg-transparent',
            )}
          >
            <Text
              className={cn('font-sans-semibold text-[14.5px]', active ? 'text-ink' : 'text-muted')}
            >
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
