import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { sendSignInCode, verifySignInCode } from '@/api/auth';
import { api, errorMessage, unwrap } from '@/api/client';
import { keys } from '@/api/queries';
import { BackButton, Button, Heading, KeyboardScreen } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { cn } from '@/lib/cn';
import { useAccountStore } from '@/store/account';
import { useUiStore } from '@/store/ui';
import { colors } from '@/theme';

const CODE_LENGTH = 6;
const RESEND_AFTER_S = 30;

/** "Check your email": enter the 6-digit code. Not in the original design; same visual language. */
export default function VerifyScreen() {
  const { top, bottom } = useScreenInsets();
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const qc = useQueryClient();
  const pending = useAccountStore((s) =>
    s.pendingSignUp?.email === email ? s.pendingSignUp : null,
  );

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(RESEND_AFTER_S);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const verify = async (otp: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await verifySignInCode(email, otp, pending?.name);
      const store = useAccountStore.getState();
      if (pending) {
        // New account: save the town picked on Sign up before onboarding.
        const me = await unwrap(api.me.$patch({ json: { placeId: pending.placeId } }));
        qc.setQueryData(keys.me, me);
        store.setPendingSignUp(null);
      } else {
        // Returning user: the "Picked for you" deck opens once they land in the app.
        useUiStore.getState().requestPicks();
      }
      store.remember({
        email,
        name: user.name,
        area: pending?.area ?? store.remembered?.area ?? 'Sri Lanka',
      });
      // The root navigator switches screens when the session updates.
    } catch (err) {
      setError(errorMessage(err));
      setCode('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const onChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) void verify(digits);
  };

  const resend = async () => {
    setError(null);
    try {
      await sendSignInCode(email);
      setResendIn(RESEND_AFTER_S);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <View className="flex-1 px-[22px]" style={{ paddingTop: top(56), paddingBottom: bottom(34) }}>
        <BackButton
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
        />
        <Heading size="hero" className="mt-6">
          Check your email
        </Heading>
        <Text className="mt-3 font-sans text-[16px] leading-[23px] text-muted">
          We sent a 6-digit code to <Text className="text-ink">{email}</Text>. It expires in 5
          minutes.
        </Text>

        {/* One hidden input drives six boxes, so paste and SMS-style autofill both work. */}
        <Pressable onPress={() => input.current?.focus()} className="mt-8 flex-row justify-between">
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <View
              key={i}
              className={cn(
                'h-[60px] w-[48px] items-center justify-center rounded-2xl border bg-surface-sunken',
                i === code.length && !busy ? 'border-lime' : 'border-field',
              )}
            >
              <Text className="font-mono-medium text-[24px] text-ink">{code[i] ?? ''}</Text>
            </View>
          ))}
        </Pressable>
        <TextInput
          ref={input}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          autoFocus
          caretHidden
          selectionColor={colors.lime}
          accessibilityLabel="Sign-in code"
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
        />
        {error ? <Text className="mt-3 font-sans text-[13.5px] text-danger">{error}</Text> : null}

        <View className="flex-1" />
        <Button
          label={busy ? 'Checking…' : 'Continue'}
          inactive={code.length < CODE_LENGTH || busy}
          onPress={() => code.length === CODE_LENGTH && verify(code)}
        />
        <Button
          label={resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
          variant="ghost"
          size="md"
          weight="medium"
          disabled={resendIn > 0}
          onPress={resend}
          className="mt-2.5"
        />
      </View>
    </KeyboardScreen>
  );
}
