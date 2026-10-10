import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, SectionLabel, Sheet } from '@/components/ui';
import { cn } from '@/lib/cn';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

interface TimePickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** "HH:MM", 24-hour. */
  value: string;
  onChange: (time: string) => void;
}

/**
 * Hour and minute (5-minute steps) grids in a drawer, 24-hour like the rest
 * of the app. Mount with a new `key` per opening so it starts on `value`.
 */
export function TimePickerSheet({ open, onClose, value, onChange }: TimePickerSheetProps) {
  const [hour, setHour] = useState(() => Number(value.slice(0, 2)) || 0);
  const [minute, setMinute] = useState(() => (Math.round(Number(value.slice(3, 5)) / 5) * 5) % 60);

  return (
    <Sheet open={open} onClose={onClose}>
      <View className="px-[22px]">
        <Text
          className="text-center font-mono-medium text-[44px] text-ink"
          accessibilityLabel={`Selected time ${pad(hour)}:${pad(minute)}`}
        >
          {pad(hour)}:{pad(minute)}
        </Text>

        <SectionLabel className="mb-2 mt-3">Hour</SectionLabel>
        <Grid values={HOURS} selected={hour} onSelect={setHour} label="hour" />

        <SectionLabel className="mb-2 mt-4">Minute</SectionLabel>
        <Grid values={MINUTES} selected={minute} onSelect={setMinute} label="minutes" />

        <Button
          label="Set time"
          className="mt-5"
          onPress={() => {
            onChange(`${pad(hour)}:${pad(minute)}`);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

function Grid({
  values,
  selected,
  onSelect,
  label,
}: {
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
  label: string;
}) {
  return (
    <View className="flex-row flex-wrap" accessibilityRole="radiogroup">
      {values.map((v) => {
        const active = v === selected;
        return (
          <View key={v} className="h-12 w-1/6 p-0.5">
            <Pressable
              onPress={() => onSelect(v)}
              role="radio"
              aria-checked={active}
              accessibilityLabel={`${pad(v)} ${label}`}
              className={cn(
                'flex-1 items-center justify-center rounded-xl active:opacity-70',
                active ? 'bg-lime' : 'bg-surface',
              )}
            >
              <Text className={cn('font-mono-medium text-[15px]', active ? 'text-bg' : 'text-ink')}>
                {pad(v)}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
