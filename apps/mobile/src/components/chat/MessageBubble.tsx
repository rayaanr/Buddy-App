import { clockLabel, isDeletedAccount, type Reaction } from '@buddy/shared';
import { router } from 'expo-router';
import { memo, type ReactNode, useRef } from 'react';
import {
  type GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { ChatItem, MessageStatus } from '@/api/chat';
import {
  AnimatedView,
  Avatar,
  DoubleTickIcon,
  ReplyIcon,
  selectionHaptic,
  TickIcon,
  useEnterOnChange,
} from '@/components/ui';
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
  /** Long-press: reactions, Reply, Report. `y` is where on screen. */
  onActions: (message: ChatRow['message'], mine: boolean, y: number) => void;
  onReact: (messageId: string, emoji: Reaction | null) => void;
  onReply: (message: ChatRow['message']) => void;
  /** Tapping a quote scrolls to the message it quotes. */
  onJumpTo: (messageId: string) => void;
}

/** Memoised: the thread re-renders as messages arrive, but unchanged rows don't. */
export const MessageBubble = memo(function MessageBubble({
  row,
  myId,
  onRetry,
  onVote,
  onOpenPhoto,
  onActions,
  onReact,
  onReply,
  onJumpTo,
}: MessageBubbleProps) {
  const { message: m, mine, status, startsRun, gap, showMeta } = row;

  if (m.kind === 'system') {
    return <Text className="my-1.5 self-center font-sans text-[12.5px] text-subtle">{m.body}</Text>;
  }

  // Only saved messages can be reacted or replied to.
  const saved = status !== 'sending' && status !== 'failed';
  const longPress = saved
    ? (e: GestureResponderEvent) => onActions(m, mine, e.nativeEvent.pageY)
    : undefined;
  const content = (
    <Content
      message={m}
      mine={mine}
      myId={myId}
      // Votes wait until the poll has been saved.
      onVote={saved ? onVote : undefined}
      onOpenPhoto={onOpenPhoto}
      onLongPress={longPress}
      onJumpTo={onJumpTo}
    />
  );
  const reactions = m.reactions.length ? (
    <Reactions message={m} myId={myId} mine={mine} onReact={onReact} />
  ) : null;

  if (!mine) {
    const sender = m.sender;
    // Someone who deleted their account has no profile to open.
    const person = sender && !isDeletedAccount(sender) ? sender : null;
    return (
      <SwipeToReply onReply={() => onReply(m)} enabled={saved}>
        <View
          className="max-w-[84%] flex-row items-end gap-2 self-start"
          style={{ marginTop: gap }}
        >
          <Avatar
            uri={sender?.avatarUrl ?? undefined}
            name={sender && !isDeletedAccount(sender) ? sender.name : undefined}
            size={30}
            hidden={!startsRun}
            onPress={person ? () => openUser(person.id) : undefined}
            accessibilityLabel={person ? `View ${person.name}’s profile` : undefined}
            style={reactions ? { marginBottom: 26 } : undefined}
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
              onLongPress={longPress}
              delayLongPress={350}
              accessibilityHint="Long press to react, reply or report"
              className={cn(
                'self-start active:opacity-80',
                !m.poll && 'overflow-hidden rounded-[18px] rounded-bl-md bg-surface',
                !m.poll && !m.image && !m.photoExpired && 'px-4 py-3',
              )}
            >
              {content}
            </Pressable>
            {reactions}
          </View>
        </View>
      </SwipeToReply>
    );
  }

  return (
    <SwipeToReply onReply={() => onReply(m)} enabled={saved}>
      <View className="max-w-[78%] items-end self-end" style={{ marginTop: gap }}>
        <Pressable
          // A failed message is tapped to retry; the rest are long-pressed for actions.
          onPress={status === 'failed' ? () => onRetry(m.id) : undefined}
          onLongPress={longPress}
          delayLongPress={350}
          accessibilityRole={status === 'failed' ? 'button' : undefined}
          accessibilityHint={
            status === 'failed' ? 'Sends the message again' : 'Long press to react or reply'
          }
          className={cn(
            !m.poll && 'overflow-hidden rounded-[18px] rounded-br-md bg-lime',
            !m.poll && !m.image && !m.photoExpired && 'px-4 py-3',
          )}
          style={{ opacity: saved ? 1 : 0.6 }}
        >
          {content}
        </Pressable>
        {reactions}
        {showMeta && status ? <MessageMeta status={status} createdAt={m.createdAt} /> : null}
      </View>
    </SwipeToReply>
  );
});

/** What's in a bubble: a quote, then a photo and/or text (with @mentions), or a poll. */
function Content({
  message: m,
  mine,
  myId,
  onVote,
  onOpenPhoto,
  onLongPress,
  onJumpTo,
}: {
  message: ChatRow['message'];
  mine: boolean;
  myId: string | undefined;
  onVote?: (messageId: string, optionIds: string[]) => void;
  onOpenPhoto: (url: string) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  onJumpTo: (messageId: string) => void;
}) {
  if (m.poll)
    return (
      <PollCard
        poll={m.poll}
        myId={myId}
        onVote={onVote ? (ids) => onVote(m.id, ids) : undefined}
      />
    );
  const quote = m.replyTo ? (
    <Quote
      quote={m.replyTo}
      mine={mine}
      onPress={() => onJumpTo(m.replyTo!.id)}
      // Inside a photo bubble the quote needs its own padding.
      padded={!!(m.image || m.photoExpired)}
    />
  ) : null;
  return (
    <>
      {quote}
      {m.image ? (
        <ChatPhoto image={m.image} onOpen={onOpenPhoto} onLongPress={onLongPress} />
      ) : null}
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

/** The message being replied to, quoted at the top of the bubble. */
function Quote({
  quote,
  mine,
  padded,
  onPress,
}: {
  quote: NonNullable<ChatRow['message']['replyTo']>;
  mine: boolean;
  padded: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Replying to ${quote.senderName ?? 'a message'}: ${quote.summary}. Show it`}
      className={cn(padded ? 'mx-2 mt-2' : '-mx-1 mb-2', 'max-w-[240px]')}
    >
      <View
        className={cn(
          'rounded-[10px] border-l-[3px] px-2.5 py-1.5',
          mine ? 'border-bg/50 bg-black/10' : 'border-lime bg-surface-raised',
        )}
      >
        <Text
          className={cn('font-sans-semibold text-[12.5px]', mine ? 'text-bg' : 'text-lime')}
          numberOfLines={1}
        >
          {quote.senderName ?? 'Deleted account'}
        </Text>
        <Text
          className={cn('font-sans text-[13px] leading-[18px]', mine ? 'text-bg/80' : 'text-muted')}
          numberOfLines={2}
        >
          {quote.summary}
        </Text>
      </View>
    </Pressable>
  );
}

/** Reaction pills under a message; tap one to add or take back yours. */
function Reactions({
  message: m,
  myId,
  mine,
  onReact,
}: {
  message: ChatRow['message'];
  myId: string | undefined;
  mine: boolean;
  onReact: (messageId: string, emoji: Reaction | null) => void;
}) {
  return (
    <View className={cn('-mt-1 flex-row flex-wrap gap-1', mine ? 'justify-end' : 'ml-1')}>
      {m.reactions.map((r) => {
        const picked = !!myId && r.userIds.includes(myId);
        return (
          <Pressable
            key={r.emoji}
            onPress={() => onReact(m.id, picked ? null : r.emoji)}
            accessibilityRole="button"
            accessibilityLabel={`${r.emoji} ${r.userIds.length}${picked ? ', yours. Remove' : ''}`}
            className={cn(
              'h-[26px] flex-row items-center gap-1 rounded-full border px-2 active:opacity-70',
              picked ? 'border-lime bg-lime-deep' : 'border-line bg-surface',
            )}
          >
            <Text style={styles.reaction}>{r.emoji}</Text>
            {r.userIds.length > 1 ? (
              <Text className="font-sans-semibold text-[12px] text-ink-soft">
                {r.userIds.length}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Swipe a message right to reply (phones). On web, long-press → Reply does it:
 * a swipe there would fight text selection.
 */
function SwipeToReply({
  children,
  onReply,
  enabled,
}: {
  children: ReactNode;
  onReply: () => void;
  enabled: boolean;
}) {
  const swipeable = useRef<SwipeableMethods>(null);
  if (Platform.OS === 'web' || !enabled) return children;
  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      leftThreshold={56}
      overshootLeft={false}
      renderLeftActions={() => (
        <View className="w-14 items-center justify-center">
          <ReplyIcon color={colors.lime} />
        </View>
      )}
      onSwipeableWillOpen={(direction) => {
        if (direction === 'left') {
          selectionHaptic();
          onReply();
        }
        // Spring back: it's a gesture, not a drawer that stays open.
        swipeable.current?.close();
      }}
    >
      {children}
    </ReanimatedSwipeable>
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
  reaction: { fontSize: 14 },
  meta: { marginRight: 4, marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
});
