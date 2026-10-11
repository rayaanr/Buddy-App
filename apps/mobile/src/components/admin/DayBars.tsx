import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';

const HEIGHT = 96;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tue 7 Oct" from "2026-10-07". */
function dayLabel(day: string) {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[date.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

/**
 * One count per day as bars (one series, so the title names it: no legend).
 * Tap a bar for that day's number; today's is shown to start with.
 */
export function DayBars({
  title,
  days,
}: {
  title: string;
  days: { day: string; value: number }[];
}) {
  const [picked, setPicked] = useState(days.length - 1);
  const max = Math.max(1, ...days.map((d) => d.value));
  const total = days.reduce((sum, d) => sum + d.value, 0);
  const shown = days[picked];
  return (
    <Card className="p-4">
      <View className="flex-row items-baseline justify-between">
        <Text className="font-sans-semibold text-subhead text-ink">{title}</Text>
        <Text className="font-sans text-footnote text-muted">{total} in 14 days</Text>
      </View>
      {/* Text, not colour, carries the value: the picked day and its count. */}
      <Text className="mt-1 font-sans text-footnote text-muted">
        {shown ? `${dayLabel(shown.day)}: ` : ''}
        <Text className="font-sans-semibold text-ink">{shown?.value ?? 0}</Text>
      </Text>
      <View
        className="mt-3 flex-row items-end gap-0.5 border-b border-outline"
        style={{ height: HEIGHT }}
      >
        {days.map((d, i) => (
          <Pressable
            key={d.day}
            onPress={() => setPicked(i)}
            accessibilityRole="button"
            accessibilityLabel={`${dayLabel(d.day)}: ${d.value}`}
            accessibilityState={{ selected: i === picked }}
            // The whole column is the tap target, not just the bar.
            className="h-full flex-1 justify-end"
          >
            <View
              className={cn('rounded-t', i === picked ? 'bg-lime' : 'bg-lime-outline')}
              // At least a sliver, so zero days still read as days.
              style={{ height: Math.max(2, (d.value / max) * (HEIGHT - 4)) }}
            />
          </Pressable>
        ))}
      </View>
      <View className="mt-1.5 flex-row justify-between">
        <Text className="font-sans text-caption text-subtle">
          {days[0] ? dayLabel(days[0].day) : ''}
        </Text>
        <Text className="font-sans text-caption text-subtle">Today</Text>
      </View>
    </Card>
  );
}
