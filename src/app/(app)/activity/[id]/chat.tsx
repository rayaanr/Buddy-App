import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { MessageBubble, toChatRows, type ChatRow } from '@/components/chat/MessageBubble';
import { BackButton } from '@/components/ui';
import { NotFound } from '@/components/ui/NotFound';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { whenLong } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { sendMessage } from '@/services/chat';
import { useActivity } from '@/store/activities';
import { useUiStore } from '@/store/ui';
import { colors } from '@/theme';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activity = useActivity(id);
  const typing = useUiStore((s) => (s.typing?.activityId === id ? s.typing.from : null));
  const { top, bottom } = useScreenInsets();
  const [text, setText] = useState('');

  const list = useRef<FlatList<ChatRow>>(null);
  const rows = useMemo(() => (activity ? toChatRows(activity.messages) : []), [activity]);

  if (!activity) return <NotFound message="This chat is no longer available." />;

  const canSend = !!text.trim();
  const send = () => {
    if (!canSend) return;
    sendMessage(activity.id, text);
    setText('');
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        className="flex-row items-center gap-3.5 border-b border-line px-[18px] pb-3"
        style={{ paddingTop: top(56) }}
      >
        <BackButton />
        <View className="min-w-0 flex-1">
          <Text className="font-sans-semibold text-[16.5px] text-ink" numberOfLines={1}>
            {activity.title}
          </Text>
          <Text className="mt-0.5 font-sans text-[13px] text-muted">
            {activity.going} of {activity.capacity} going
          </Text>
        </View>
      </View>

      <FlatList
        ref={list}
        data={rows}
        keyExtractor={(r) => r.message.id}
        renderItem={({ item }) => <MessageBubble row={item} />}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18, gap: 6 }}
        // Keep the latest message (and typing indicator) in view as the thread grows.
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Pressable
            onPress={() => router.push(`/activity/${activity.id}`)}
            className="mb-2 flex-row justify-between rounded-[14px] border border-lime-panel-border bg-lime-panel px-4 py-3.5 active:opacity-80"
          >
            <Text className="font-sans-medium text-[14.5px] text-lime">{whenLong(activity)}</Text>
            <Text className="font-sans-medium text-[14.5px] text-ink-soft">{activity.place}</Text>
          </Pressable>
        }
        ListFooterComponent={
          typing ? (
            <View className="mt-1.5 self-start rounded-2xl bg-surface px-3.5 py-2.5">
              <Text className="font-sans text-[13.5px] text-muted">{typing} is typing…</Text>
            </View>
          ) : null
        }
      />

      <View
        className="flex-row gap-2.5 border-t border-line px-3.5 pt-3"
        style={{ paddingBottom: bottom(28) }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          submitBehavior="submit"
          returnKeyType="send"
          placeholder="Message the group"
          placeholderTextColor={colors.subtle}
          selectionColor={colors.lime}
          className="h-[50px] min-w-0 flex-1 rounded-[25px] border border-field bg-surface px-5 font-sans text-[15.5px] text-ink"
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send"
          className={cn(
            'h-[50px] items-center justify-center rounded-[25px] px-5 active:opacity-80',
            canSend ? 'bg-lime' : 'bg-disabled',
          )}
        >
          <Text
            className={cn('font-sans-semibold text-[15px]', canSend ? 'text-bg' : 'text-muted')}
          >
            Send
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
