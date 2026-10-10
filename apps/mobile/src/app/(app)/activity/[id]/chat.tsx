import type { ChatMessage } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View, type ListRenderItem } from 'react-native';

import { useChat } from '@/api/chat';
import { ApiRequestError } from '@/api/client';
import { useActivity, useMe } from '@/api/queries';
import { MessageBubble, toChatRows, type ChatRow } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import {
  AnimatedView,
  BackButton,
  KeyboardScreen,
  LoadError,
  Loading,
  PressableScale,
} from '@/components/ui';
import { NotFound } from '@/components/ui/NotFound';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { whenLong } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';
import { enterMessage } from '@/theme/motion';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const activity = useActivity(id);
  const chat = useChat(id, me.data?.id);
  const { top } = useScreenInsets();

  // Newest first: the list is inverted, so the latest message sits at the
  // bottom and stays there as messages arrive, without scrolling by hand.
  const rows = useMemo(() => toChatRows(chat.items).reverse(), [chat.items]);

  // Messages already here when the chat opened appear as-is; new ones animate in.
  const [openedWith, setOpenedWith] = useState<Set<string> | null>(null);
  if (openedWith === null && !chat.isLoading && !chat.error) {
    setOpenedWith(new Set(chat.items.map((i) => i.message.id)));
  }

  const reportMessage = useCallback(
    (m: ChatMessage) =>
      router.push({ pathname: '/report', params: { type: 'message', id: m.id, activityId: id } }),
    [id],
  );
  const { retry } = chat;
  const renderItem = useCallback<ListRenderItem<ChatRow>>(
    ({ item }) => (
      <AnimatedView
        entering={openedWith && !openedWith.has(item.message.id) ? enterMessage : undefined}
      >
        <MessageBubble row={item} onRetry={retry} onReport={reportMessage} />
      </AnimatedView>
    ),
    [openedWith, retry, reportMessage],
  );

  const status = chat.error instanceof ApiRequestError ? chat.error.status : null;
  if (status === 403) return <NotFound message="Join this activity to see its chat." />;
  if (status === 404) return <NotFound message="This chat is no longer available." />;

  const a = activity.data;

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <View
        className="flex-row items-center gap-3.5 border-b border-line px-[18px] pb-3"
        style={{ paddingTop: top(56) }}
      >
        <BackButton />
        <View className="min-w-0 flex-1">
          <Text className="font-sans-semibold text-[16.5px] text-ink" numberOfLines={1}>
            {a?.title ?? ''}
          </Text>
          <Text className="mt-0.5 font-sans text-[13px] text-muted">
            {a ? `${a.goingCount} of ${a.capacity} going` : ''}
          </Text>
        </View>
      </View>

      {chat.isLoading ? (
        <Loading className="flex-1" />
      ) : chat.error ? (
        <View className="flex-1 justify-center px-[18px]">
          <LoadError error={chat.error} onRetry={() => void chat.refetch()} />
        </View>
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(r) => r.message.id}
          renderItem={renderItem}
          // Inverted: paddingTop is the visual bottom.
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 14,
            gap: 6,
          }}
          // Reading older messages: new ones don't yank the view down. Near
          // the bottom: it follows the conversation.
          maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 80 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          // Inverted: the header shows at the bottom, the footer at the top.
          ListHeaderComponent={chat.typingName ? <TypingIndicator name={chat.typingName} /> : null}
          ListFooterComponent={
            a ? (
              <Pressable
                onPress={() => router.push(`/activity/${a.id}`)}
                className="mb-2 flex-row justify-between rounded-[14px] border border-lime-panel-border bg-lime-panel px-4 py-3.5 active:opacity-80"
              >
                <Text className="font-sans-medium text-[14.5px] text-lime">{whenLong(a)}</Text>
                <Text className="font-sans-medium text-[14.5px] text-ink-soft">{a.place}</Text>
              </Pressable>
            ) : null
          }
        />
      )}

      <Composer
        // Until `me` loads, a send couldn't be attributed: keep the text.
        ready={!!me.data}
        onSend={chat.send}
        onTyping={chat.notifyTyping}
      />
    </KeyboardScreen>
  );
}

/**
 * The message box. Its text lives here, so typing re-renders only this, not
 * every message in the thread.
 */
function Composer({
  ready,
  onSend,
  onTyping,
}: {
  ready: boolean;
  onSend: (text: string) => void;
  onTyping: () => void;
}) {
  const { bottom } = useScreenInsets();
  const [text, setText] = useState('');
  const canSend = ready && !!text.trim();
  const send = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
  };

  return (
    <View
      className="flex-row gap-2.5 border-t border-line px-3.5 pt-3"
      style={{ paddingBottom: bottom(28) }}
    >
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          if (t) onTyping();
        }}
        onSubmitEditing={send}
        submitBehavior="submit"
        returnKeyType="send"
        placeholder="Message the group"
        placeholderTextColor={colors.subtle}
        selectionColor={colors.lime}
        className="h-[50px] min-w-0 flex-1 rounded-[25px] border border-field bg-surface px-5 font-sans text-[15.5px] text-ink"
      />
      <PressableScale
        onPress={send}
        disabled={!canSend}
        haptic="light"
        scale="strong"
        accessibilityRole="button"
        accessibilityLabel="Send"
        className={cn(
          'h-[50px] items-center justify-center rounded-[25px] px-5',
          canSend ? 'bg-lime' : 'bg-disabled',
        )}
      >
        <Text className={cn('font-sans-semibold text-[15px]', canSend ? 'text-bg' : 'text-muted')}>
          Send
        </Text>
      </PressableScale>
    </View>
  );
}
