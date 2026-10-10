import { firstName } from '@buddy/shared';
import type { ActivityGroup } from '@buddy/shared';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

import { isEmail, sendSignInCode } from '@/api/auth';
import { errorMessage } from '@/api/client';
import {
  BrandMark,
  Button,
  Heading,
  KeyboardScreen,
  Photo,
  Scrim,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { GROUP_HUES } from '@/data/constants';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { whenLabel } from '@/lib/activity';
import { useAccountStore, type PicksPreview } from '@/store/account';

const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.5,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 16 },
  elevation: 12,
};

/** Emails a code and opens the code screen; shared by both sign-in modes. */
function useSendCode() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (email: string) => {
    setSending(true);
    setError(null);
    try {
      await sendSignInCode(email);
      router.push({ pathname: '/verify', params: { email: email.trim().toLowerCase() } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };
  return { send, sending, error };
}

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
          <PicksFan picks={remembered.picks} area={remembered.area} />
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
          router.replace('/sign-up');
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
      <View className="flex-1 px-[22px]" style={{ paddingTop: top(64), paddingBottom: bottom(34) }}>
        <BrandMark />
        <Heading size="hero" className="mt-7">
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

type FanCardData = PicksPreview['cards'][number];

function PicksFan({ picks, area }: { picks: PicksPreview; area: string }) {
  const [front, right, left] = picks.cards;
  if (!front) return null;
  return (
    <View style={{ width: 300, height: 250 }}>
      {left ? (
        <FanCard
          card={left}
          style={{ left: 12, top: 26, width: 150, height: 200, transform: [{ rotate: '-11deg' }] }}
        />
      ) : null}
      {right ? (
        <FanCard
          card={right}
          style={{ right: 12, top: 26, width: 150, height: 200, transform: [{ rotate: '11deg' }] }}
        />
      ) : null}
      <FanCard card={front} radius={24} style={{ left: 65, top: 0, width: 170, height: 226 }}>
        <Scrim from={0.4} opacity={0.9} />
        <View className="absolute inset-x-3 bottom-3">
          <Text className="font-mono-medium text-[10.5px] tracking-[1.05px] text-lime">
            {whenLabel(front)}
          </Text>
          <Text className="mt-[5px] font-sans-semibold text-[14px] leading-[17.5px] text-ink">
            {front.title}
          </Text>
        </View>
      </FanCard>
      <View className="absolute -bottom-1.5 h-8 justify-center self-center rounded-2xl bg-lime px-3.5">
        <Text className="font-sans-semibold text-[13.5px] text-bg" numberOfLines={1}>
          {picks.count} new pick{picks.count === 1 ? '' : 's'} near {area}
        </Text>
      </View>
    </View>
  );
}

interface FanCardProps {
  card: FanCardData;
  style: ViewStyle;
  radius?: number;
  children?: ReactNode;
}

/** Shadow lives on the wrapper because iOS clips shadows on overflow-hidden views. */
function FanCard({ card, style, radius = 22, children }: FanCardProps) {
  const hue = GROUP_HUES[card.group as ActivityGroup] ?? GROUP_HUES.Social;
  return (
    // Android elevation needs a background to cast a shadow.
    <View
      style={[{ position: 'absolute', borderRadius: radius, backgroundColor: hue }, SHADOW, style]}
    >
      <Photo
        uri={card.coverUrl ?? undefined}
        hue={hue}
        className="flex-1 border border-[#2a2c29]"
        style={{ borderRadius: radius }}
      >
        {children}
      </Photo>
    </View>
  );
}
