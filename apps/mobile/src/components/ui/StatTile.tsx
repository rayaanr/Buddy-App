import { Text } from 'react-native';

import { Card } from './Card';

/**
 * A number and its label in a tile, e.g. "12 Joined" on profiles. `note`
 * adds a small line of context under the label ("+4 this week").
 */
export function StatTile({
  value,
  label,
  note,
}: {
  value: number | string;
  label: string;
  note?: string;
}) {
  return (
    <Card
      className="flex-1 px-3.5 pb-4 pt-3.5"
      accessible
      accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`}
    >
      <Text className="font-display text-title1 text-ink">{value}</Text>
      <Text className="mt-1 font-sans text-footnote text-muted">{label}</Text>
      {note ? <Text className="mt-0.5 font-sans text-caption text-subtle">{note}</Text> : null}
    </Card>
  );
}
