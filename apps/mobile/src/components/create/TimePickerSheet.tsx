import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Dialog } from '@/components/ui';
import { Wheel } from './Wheel';

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, h) => pad(h));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

interface TimePickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** "HH:MM", 24-hour. */
  value: string;
  onChange: (time: string) => void;
}

/**
 * Hour and minute wheels (5-minute steps) in a dialog, 24-hour like the rest
 * of the app. Mount with a new `key` per opening so it starts on `value`.
 */
export function TimePickerSheet({ open, onClose, value, onChange }: TimePickerSheetProps) {
  const [hour, setHour] = useState(() => Number(value.slice(0, 2)) || 0);
  const [minute, setMinute] = useState(() => Math.round(Number(value.slice(3, 5)) / 5) % 12);
  const time = `${HOURS[hour]}:${MINUTES[minute]}`;

  return (
    <Dialog open={open} onClose={onClose}>
      <View className="px-[22px]">
        <Text className="text-center font-sans-semibold text-[17px] text-ink">Start time</Text>

        <View className="mt-4 flex-row items-center justify-center gap-2">
          <Wheel values={HOURS} index={hour} onChange={setHour} label="Hour" />
          <Text className="pb-1 font-mono-medium text-[26px] text-ink">:</Text>
          <Wheel values={MINUTES} index={minute} onChange={setMinute} label="Minutes" />
        </View>

        <Button
          label={`Set ${time}`}
          className="mt-6"
          onPress={() => {
            onChange(time);
            onClose();
          }}
        />
      </View>
    </Dialog>
  );
}
