import { DISCOVER_FILTERS, type DiscoverFilter } from '@buddy/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  useFeed,
  useFromCommunities,
  useMe,
  useUnreadMessages,
  useUnreadNotifications,
} from '@/api/queries';
import {
  ActivityHeroCard,
  ActivityHeroSkeleton,
  ActivityRow,
  ActivityRowSkeleton,
  CommunityPickCard,
} from '@/components/activity/ActivityCards';
import {
  AnimatedView,
  BellIcon,
  ChatIcon,
  CountBadge,
  ChevronDownIcon,
  Chip,
  EmptyState,
  Heading,
  IconButton,
  LoadError,
  LocateIcon,
  MapPinIcon,
  Refresh,
  SearchField,
  PicksIcon,
} from '@/components/ui';
import { useDebounced } from '@/hooks/useDebounced';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { LocationSheet } from '@/components/discover/LocationSheet';
import { currentPointIfAllowed } from '@/lib/location';
import { useDiscoverStore } from '@/store/discover';
import { fadeIn } from '@/theme/motion';

export default function DiscoverScreen() {
  const { top } = useScreenInsets();
  const [filter, setFilter] = useState<DiscoverFilter>('All');
  const [search, setSearch] = useState('');
  const searching = useDebounced(search.trim(), 300);
  const isSearch = searching.length >= 2;
  const me = useMe();
  const unread = useUnreadNotifications().data ?? 0;
  const unreadMessages = useUnreadMessages();
  const feed = useFeed(filter, isSearch ? searching : '');
  const fromCommunities = useFromCommunities();

  const results = feed.data?.activities ?? [];
  // Search results are all equal: no big card on top.
  const hero = isSearch ? undefined : results[0];
  const rows = isSearch ? results : results.slice(1);
  const origin = useDiscoverStore((s) => s.origin);
  const radiusKm = useDiscoverStore((s) => s.radiusKm);
  const here = useDiscoverStore((s) => s.here);
  const [where, setWhere] = useState({ open: false, key: 0 });
  const homeLabel = me.data?.area ?? '';
  const originLabel =
    origin.kind === 'here' ? 'Near me' : origin.kind === 'town' ? origin.label : homeLabel;
  const widenedTo =
    !isSearch && feed.data && feed.data.radiusKm > radiusKm ? feed.data.radiusKm : null;
  // "Near me" waits for the phone's position: show the skeleton, not "Nothing here".
  const locating = origin.kind === 'here' && !here && !feed.data;

  // "Near me" from last time: find the phone again, without asking. If
  // permission was taken away since, go back to home.
  useEffect(() => {
    if (origin.kind !== 'here' || here) return;
    let cancelled = false;
    void currentPointIfAllowed().then((point) => {
      const store = useDiscoverStore.getState();
      // Picked somewhere else meanwhile: that choice wins.
      if (cancelled || store.origin.kind !== 'here') return;
      if (point) store.setHere(point);
      else store.setOrigin({ kind: 'home' });
    });
    return () => {
      cancelled = true;
    };
  }, [origin.kind, here]);
  const communityItems = fromCommunities.data ?? [];
  const showCommunityRow = !isSearch && filter === 'All' && communityItems.length > 0;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: top(58), paddingBottom: 24 }}
      refreshControl={
        <Refresh
          refreshing={feed.isRefetching}
          onRefresh={() => void Promise.all([feed.refetch(), fromCommunities.refetch()])}
        />
      }
    >
      <View className="flex-row items-center justify-between px-[22px]">
        <Pressable
          onPress={() => setWhere((w) => ({ open: true, key: w.key + 1 }))}
          accessibilityRole="button"
          accessibilityLabel={`Showing activities ${origin.kind === 'here' ? 'near you' : `near ${originLabel}`}. Change`}
          hitSlop={8}
          className="min-w-0 flex-1 flex-row items-center gap-1.5 pr-3 active:opacity-70"
        >
          {origin.kind === 'here' ? <LocateIcon size={15} /> : <MapPinIcon size={15} />}
          <Text className="shrink font-sans-medium text-[14px] text-muted" numberOfLines={1}>
            {originLabel}
          </Text>
          <ChevronDownIcon size={15} />
        </Pressable>
        <View className="flex-row gap-2">
          {/* Straight to the swipe deck, any time. */}
          <IconButton
            icon={<PicksIcon />}
            label="Picked for you"
            onPress={() => router.push({ pathname: '/picks', params: { from: 'button' } })}
          />
          <View>
            <IconButton
              icon={<ChatIcon />}
              label={unreadMessages ? `Chats, ${unreadMessages} unread` : 'Chats'}
              onPress={() => router.push('/chats')}
            />
            <CountBadge count={unreadMessages} className="absolute -right-1 -top-1" />
          </View>
          <View>
            <IconButton
              icon={<BellIcon />}
              label={unread ? `Notifications, ${unread} new` : 'Notifications'}
              onPress={() => router.push('/notifications')}
            />
            {unread ? (
              <View
                pointerEvents="none"
                className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-bg bg-lime"
              />
            ) : null}
          </View>
        </View>
      </View>
      <Heading className="mt-0.5 px-[22px]">What’s happening</Heading>
      <View className="mt-3.5 px-[22px]">
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search padel, Galle, food walk…"
          label="Search activities"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 18 }}
      >
        {DISCOVER_FILTERS.map((f) => (
          <Chip
            key={f}
            label={f}
            shape="compact"
            selected={f === filter}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>

      {showCommunityRow ? (
        <>
          <View className="flex-row items-baseline justify-between px-[22px] pb-2.5">
            <Text className="font-sans-semibold text-[17px] text-ink">From your communities</Text>
            <Pressable onPress={() => router.navigate('/communities')} hitSlop={8}>
              <Text className="font-sans-medium text-[14px] text-lime">See all</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 22, paddingBottom: 20 }}
          >
            {communityItems.map((activity) => (
              <CommunityPickCard key={activity.id} activity={activity} />
            ))}
          </ScrollView>
        </>
      ) : null}

      {widenedTo ? (
        <Text className="px-[22px] pb-3 font-sans text-[13.5px] leading-[19px] text-muted">
          Not much within {radiusKm} km, so this shows up to {widenedTo} km away, nearest first.
        </Text>
      ) : null}

      <View className="gap-3 px-[22px]">
        {isSearch && feed.data ? (
          <Text className="font-sans text-[13.5px] text-muted">
            {results.length
              ? `${results.length === 50 ? '50+' : results.length} across Sri Lanka, nearest first`
              : ''}
          </Text>
        ) : null}
        {feed.isLoading || locating ? (
          <>
            <ActivityHeroSkeleton />
            <ActivityRowSkeleton />
            <ActivityRowSkeleton />
          </>
        ) : null}
        {feed.error ? <LoadError error={feed.error} onRetry={() => void feed.refetch()} /> : null}
        {hero ? <ActivityHeroCard activity={hero} /> : null}
        {/* Home stays calm: rows just fade in when they first appear. */}
        {rows.map((a) => (
          <AnimatedView key={a.id} entering={fadeIn}>
            <ActivityRow activity={a} />
          </AnimatedView>
        ))}
        {isSearch && feed.data && !results.length ? (
          <EmptyState
            card
            title={`Nothing matches “${searching}”`}
            subtitle="Try another word, or host it yourself."
            cta="Host an activity"
            onPress={() => router.push('/create')}
          />
        ) : null}
        {!isSearch && feed.data && !hero ? (
          <EmptyState
            card
            title="Nothing here yet"
            subtitle="Be the first to host something."
            cta="Host an activity"
            onPress={() => router.push('/create')}
          />
        ) : null}
      </View>
      <LocationSheet
        key={where.key}
        open={where.open}
        onClose={() => setWhere((w) => ({ ...w, open: false }))}
        home={homeLabel}
      />
    </ScrollView>
  );
}
