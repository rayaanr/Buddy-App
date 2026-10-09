import { clockLabel } from '@buddy/shared';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { ChatItem } from '@/api/chat';
import { Avatar, DoubleTickIcon, TickIcon } from '@/components/ui';
import { colors } from '@/theme';

export interface ChatRow extends ChatItem {
  /** First message in a run from the same sender. */
  startsRun: boolean;
  /** Extra space above when the sender changes. */
  gap: number;
  /** Delivery status line under your message. */
  showMeta: boolean;
}

/** Groups consecutive messages and decides where to show names and receipts. */
export function toChatRows(items: ChatItem[]): ChatRow[] {
  let prev: string | null = null;
  const keyOf = (i: ChatItem) =>
    i.message.kind === 'system' ? '#system' : i.mine ? '#me' : (i.message.sender?.id ?? '?');
  const lastMine = items.map((i) => i.mine && i.message.kind === 'user').lastIndexOf(true);

  return items.map((item, k) => {
    const key = keyOf(item);
    const startsRun = key !== prev;
    const gap = startsRun && prev ? 8 : 0;
    prev = key;
    const showMeta =
      item.mine && (k === lastMine || item.status === 'sending' || item.status === 'failed');
    return { ...item, startsRun, gap, showMeta };
  });
}

const openUser = (id: string) => router.push(`/user/${id}`);

export function MessageBubble({ row, onRetry }: { row: ChatRow; onRetry: (id: string) => void }) {
  const { message: m, mine, status, startsRun, gap, showMeta } = row;

  if (m.kind === 'system') {
    return <Text className="my-1.5 self-center font-sans text-[12.5px] text-subtle">{m.body}</Text>;
  }

  if (!mine) {
    const sender = m.sender;
    return (
      <View className="max-w-[84%] flex-row items-end gap-2 self-start" style={{ marginTop: gap }}>
        <Avatar
          uri={sender?.avatarUrl ?? undefined}
          size={30}
          hidden={!startsRun}
          onPress={sender ? () => openUser(sender.id) : undefined}
          accessibilityLabel={sender ? `View ${sender.name}’s profile` : undefined}
        />
        <View className="min-w-0 shrink gap-[5px]">
          {startsRun && sender ? (
            <Pressable
              onPress={() => openUser(sender.id)}
              hitSlop={6}
              className="ml-1.5 self-start"
            >
              <Text className="font-sans-medium text-[13px] text-muted">{sender.name}</Text>
            </Pressable>
          ) : null}
          <View className="rounded-[18px] rounded-bl-md bg-surface px-4 py-3">
            <Text className="font-sans text-[15.5px] leading-[21.5px] text-ink">{m.body}</Text>
          </View>
        </View>
      </View>
    );
  }

  const time = clockLabel(new Date(m.createdAt));
  const meta =
    status === 'sending'
      ? 'Sending…'
      : status === 'failed'
        ? 'Not sent · Tap to retry'
        : status === 'seen'
          ? `Seen · ${time}`
          : time;

  return (
    <View className="max-w-[78%] items-end self-end" style={{ marginTop: gap }}>
      <Pressable
        disabled={status !== 'failed'}
        onPress={() => onRetry(m.id)}
        accessibilityRole={status === 'failed' ? 'button' : undefined}
        accessibilityHint={status === 'failed' ? 'Sends the message again' : undefined}
      >
        <View
          className="rounded-[18px] rounded-br-md bg-lime px-4 py-3"
          style={{ opacity: status === 'sending' || status === 'failed' ? 0.6 : 1 }}
        >
          <Text className="font-sans text-[15.5px] leading-[21.5px] text-bg">{m.body}</Text>
        </View>
      </Pressable>
      {showMeta ? (
        <View className="mr-1 mt-[5px] flex-row items-center gap-[5px]">
          <Text
            className="font-sans text-[12px]"
            style={{ color: status === 'failed' ? colors.danger : colors.subtle }}
          >
            {meta}
          </Text>
          {status === 'sent' ? <TickIcon color={colors.muted} /> : null}
          {status === 'seen' ? <DoubleTickIcon /> : null}
        </View>
      ) : null}
    </View>
  );
}
