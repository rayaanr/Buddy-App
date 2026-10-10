import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { CardFan, type FanCardData } from '@/components/auth/CardFan';
import { BrandMark, Button, Heading } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=600&q=70&auto=format&fit=crop`;

/** The same examples as the landing page. */
const EXAMPLES: FanCardData[] = [
  {
    eyebrow: 'TONIGHT · 18:00',
    title: 'Sunset 5K at Galle Face',
    coverUrl: photo('1552674605-db6ffd4facb5'),
    hue: '#5a3420',
  },
  {
    eyebrow: 'SUN · 16:30',
    title: 'Beach cricket, Mount Lavinia',
    coverUrl: photo('1531415074968-036ba1b575da'),
    hue: '#1f4a2a',
  },
  {
    eyebrow: 'TONIGHT · 19:30',
    title: 'Board games night',
    coverUrl: photo('1529156069898-49953e39b3ac'),
    hue: '#5a2a2a',
  },
];

/** First open on a new device: what Buddy is, then sign up or sign in. */
export default function WelcomeScreen() {
  const { top, bottom } = useScreenInsets();
  return (
    <View
      className="flex-1 bg-bg px-[22px]"
      style={{ paddingTop: top(64), paddingBottom: bottom(34) }}
    >
      <BrandMark />
      <View className="flex-1 items-center justify-center pt-2.5">
        <CardFan cards={EXAMPLES} badge="Happening near you this week" />
      </View>
      <Heading size="hero">Find people to do things with</Heading>
      <Text className="mt-3 font-sans text-[16px] leading-[23px] text-muted">
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
