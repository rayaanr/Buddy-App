import { LIMITS, type MessagesPage, pollInput } from '@buddy/shared';
import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api, errorMessage, unwrap } from '@/api/client';
import { keys } from '@/api/queries';
import {
  Button,
  CloseIcon,
  Footer,
  Heading,
  KeyboardAwareScrollView,
  KeyboardScreen,
  PlusIcon,
  SectionLabel,
  TextField,
  Toggle,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

/**
 * Ask the group something: a question and 2–6 options, sent into the chat.
 * Params: `kind` ("activity" or "community") and `id` of the chat.
 */
export default function NewPollScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: 'activity' | 'community'; id: string }>();
  const { top } = useScreenInsets();
  const qc = useQueryClient();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [busy, setBusy] = useState(false);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const valid = pollInput.safeParse({ question, options: filled, multiple }).success;

  const setOption = (k: number, text: string) =>
    setOptions((list) => list.map((o, i) => (i === k ? text : o)));

  const send = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const chat = kind === 'community' ? api.communities[':id'].chat : api.activities[':id'].chat;
      const message = await unwrap(
        chat.messages.$post({
          param: { id },
          json: { id: randomUUID(), poll: { question, options: filled, multiple } },
        }),
      );
      // Show it in the chat straight away (it also arrives live).
      qc.setQueryData<MessagesPage>(keys.messages(id), (page) =>
        page && !page.messages.some((m) => m.id === message.id)
          ? { ...page, messages: [...page.messages, message] }
          : page,
      );
      router.back();
    } catch (err) {
      toast(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: top(58), paddingHorizontal: 22, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} hitSlop={8} className="self-start py-1.5">
          <Text className="font-sans text-[16px] text-muted">Cancel</Text>
        </Pressable>
        <Heading size="page" className="mt-4">
          New poll
        </Heading>

        <SectionLabel className="mb-2.5 mt-6">Question</SectionLabel>
        <TextField
          value={question}
          onChangeText={setQuestion}
          placeholder="Which day works best?"
          maxLength={LIMITS.pollQuestionMax}
          size="md"
          autoFocus
        />

        <SectionLabel className="mb-2.5 mt-6">Options</SectionLabel>
        <View className="gap-2.5">
          {options.map((o, k) => (
            <View key={k} className="flex-row items-center gap-2">
              <View className="flex-1">
                <TextField
                  value={o}
                  onChangeText={(t) => setOption(k, t)}
                  placeholder={`Option ${k + 1}`}
                  maxLength={LIMITS.pollOptionMax}
                  size="md"
                  accessibilityLabel={`Option ${k + 1}`}
                />
              </View>
              {options.length > LIMITS.pollOptionsMin ? (
                <Pressable
                  onPress={() => setOptions((list) => list.filter((_, i) => i !== k))}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove option ${k + 1}`}
                  hitSlop={6}
                  className="h-10 w-10 items-center justify-center rounded-full active:bg-surface"
                >
                  <CloseIcon color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
        {options.length < LIMITS.pollOptionsMax ? (
          <Pressable
            onPress={() => setOptions((list) => [...list, ''])}
            accessibilityRole="button"
            hitSlop={8}
            className="mt-3.5 flex-row items-center gap-2 self-start active:opacity-70"
          >
            <PlusIcon size={17} color={colors.lime} />
            <Text className="font-sans-medium text-[14.5px] text-lime">Add an option</Text>
          </Pressable>
        ) : null}

        <View className="mt-7 flex-row items-center justify-between gap-4">
          <View className="flex-1">
            <Text className="font-sans text-[15.5px] text-ink">Let people pick more than one</Text>
            <Text className="mt-0.5 font-sans text-[13px] text-muted">
              Good for “which days can you make?”
            </Text>
          </View>
          <Toggle value={multiple} onValueChange={setMultiple} label="Allow more than one answer" />
        </View>
      </KeyboardAwareScrollView>

      <Footer>
        <Button
          label={busy ? 'Sending…' : 'Send poll'}
          inactive={!valid || busy}
          onPress={() => void send()}
        />
      </Footer>
    </KeyboardScreen>
  );
}
