import { AVAILABILITY, INTERESTS, type Availability, type Interest } from '@buddy/shared';
import { Pressable, Text, View } from 'react-native';

import { Chip } from '@/components/ui';
import { cn } from '@/lib/cn';

const toggle = <T extends string>(list: T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/** Every interest as two columns of tiles. Onboarding and Edit profile. */
export function InterestGrid({
  value,
  onChange,
}: {
  value: Interest[];
  onChange: (next: Interest[]) => void;
}) {
  return (
    <View className="flex-row flex-wrap justify-between gap-y-[9px]">
      {INTERESTS.map((label) => (
        <InterestTile
          key={label}
          label={label}
          selected={value.includes(label)}
          onPress={() => onChange(toggle(value, label))}
        />
      ))}
    </View>
  );
}

/** "Usually free" chips. Onboarding and Edit profile. */
export function AvailabilityChips({
  value,
  onChange,
}: {
  value: Availability[];
  onChange: (next: Availability[]) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {AVAILABILITY.map((label) => (
        <Chip
          key={label}
          label={label}
          selected={value.includes(label)}
          onPress={() => onChange(toggle(value, label))}
        />
      ))}
    </View>
  );
}

/** A half-width interest tile with a check circle. */
function InterestTile({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      className={cn(
        'h-[54px] w-[48.8%] flex-row items-center justify-between rounded-[14px] border pl-4 pr-3.5 active:opacity-80',
        selected ? 'border-lime bg-lime-tint' : 'border-surface bg-surface',
      )}
    >
      <Text className="font-sans-medium text-[15.5px] text-ink">{label}</Text>
      <View
        className={cn(
          'h-5 w-5 rounded-full border-[1.5px]',
          selected ? 'border-lime bg-lime' : 'border-[#4a4c48] bg-transparent',
        )}
      />
    </Pressable>
  );
}
