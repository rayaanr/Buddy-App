import { clockLabel, isDeletedAccount } from '@buddy/shared';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatItem, MessageStatus } from '@/api/chat';
import { AnimatedView, Avatar, DoubleTickIcon, TickIcon, useEnterOnChange } from '@/components/ui';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';
import { ChatPhoto } from './ChatPhoto';
import { MessageText } from './MessageText';
import { PollCard } from './PollCard';

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

interface MessageBubbleProps {
  row: ChatRow;
  myId: string | undefined;
  onRetry: (id: string) => void;
  onVote: (messageId: string, optionIds: string[]) => void;
  onOpenPhoto: (url: string) => void;
  /** Long-pressing someone else's message offers to report it. */
  onReport: (message: ChatRow['message']) => void;
}

/** Memoised: the thread re-renders as messages arrive, but unchanged rows don't. */
export const MessageBubble = memo(function MessageBubble({
  row,
  myId,
  onRetry,
  onVote,
  onOpenPhoto,
  onReport,
}: MessageBubbleProps) {
  const { message: m, mine, status, startsRun, gap, showMeta } = row;

  if (m.kind === 'system') {
    return <Text className="my-1.5 self-center font-sans text-[12.5px] text-subtle">{m.body}</Text>;
  }

  if (!mine) {
    const sender = m.sender;
    // Someone who deleted their account has no profile to open or report.
    const person = sender && !isDeletedAccount(sender) ? sender : null;
    return (
      <View className="max-w-[84%] flex-row items-end gap-2 self-start" style={{ marginTop: gap }}>
        <Avatar
          uri={sender?.avatarUrl ?? undefined}
          name={sender && !isDeletedAccount(sender) ? sender.name : undefined}
          size={30}
          hidden={!startsRun}
          onPress={person ? () => openUser(person.id) : undefined}
          accessibilityLabel={person ? `View ${person.name}’s profile` : undefined}
        />
        <View className="min-w-0 shrink gap-[5px]">
          {startsRun && sender ? (
            <Pressable
              disabled={!person}
              onPress={person ? () => openUser(person.id) : undefined}
              hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
              accessibilityRole={person ? 'button' : undefined}
              accessibilityLabel={person ? `View ${person.name}’s profile` : undefined}
              className="ml-1.5 self-start"
            >
              <Text className="font-sans-medium text-[13px] text-muted">{sender.name}</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={!person}
            onLongPress={() => onReport(m)}
            delayLongPress={350}
            accessibilityHint={person ? 'Long press to report this message' : undefined}
            accessibilityActions={person ? [{ name: 'longpress', label: 'Report message' }] : []}
            onAccessibilityAction={() => onReport(m)}
            className={cn(
              'active:opacity-80',
              !m.poll && 'overflow-hidden rounded-[18px] rounded-bl-md bg-surface',
              !m.poll && !m.image && !m.photoExpired && 'px-4 py-3',
            )}
          >
            <Content
              message={m}
              mine={false}
              myId={myId}
              onVote={onVote}
              onOpenPhoto={onOpenPhoto}
            />
          </Pressable>
        </View>
      </View>
    );
  }

  // Only a failed message is a button (tap to retry): wrapping the others in a
  // disabled one would block their photo and poll taps on web.
  const bubble = (
    <View
      className={cn(
        !m.poll && 'overflow-hidden rounded-[18px] rounded-br-md bg-lime',
        !m.poll && !m.image && !m.photoExpired && 'px-4 py-3',
      )}
      style={{ opacity: status === 'sending' || status === 'failed' ? 0.6 : 1 }}
    >
      <Content
        message={m}
        mine
        myId={myId}
        // Votes wait until the poll has been saved.
        onVote={status === 'sending' || status === 'failed' ? undefined : onVote}
        onOpenPhoto={onOpenPhoto}
      />
    </View>
  );

  return (
    <View className="max-w-[78%] items-end self-end" style={{ marginTop: gap }}>
      {status === 'failed' ? (
        <Pressable
          onPress={() => onRetry(m.id)}
          accessibilityRole="button"
          accessibilityHint="Sends the message again"
        >
          {bubble}
        </Pressable>
      ) : (
        bubble
      )}
      {showMeta && status ? <MessageMeta status={status} createdAt={m.createdAt} /> : null}
    </View>
  );
});

/** What's in a bubble: a photo and/or text (with @mentions), or a poll. */
function Content({
  message: m,
  mine,
  myId,
  onVote,
  onOpenPhoto,
}: {
  message: ChatRow['message'];
  mine: boolean;
  myId: string | undefined;
  onVote?: (messageId: string, optionIds: string[]) => void;
  onOpenPhoto: (url: string) => void;
}) {
  if (m.poll)
    return (
      <PollCard
        poll={m.poll}
        myId={myId}
        onVote={onVote ? (ids) => onVote(m.id, ids) : undefined}
      />
    );
  return (
    <>
      {m.image ? <ChatPhoto image={m.image} onOpen={onOpenPhoto} /> : null}
      {m.photoExpired ? (
        <View
          className={cn(
            'h-[72px] w-[240px] items-center justify-center',
            mine ? 'bg-black/10' : 'bg-surface-raised',
          )}
        >
          <Text className={cn('font-sans text-[13px]', mine ? 'text-bg/70' : 'text-subtle')}>
            Photo no longer available
          </Text>
        </View>
      ) : null}
      {m.body ? (
        <View className={m.image || m.photoExpired ? 'max-w-[240px] px-3.5 py-2.5' : undefined}>
          <MessageText body={m.body} mentions={m.mentions} mine={mine} />
        </View>
      ) : null}
    </>
  );
}

/**
 * "Sending… → Sent → Seen" under your latest message, easing in as it
 * changes. Its own component so only that row holds the animation.
 */
function MessageMeta({ status, createdAt }: { status: MessageStatus; createdAt: string }) {
  const style = useEnterOnChange(status);
  const time = clockLabel(new Date(createdAt));
  const meta =
    status === 'sending'
      ? 'Sending…'
      : status === 'failed'
        ? 'Not sent · Tap to retry'
        : status === 'seen'
          ? `Seen · ${time}`
          : time;
  return (
    <AnimatedView style={[styles.meta, style]}>
      <Text
        className="font-sans text-[12px]"
        style={{ color: status === 'failed' ? colors.danger : colors.subtle }}
      >
        {meta}
      </Text>
      {status === 'sent' ? <TickIcon color={colors.muted} /> : null}
      {status === 'seen' ? <DoubleTickIcon /> : null}
    </AnimatedView>
  );
}

// Style objects, not classes: NativeWind doesn't style Reanimated views.
const styles = StyleSheet.create({
  meta: { marginRight: 4, marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
});
