import { placeLabel, type Place } from '@buddy/shared';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { ChevronDownIcon, MapPinIcon } from '@/components/ui';
import { cn } from '@/lib/cn';
import { PlacePickerSheet } from './PlaceSearch';

interface TownFieldProps {
  value: Pick<Place, 'name' | 'district'> | null;
  onChange: (place: Place) => void;
  /** Matches TextField's tones. */
  tone?: 'sunken' | 'inset';
  invalid?: boolean;
}

/** "Where do you live?": opens a town search across Sri Lanka. */
export function TownField({ value, onChange, tone = 'sunken', invalid }: TownFieldProps) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);

  return (
    <>
      <Pressable
        onPress={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={value ? `Home town, ${placeLabel(value)}. Change` : 'Choose your town'}
        className={cn(
          'h-[54px] flex-row items-center gap-2.5 rounded-2xl border px-4 active:opacity-80',
          // Same look as TextField.
          tone === 'sunken' ? 'bg-surface-sunken' : 'bg-bg',
          invalid ? 'border-danger' : 'border-field',
        )}
      >
        <MapPinIcon />
        <Text
          numberOfLines={1}
          className={cn('flex-1 font-sans text-[16px]', value ? 'text-ink' : 'text-subtle')}
        >
          {value ? placeLabel(value) : 'Search your town'}
        </Text>
        <ChevronDownIcon />
      </Pressable>
      <PlacePickerSheet
        key={key}
        open={open}
        onClose={() => setOpen(false)}
        onPick={onChange}
        title="Where do you live?"
      />
    </>
  );
}
