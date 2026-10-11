import { router, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { BackButton, Button } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';

/**
 * A link or notification that points nowhere (an old buddy:// link, a
 * mistyped address): say so, with a way back into the app.
 */
export default function NotFoundScreen() {
  const { top } = useScreenInsets();
  return (
    <View className="flex-1 bg-bg px-edge" style={{ paddingTop: top(56) }}>
      <Stack.Screen options={{ headerShown: false }} />
      <BackButton />
      <View className="flex-1 items-center justify-center pb-24">
        <Text className="text-center font-sans-semibold text-title2 text-ink">
          This page doesn’t exist
        </Text>
        <Text className="mt-2 text-center font-sans text-subhead leading-subhead text-muted">
          The link may be old, or the activity may have been removed.
        </Text>
        <Button
          label="Go to Discover"
          size="md"
          className="mt-6 self-stretch"
          onPress={() => router.replace('/')}
        />
      </View>
    </View>
  );
}
