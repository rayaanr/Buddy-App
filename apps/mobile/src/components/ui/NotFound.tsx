import { Text, View } from 'react-native';

import { ScreenHeader } from './BackButton';

/** Shown when a deep link points at something that no longer exists. */
export function NotFound({ message }: { message: string }) {
  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader />
      <Text className="mt-10 px-edge text-center font-sans-semibold text-headline text-ink">
        {message}
      </Text>
    </View>
  );
}
