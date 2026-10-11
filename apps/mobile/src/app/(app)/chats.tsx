import { type ChatPreview, clockLabel, dayMonth, firstName, localDay } from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useChats } from '@/api/queries';
import {
  Avatar,
  BellOffIcon,
  CalendarIcon,
  Chip,
  CountBadge,
  EmptyState,
  LoadError,
  Loading,
  PeopleIcon,
  Refresh,
  ScreenHeader,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';

/** Every group chat you're in: activities you're going to and your communities. */
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'activity', label: 'Activities' },
  { key: 'community', label: 'Communities' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

const matches = (c: ChatPreview, f: Filter) =>
  f === 'all' ? true : f === 'unread' ? c.unread > 0 : c.kind === f;

export default function ChatsScreen() {
  const chats = useChats();
  const [filter, setFilter] = useState<Filter>('all');
  const shown = chats.data?.filter((c) => matches(c, filter)) ?? [];

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader title="Chats" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 }}
        refreshControl={
          <Refresh refreshing={chats.isRefetching} onRefresh={() => void chats.refetch()} />
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-[22px] mb-1"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 22, paddingBottom: 6 }}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              shape="compact"
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
        <View>
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
          {chats.data?.length && !shown.length ? (
            <Text className="py-10 text-center font-sans text-[14.5px] text-muted">
              {filter === 'unread' ? 'You’re all caught up.' : 'No chats here yet.'}
            </Text>
          ) : null}
          {shown.map((c) => (
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
      <View>
        <Avatar uri={c.imageUrl ?? undefined} name={c.title} size={50} shape="rounded" />
        {/* Which kind of chat, at a glance. */}
        <View
          className="absolute -bottom-1 -right-1 h-[24px] w-[24px] items-center justify-center rounded-full border-2 border-bg bg-lime-deep"
          accessibilityLabel={c.kind === 'community' ? 'Community chat' : 'Activity chat'}
        >
          {c.kind === 'community' ? (
            <PeopleIcon size={13} color={colors.lime} />
          ) : (
            <CalendarIcon size={13} color={colors.lime} />
          )}
        </View>
      </View>
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
