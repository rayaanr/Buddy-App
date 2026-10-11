import { Text } from 'react-native';

import { Card } from './Card';

/** A number and its label in a tile, e.g. "12 Joined" on profiles. */
export function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <Card className="flex-1 px-3.5 pb-4 pt-3.5">
      <Text className="font-display text-title1 text-ink">{value}</Text>
      <Text className="mt-1 font-sans text-footnote text-muted">{label}</Text>
    </Card>
  );
}
