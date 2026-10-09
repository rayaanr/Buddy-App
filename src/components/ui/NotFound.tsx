import { Text, View } from 'react-native';

import { useScreenInsets } from '@/hooks/useScreenInsets';
import { BackButton } from './BackButton';

/** Shown when a deep link points at something that no longer exists. */
export function NotFound({ message }: { message: string }) {
  const { top } = useScreenInsets();
  return (
    <View className="flex-1 bg-bg px-[18px]" style={{ paddingTop: top(56) }}>
      <BackButton />
      <Text className="mt-10 text-center font-sans-semibold text-[17px] text-ink">{message}</Text>
    </View>
  );
}
