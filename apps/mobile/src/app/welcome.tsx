import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { CardFan, EXAMPLE_CARDS } from '@/components/auth/CardFan';
import { BrandMark, Button, Heading } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';

/** First open on a new device: what Buddy is, then sign up or sign in. */
export default function WelcomeScreen() {
  const { top, bottom } = useScreenInsets();
  return (
    <View
      className="flex-1 bg-bg px-edge"
      style={{ paddingTop: top(64), paddingBottom: bottom(34) }}
    >
      <BrandMark />
      <View className="flex-1 items-center justify-center pt-2.5">
        <CardFan cards={EXAMPLE_CARDS} badge="Happening near you this week" />
      </View>
      <Heading size="hero" className="text-center">
        Find people to do things with
      </Heading>
      <Text className="mt-3 text-center font-sans text-body leading-body text-muted">
        Runs, games, markets and more around Sri Lanka. See who’s going and join in two taps.
      </Text>
      <Button label="Get started" onPress={() => router.push('/sign-up')} className="mt-7" />
      <Button
        label="I already have an account"
        variant="ghost"
        size="md"
        weight="medium"
        onPress={() => router.push('/sign-in')}
        className="mt-2.5"
      />
    </View>
  );
}
