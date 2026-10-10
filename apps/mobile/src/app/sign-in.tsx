import { firstName, type ActivityGroup } from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { isEmail } from '@/api/auth';
import {
  BackButton,
  BrandMark,
  Button,
  Heading,
  KeyboardScreen,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { CardFan, type FanCardData } from '@/components/auth/CardFan';
import { GROUP_HUES } from '@/data/constants';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useSendCode } from '@/hooks/useSendCode';
import { whenLabel } from '@/lib/activity';
import { useAccountStore, type PicksPreview } from '@/store/account';

const toFanCard = (card: PicksPreview['cards'][number]): FanCardData => ({
  coverUrl: card.coverUrl,
  hue: GROUP_HUES[card.group as ActivityGroup] ?? GROUP_HUES.Social,
  eyebrow: whenLabel(card),
  title: card.title,
});

export default function SignInScreen() {
  const remembered = useAccountStore((s) => s.remembered);
  return remembered ? <WelcomeBack /> : <EmailSignIn />;
}

/** "Good to see you, Kavindu": the designed screen for a remembered account. */
function WelcomeBack() {
  const { top, bottom } = useScreenInsets();
  const remembered = useAccountStore((s) => s.remembered)!;
  const forget = useAccountStore((s) => s.forget);
  const { send, sending, error } = useSendCode();
  const name = firstName(remembered.name);

  return (
    <View
      className="flex-1 bg-bg px-[22px]"
      style={{ paddingTop: top(64), paddingBottom: bottom(34) }}
    >
      <BrandMark />
      <View className="flex-1 items-center justify-center pt-2.5">
        {remembered.picks?.cards.length ? (
          <CardFan
            cards={remembered.picks.cards.map(toFanCard)}
            badge={`${remembered.picks.count} new pick${remembered.picks.count === 1 ? '' : 's'} near ${remembered.area}`}
          />
        ) : null}
      </View>
      <Heading size="hero" className="text-center">
        Good to see you, {name}
      </Heading>
      <Text className="mt-3 text-center font-sans text-[16px] leading-[23px] text-muted">
        Signed out on this device.
      </Text>
      {error ? (
        <Text className="mt-3 text-center font-sans text-[13.5px] text-danger">{error}</Text>
      ) : null}
      <Button
        label={sending ? 'Sending code…' : `Continue as ${name}`}
        inactive={sending}
        onPress={() => send(remembered.email)}
        className="mt-7"
      />
      <Button
        label="Not you? Start over"
        variant="ghost"
        size="md"
        onPress={() => {
          forget();
          router.replace('/welcome');
        }}
        className="mt-2.5"
        weight="medium"
      />
    </View>
  );
}

/** Plain email sign-in, for a device that hasn't been used with Buddy before. */
function EmailSignIn() {
  const { top, bottom } = useScreenInsets();
  const [email, setEmail] = useState('');
  const { send, sending, error } = useSendCode();
  const valid = isEmail(email);

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <View className="flex-1 px-[22px]" style={{ paddingTop: top(56), paddingBottom: bottom(34) }}>
        <BackButton
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
        />
        <Heading size="hero" className="mt-6">
          Welcome back
        </Heading>
        <Text className="mt-3 font-sans text-[16px] leading-[23px] text-muted">
          Enter the email you signed up with and we’ll send you a code.
        </Text>
        <SectionLabel className="mb-2 mt-7">Email</SectionLabel>
        <TextField
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={() => valid && send(email)}
        />
        {error ? <Text className="mt-2 font-sans text-[13.5px] text-danger">{error}</Text> : null}
        <View className="flex-1" />
        <Button
          label={sending ? 'Sending code…' : 'Send code'}
          inactive={!valid || sending}
          onPress={() => valid && send(email)}
        />
        <View className="mt-3.5 flex-row justify-center gap-1.5">
          <Text className="font-sans text-[14.5px] text-muted">New to Buddy?</Text>
          <Pressable
            onPress={() => router.replace('/sign-up')}
            accessibilityRole="link"
            hitSlop={8}
          >
            <Text className="font-sans-medium text-[14.5px] text-lime">Create an account</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardScreen>
  );
}
