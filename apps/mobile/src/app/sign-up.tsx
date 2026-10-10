import { placeLabel, type Place } from '@buddy/shared';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { isEmail, sendSignInCode } from '@/api/auth';
import { errorMessage } from '@/api/client';
import {
  BrandMark,
  Button,
  Footer,
  Heading,
  KeyboardAwareScrollView,
  KeyboardScreen,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { TownField } from '@/components/places/TownField';
import { PRIVACY_URL, TERMS_URL } from '@/config';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useAccountStore } from '@/store/account';

export default function SignUpScreen() {
  const { top } = useScreenInsets();
  const setPendingSignUp = useAccountStore((s) => s.setPendingSignUp);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [town, setTown] = useState<Place | null>(null);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = isEmail(email);
  const canSubmit = !!name.trim() && emailValid && !!town;

  const submit = async () => {
    if (!canSubmit || !town) {
      setTried(true);
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendSignInCode(email);
      setPendingSignUp({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        placeId: town.id,
        area: placeLabel(town),
      });
      router.push({ pathname: '/verify', params: { email: email.trim().toLowerCase() } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: top(64), paddingHorizontal: 22, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <BrandMark />
        <Heading size="hero" className="mt-7">
          Find people to do things with
        </Heading>
        <Text className="mt-3 font-sans text-[16px] leading-[23px] text-muted">
          Runs, games, markets and more happening near you this week.
        </Text>

        <SectionLabel className="mb-2 mt-7">Your name</SectionLabel>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="First and last name"
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          returnKeyType="next"
        />

        <SectionLabel className="mb-2 mt-[18px]">Email</SectionLabel>
        <TextField
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {tried && !emailValid ? (
          <Text className="mt-2 font-sans text-[13.5px] text-danger">
            Enter a valid email address.
          </Text>
        ) : null}
        <Text className="mt-2 font-sans text-[13.5px] leading-[19px] text-muted">
          We’ll email you a 6-digit code. No password needed.
        </Text>

        <SectionLabel className="mb-2 mt-[18px]">Where you live</SectionLabel>
        <TownField value={town} onChange={setTown} invalid={tried && !town} />
        <Text className="mt-2 font-sans text-[13.5px] leading-[19px] text-muted">
          Anywhere in Sri Lanka. We show activities near here; only your town is shown to others.
        </Text>
        {error ? <Text className="mt-4 font-sans text-[13.5px] text-danger">{error}</Text> : null}
        <Text className="mt-6 font-sans text-[13px] leading-[19px] text-subtle">
          By creating an account you agree to the{' '}
          <Text
            className="text-ink-dim underline"
            accessibilityRole="link"
            onPress={() => void openBrowserAsync(TERMS_URL)}
          >
            Terms of use
          </Text>{' '}
          and{' '}
          <Text
            className="text-ink-dim underline"
            accessibilityRole="link"
            onPress={() => void openBrowserAsync(PRIVACY_URL)}
          >
            Privacy policy
          </Text>
          .
        </Text>
      </KeyboardAwareScrollView>

      <Footer>
        <Button
          label={sending ? 'Sending code…' : 'Create account'}
          inactive={!canSubmit || sending}
          onPress={submit}
        />
        <View className="mt-3.5 flex-row justify-center gap-1.5">
          <Text className="font-sans text-[14.5px] text-muted">Already on Buddy?</Text>
          <Pressable
            onPress={() => router.replace('/sign-in')}
            accessibilityRole="link"
            hitSlop={8}
          >
            <Text className="font-sans-medium text-[14.5px] text-lime">Sign in</Text>
          </Pressable>
        </View>
      </Footer>
    </KeyboardScreen>
  );
}
