import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { BrandMark, Button, Chip, Footer, Heading, SectionLabel, TextField } from '@/components/ui';
import { DEFAULT_AREA, SIGNUP_AREAS } from '@/data/constants';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useSessionStore } from '@/store/session';

const PHONE_DIGITS = 9;

/** Strips formatting and a leading trunk 0, so "077 123 4567" and "77 123 4567" both validate. */
const normalisePhone = (raw: string) => raw.replace(/\D/g, '').replace(/^0/, '');

export default function SignUpScreen() {
  const { top } = useScreenInsets();
  const createAccount = useSessionStore((s) => s.createAccount);
  const restoreAccount = useSessionStore((s) => s.restoreAccount);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState<string>(DEFAULT_AREA);
  const [tried, setTried] = useState(false);

  const phoneValid = normalisePhone(phone).length === PHONE_DIGITS;
  const canSubmit = !!name.trim() && phoneValid;

  const submit = () => {
    if (!canSubmit) {
      setTried(true);
      return;
    }
    createAccount(name, area);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
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

        <SectionLabel className="mb-2 mt-[18px]">Mobile number</SectionLabel>
        <View className="flex-row gap-2">
          <View className="h-[54px] justify-center rounded-2xl border border-field bg-surface-sunken px-4">
            <Text className="font-mono-medium text-[16px] text-ink-soft">+94</Text>
          </View>
          <TextField
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/[^\d ]/g, '').slice(0, 12))}
            placeholder="77 123 4567"
            keyboardType="number-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            mono
            className="min-w-0 flex-1"
          />
        </View>
        {tried && !phoneValid ? (
          <Text className="mt-2 font-sans text-[13.5px] text-danger">
            Enter a 9-digit mobile number.
          </Text>
        ) : null}

        <SectionLabel className="mb-2.5 mt-[18px]">Your area</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          {SIGNUP_AREAS.map((a) => (
            <Chip key={a} label={a} selected={a === area} onPress={() => setArea(a)} />
          ))}
        </View>
      </ScrollView>

      <Footer>
        <Button label="Create account" inactive={!canSubmit} onPress={submit} />
        <View className="mt-3.5 flex-row justify-center gap-1.5">
          <Text className="font-sans text-[14.5px] text-muted">Already on Buddy?</Text>
          <Pressable onPress={restoreAccount} accessibilityRole="link" hitSlop={8}>
            <Text className="font-sans-medium text-[14.5px] text-lime">Sign in</Text>
          </Pressable>
        </View>
      </Footer>
    </KeyboardAvoidingView>
  );
}
