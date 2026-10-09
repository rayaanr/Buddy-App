import { Text, View } from 'react-native';

/** The "● buddy" wordmark used at the top of auth screens. */
export function BrandMark() {
  return (
    <View
      className="flex-row items-center gap-[9px]"
      accessibilityRole="header"
      accessibilityLabel="Buddy"
    >
      <View className="h-2.5 w-2.5 rounded-full bg-lime" />
      <Text className="font-display text-[18px] text-ink">buddy</Text>
    </View>
  );
}
