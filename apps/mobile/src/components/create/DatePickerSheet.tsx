import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChevronLeftIcon, ChevronRightIcon, IconButton, Sheet } from '@/components/ui';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const pad = (n: number) => String(n).padStart(2, '0');
const toDay = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parse = (day: string) => day.split('-').map(Number) as [number, number, number];

interface DatePickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** Selected day, "YYYY-MM-DD" (Sri Lanka time). */
  value: string;
  /** First and last days that can be picked. */
  min: string;
  max: string;
  onChange: (day: string) => void;
}

/**
 * Month calendar in a drawer. Days are plain calendar dates, so it reads the
 * same whatever time zone the phone is in. Mount with a new `key` per opening
 * so it starts on the selected month.
 */
export function DatePickerSheet({
  open,
  onClose,
  value,
  min,
  max,
  onChange,
}: DatePickerSheetProps) {
  const [shown, setShown] = useState(() => {
    const [y, m] = parse(value);
    return { y, m };
  });
  const { y, m } = shown;
  const [minY, minM] = parse(min);
  const [maxY, maxM] = parse(max);
  const canPrev = y > minY || m > minM;
  const canNext = y < maxY || m < maxM;
  const step = (delta: number) => {
    const index = y * 12 + (m - 1) + delta;
    setShown({ y: Math.floor(index / 12), m: (index % 12) + 1 });
  };

  // Monday-first grid: blanks before the 1st, then each day of the month.
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // One row per week, padded to seven: percentage widths in a wrapping row
  // round differently per phone and can push Sunday onto the next line.
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => cells[w * 7 + d] ?? null),
  );

  return (
    <Sheet open={open} onClose={onClose}>
      <View className="px-[22px]">
        <View className="flex-row items-center justify-between">
          <IconButton
            icon={<ChevronLeftIcon color={canPrev ? colors.ink : colors.subtle} />}
            label="Previous month"
            disabled={!canPrev}
            onPress={() => step(-1)}
          />
          <Text className="font-sans-semibold text-[17px] text-ink">
            {MONTHS[m - 1]} {y}
          </Text>
          <IconButton
            icon={<ChevronRightIcon color={canNext ? colors.ink : colors.subtle} />}
            label="Next month"
            disabled={!canNext}
            onPress={() => step(1)}
          />
        </View>

        <View className="mt-4 flex-row">
          {WEEKDAYS.map((d, i) => (
            <Text key={i} className="flex-1 text-center font-mono text-[12px] text-subtle">
              {d}
            </Text>
          ))}
        </View>

        <View className="mt-2">
          {weeks.map((week, w) => (
            <View key={w} className="flex-row">
              {week.map((d, i) => {
                if (d === null) return <View key={`blank-${i}`} className="h-12 flex-1" />;
                const day = toDay(y, m, d);
                const selected = day === value;
                const isToday = day === min;
                const disabled = day < min || day > max;
                return (
                  <View key={day} className="h-12 flex-1 items-center justify-center">
                    <Pressable
                      onPress={() => {
                        onChange(day);
                        onClose();
                      }}
                      disabled={disabled}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityLabel={`${d} ${MONTHS[m - 1]}`}
                      accessibilityState={{ selected, disabled }}
                      className={cn(
                        'h-10 w-10 items-center justify-center rounded-full active:opacity-70',
                        selected && 'bg-lime',
                        !selected && isToday && 'border border-lime-outline',
                      )}
                    >
                      <Text
                        className={cn(
                          'font-sans-medium text-[15px]',
                          selected ? 'text-bg' : disabled ? 'text-subtle opacity-40' : 'text-ink',
                        )}
                      >
                        {d}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </Sheet>
  );
}
