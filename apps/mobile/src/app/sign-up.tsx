import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { isEmail } from '@/api/auth';
import {
  BackButton,
  Button,
  Footer,
  Heading,
  KeyboardAwareScrollView,
  KeyboardScreen,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { PRIVACY_URL, TERMS_URL } from '@/config';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useSendCode } from '@/hooks/useSendCode';
import { useAccountStore } from '@/store/account';

/** Just an email: name, town and interests come after the code, and can be skipped. */
export default function SignUpScreen() {
  const { top } = useScreenInsets();
  const setPendingSignUp = useAccountStore((s) => s.setPendingSignUp);

  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const { send, sending, error } = useSendCode((normalised) =>
    setPendingSignUp({ email: normalised }),
  );
  const emailValid = isEmail(email);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));

  const submit = () => {
    if (!emailValid) {
      setTried(true);
      return;
    }
    send(email);
  };

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: top(56), paddingHorizontal: 22, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton onPress={leave} />
        <Heading size="hero" className="mt-6">
          Create your account
        </Heading>
        <Text className="mt-3 font-sans text-[16px] leading-[23px] text-muted">
          Just your email for now. You can add your name, town and interests next.
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
          returnKeyType="send"
          onSubmitEditing={submit}
        />
        {tried && !emailValid ? (
          <Text className="mt-2 font-sans text-[13.5px] text-danger">
            Enter a valid email address.
          </Text>
        ) : null}
        <Text className="mt-2 font-sans text-[13.5px] leading-[19px] text-muted">
          We’ll email you a 6-digit code. No password needed.
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
          inactive={!emailValid || sending}
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
