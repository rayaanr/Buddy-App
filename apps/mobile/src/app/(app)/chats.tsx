import { type ChatPreview, clockLabel, dayMonth, firstName, localDay } from '@buddy/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { useChats } from '@/api/queries';
import { useToggleMute } from '@/components/chat/useToggleMute';
import {
  Avatar,
  Chip,
  CloseIcon,
  CountBadge,
  EmptyState,
  holdHaptic,
  IconButton,
  LoadError,
  MutedIcon,
  Loading,
  MapPinIcon,
  PeopleIcon,
  Refresh,
  ScreenHeader,
  UnmuteIcon,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
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
  // Held down: the header turns into its actions (Mute), like WhatsApp.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = chats.data?.find((c) => c.id === selectedId) ?? null;
  const toggleMute = useToggleMute();
  const { top } = useScreenInsets();
  useEffect(() => {
    if (!selected || Platform.OS !== 'android') return;
    // Android back lets go of the chat instead of leaving the screen.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedId(null);
      return true;
    });
    return () => sub.remove();
  }, [selected]);

  return (
    <View className="flex-1 bg-bg">
      {selected ? (
        <View className="flex-row items-center gap-3 px-[18px]" style={{ paddingTop: top(56) }}>
          <IconButton
            icon={<CloseIcon />}
            label="Done with this chat"
            onPress={() => setSelectedId(null)}
          />
          <Text numberOfLines={1} className="flex-1 font-sans-semibold text-[17px] text-ink">
            {selected.title}
          </Text>
          <IconButton
            icon={selected.muted ? <UnmuteIcon /> : <MutedIcon size={20} color={colors.ink} />}
            label={selected.muted ? 'Unmute' : 'Mute'}
            onPress={() => {
              toggleMute({ kind: selected.kind, id: selected.id }, !selected.muted);
              setSelectedId(null);
            }}
          />
        </View>
      ) : (
        <ScreenHeader title="Chats" />
      )}
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
            <LoadError
              error={chats.error}
              onRetry={() => void chats.refetch()}
              stale={!!chats.data}
            />
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
            <Row
              key={c.id}
              chat={c}
              selected={c.id === selectedId}
              selecting={!!selected}
              onSelect={(on) => {
                if (on) holdHaptic();
                setSelectedId(on ? c.id : null);
              }}
            />
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

function Row({
  chat: c,
  selected,
  selecting,
  onSelect,
}: {
  chat: ChatPreview;
  selected: boolean;
  /** Some chat is held: a tap picks this one (or lets go) instead of opening it. */
  selecting: boolean;
  onSelect: (on: boolean) => void;
}) {
  const unread = c.unread > 0;
  const open = () =>
    c.kind === 'activity'
      ? router.push(`/activity/${c.id}/chat`)
      : router.push(`/community/${c.id}/chat`);
  return (
    <Pressable
      onPress={selecting ? () => onSelect(!selected) : open}
      onLongPress={() => onSelect(true)}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${c.title}. ${c.muted ? 'Muted. ' : ''}${unread ? `${c.unread} new. ` : ''}${preview(c)}`}
      accessibilityHint="Hold for options"
      className={cn(
        '-mx-[22px] flex-row items-center gap-3.5 border-b border-divider px-[22px] py-3.5 active:opacity-80',
        selected && 'bg-surface',
      )}
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
            <MapPinIcon size={13} color={colors.lime} />
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
          {c.muted ? <MutedIcon /> : null}
          <CountBadge count={c.unread} muted={c.muted} />
        </View>
      </View>
    </Pressable>
  );
}
