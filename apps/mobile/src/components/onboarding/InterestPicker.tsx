import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BrandMark, Button, Chip, Footer, Heading, SectionLabel } from '@/components/ui';
import {
  AVAILABILITY,
  INTERESTS,
  MIN_INTERESTS,
  type Availability,
  type Interest,
} from '@buddy/shared';

import { useScreenInsets } from '@/hooks/useScreenInsets';
import { cn } from '@/lib/cn';

interface InterestPickerProps {
  initialInterests: Interest[];
  initialAvailability: Availability[];
  submitLabel: string;
  /** Disables the button while saving. */
  busy?: boolean;
  onSubmit: (interests: Interest[], availability: Availability[]) => void;
}

const toggle = <T extends string>(list: T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/** "What are you into?" — used for first-run onboarding and for editing interests later. */
export function InterestPicker({
  initialInterests,
  initialAvailability,
  submitLabel,
  busy,
  onSubmit,
}: InterestPickerProps) {
  const { top } = useScreenInsets();
  const [interests, setInterests] = useState(initialInterests);
  const [availability, setAvailability] = useState(initialAvailability);
  const need = MIN_INTERESTS - interests.length;

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: top(64), paddingHorizontal: 22, paddingBottom: 20 }}
      >
        <BrandMark />
        <Heading size="hero" className="mt-2.5">
          What are you into?
        </Heading>
        <Text className="mt-3 font-sans text-[16px] leading-[23px] text-muted">
          Pick at least three. We’ll show you things happening nearby.
        </Text>

        <View className="mt-[22px] flex-row flex-wrap justify-between gap-y-[9px]">
          {INTERESTS.map((label) => (
            <InterestTile
              key={label}
              label={label}
              selected={interests.includes(label)}
              onPress={() => setInterests((l) => toggle(l, label))}
            />
          ))}
        </View>

        <SectionLabel className="mb-3 mt-[26px]">Usually free</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          {AVAILABILITY.map((label) => (
            <Chip
              key={label}
              label={label}
              selected={availability.includes(label)}
              onPress={() => setAvailability((l) => toggle(l, label))}
            />
          ))}
        </View>
      </ScrollView>

      <Footer>
        <Button
          label={need > 0 ? `Pick ${need} more` : submitLabel}
          inactive={need > 0}
          disabled={busy}
          onPress={() => need <= 0 && !busy && onSubmit(interests, availability)}
        />
      </Footer>
    </View>
  );
}

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
