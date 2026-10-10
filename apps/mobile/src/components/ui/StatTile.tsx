import { Text, View } from 'react-native';

/** A number and its label in a tile, e.g. "12 Joined" on profiles. */
export function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-surface px-3.5 pb-4 pt-3.5">
      <Text className="font-display text-[22px] text-ink">{value}</Text>
      <Text className="mt-1 font-sans text-[13px] text-muted">{label}</Text>
    </View>
  );
}
