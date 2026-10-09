import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Avatar, DoubleTickIcon, TickIcon } from '@/components/ui';
import { getUser } from '@/data/users';
import { colors } from '@/theme';
import type { ChatMessage } from '@/types/models';

export interface ChatRow {
  message: ChatMessage;
  /** First message in a run from the same sender. */
  startsRun: boolean;
  /** Extra space above when the sender changes. */
  gap: number;
  /** Delivery status line under your message. */
  showMeta: boolean;
}

/** Groups consecutive messages and decides where to show names and receipts. */
export function toChatRows(messages: ChatMessage[]): ChatRow[] {
  let prev: string | null = null;
  const keyOf = (m: ChatMessage) => (m.kind === 'other' ? m.from : `#${m.kind}`);
  let lastMine = -1;
  messages.forEach((m, k) => m.kind === 'me' && (lastMine = k));

  return messages.map((message, k) => {
    const key = keyOf(message);
    const startsRun = key !== prev;
    const gap = startsRun && prev ? 8 : 0;
    prev = key;
    const showMeta = message.kind === 'me' && (k === lastMine || message.status === 'sending');
    return { message, startsRun, gap, showMeta };
  });
}

const openUser = (name: string) => router.push({ pathname: '/user/[name]', params: { name } });

export function MessageBubble({ row }: { row: ChatRow }) {
  const { message: m, startsRun, gap, showMeta } = row;

  if (m.kind === 'system') {
    return <Text className="my-1.5 self-center font-sans text-[12.5px] text-subtle">{m.text}</Text>;
  }

  if (m.kind === 'other') {
    return (
      <View className="max-w-[84%] flex-row items-end gap-2 self-start" style={{ marginTop: gap }}>
        <Avatar
          uri={getUser(m.from).avatar}
          size={30}
          hidden={!startsRun}
          onPress={() => openUser(m.from)}
          accessibilityLabel={`View ${m.from}’s profile`}
        />
        <View className="min-w-0 shrink gap-[5px]">
          {startsRun ? (
            <Pressable onPress={() => openUser(m.from)} hitSlop={6} className="ml-1.5 self-start">
              <Text className="font-sans-medium text-[13px] text-muted">{m.from}</Text>
            </Pressable>
          ) : null}
          <View className="rounded-[18px] rounded-bl-md bg-surface px-4 py-3">
            <Text className="font-sans text-[15.5px] leading-[21.5px] text-ink">{m.text}</Text>
          </View>
        </View>
      </View>
    );
  }

  const sending = m.status === 'sending';
  const meta = sending
    ? 'Sending…'
    : m.status === 'seen'
      ? `Seen${m.time ? ` · ${m.time}` : ''}`
      : (m.time ?? 'Sent');

  return (
    <View className="max-w-[78%] items-end self-end" style={{ marginTop: gap }}>
      <View
        className="rounded-[18px] rounded-br-md bg-lime px-4 py-3"
        style={{ opacity: sending ? 0.6 : 1 }}
      >
        <Text className="font-sans text-[15.5px] leading-[21.5px] text-bg">{m.text}</Text>
      </View>
      {showMeta ? (
        <View className="mr-1 mt-[5px] flex-row items-center gap-[5px]">
          <Text className="font-sans text-[12px] text-subtle">{meta}</Text>
          {m.status === 'sent' ? <TickIcon color={colors.muted} /> : null}
          {m.status === 'seen' ? <DoubleTickIcon /> : null}
        </View>
      ) : null}
    </View>
  );
}
