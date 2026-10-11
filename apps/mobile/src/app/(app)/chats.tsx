import { type ChatPreview, clockLabel, dayMonth, firstName, localDay } from '@buddy/shared';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useChats } from '@/api/queries';
import {
  Avatar,
  BellOffIcon,
  CountBadge,
  EmptyState,
  Heading,
  LoadError,
  Loading,
  Refresh,
  ScreenHeader,
} from '@/components/ui';
import { cn } from '@/lib/cn';

/** Every group chat you're in: activities you're going to and your communities. */
export default function ChatsScreen() {
  const chats = useChats();

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 }}
        refreshControl={
          <Refresh refreshing={chats.isRefetching} onRefresh={() => void chats.refetch()} />
        }
      >
        <Heading size="page">Chats</Heading>
        <View className="mt-3">
          {chats.isLoading ? <Loading className="py-10" /> : null}
          {chats.error ? (
            <LoadError error={chats.error} onRetry={() => void chats.refetch()} />
          ) : null}
          {chats.data?.length === 0 ? (
            <EmptyState
              card
              title="No chats yet"
              subtitle="Join an activity or a community and its group chat shows up here."
              cta="Find something to do"
              onPress={() => router.navigate('/')}
            />
          ) : null}
          {chats.data?.map((c) => (
            <Row key={c.id} chat={c} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** "14:20" today, "18 Oct" before that. */
function when(iso: string) {
  const at = new Date(iso);
  return localDay(at) === localDay() ? clockLabel(at) : dayMonth(at);
}

/** "Shehani: Court 2 booked", "You: On my way", or a system line as it is. */
function preview(c: ChatPreview) {
  const m = c.lastMessage;
  if (!m) return c.kind === 'community' ? 'Say hi to the group' : 'No messages yet';
  if (m.kind === 'system') return m.body;
  const who = m.mine ? 'You' : m.senderName ? firstName(m.senderName) : 'Deleted account';
  return `${who}: ${m.body}`;
}

function Row({ chat: c }: { chat: ChatPreview }) {
  const unread = c.unread > 0;
  const open = () =>
    c.kind === 'activity'
      ? router.push(`/activity/${c.id}/chat`)
      : router.push(`/community/${c.id}/chat`);
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${c.title}. ${unread ? `${c.unread} new. ` : ''}${preview(c)}`}
      className="flex-row items-center gap-3.5 border-b border-divider py-3.5 active:opacity-80"
    >
      <Avatar uri={c.imageUrl ?? undefined} name={c.title} size={50} shape="rounded" />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-baseline gap-2">
          <Text className="flex-1 font-sans-semibold text-[15.5px] text-ink" numberOfLines={1}>
            {c.title}
          </Text>
          {c.lastMessage ? (
            <Text className={cn('font-sans text-[12.5px]', unread ? 'text-lime' : 'text-subtle')}>
              {when(c.lastMessage.createdAt)}
            </Text>
          ) : null}
        </View>
        <View className="mt-1 flex-row items-center gap-2">
          {c.cancelled ? (
            <Text className="font-sans-medium text-[13.5px] text-danger">Cancelled ·</Text>
          ) : null}
          <Text
            className={cn('flex-1 font-sans text-[14px]', unread ? 'text-ink-soft' : 'text-muted')}
            numberOfLines={1}
          >
            {preview(c)}
          </Text>
          {c.muted ? <BellOffIcon /> : null}
          <CountBadge count={c.unread} muted={c.muted} />
        </View>
      </View>
    </Pressable>
  );
}
