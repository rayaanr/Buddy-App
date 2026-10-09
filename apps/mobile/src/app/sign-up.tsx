import { AREA_NAMES, DEFAULT_AREA, type Area } from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { isEmail, sendSignInCode } from '@/api/auth';
import { errorMessage } from '@/api/client';
import {
  BrandMark,
  Button,
  Chip,
  Footer,
  Heading,
  KeyboardAwareScrollView,
  KeyboardScreen,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useAccountStore } from '@/store/account';

export default function SignUpScreen() {
  const { top } = useScreenInsets();
  const setPendingSignUp = useAccountStore((s) => s.setPendingSignUp);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [area, setArea] = useState<Area>(DEFAULT_AREA);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = isEmail(email);
  const canSubmit = !!name.trim() && emailValid;

  const submit = async () => {
    if (!canSubmit) {
      setTried(true);
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendSignInCode(email);
      setPendingSignUp({ name: name.trim(), email: email.trim().toLowerCase(), area });
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

        <SectionLabel className="mb-2.5 mt-[18px]">Your area</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          {AREA_NAMES.map((a) => (
            <Chip key={a} label={a} selected={a === area} onPress={() => setArea(a)} />
          ))}
        </View>
        {error ? <Text className="mt-4 font-sans text-[13.5px] text-danger">{error}</Text> : null}
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
