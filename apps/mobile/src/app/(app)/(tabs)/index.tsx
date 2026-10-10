import { DISCOVER_FILTERS, type DiscoverFilter } from '@buddy/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useFeed, useFromCommunities, useMe } from '@/api/queries';
import {
  ActivityHeroCard,
  ActivityHeroSkeleton,
  ActivityRow,
  ActivityRowSkeleton,
  CommunityPickCard,
} from '@/components/activity/ActivityCards';
import {
  AnimatedView,
  Avatar,
  ChevronDownIcon,
  Chip,
  EmptyState,
  Heading,
  LoadError,
  LocateIcon,
  MapPinIcon,
  Refresh,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { LocationSheet } from '@/components/discover/LocationSheet';
import { currentPointIfAllowed } from '@/lib/location';
import { useDiscoverStore } from '@/store/discover';
import { colors } from '@/theme';
import { fadeIn } from '@/theme/motion';

export default function DiscoverScreen() {
  const { top } = useScreenInsets();
  const [filter, setFilter] = useState<DiscoverFilter>('All');
  const me = useMe();
  const feed = useFeed(filter);
  const fromCommunities = useFromCommunities();

  const [hero, ...rows] = feed.data?.activities ?? [];
  const origin = useDiscoverStore((s) => s.origin);
  const radiusKm = useDiscoverStore((s) => s.radiusKm);
  const [where, setWhere] = useState({ open: false, key: 0 });
  const homeLabel = me.data?.area ?? '';
  const originLabel =
    origin.kind === 'here' ? 'Near me' : origin.kind === 'town' ? origin.label : homeLabel;
  const widenedTo = feed.data && feed.data.radiusKm > radiusKm ? feed.data.radiusKm : null;

  // "Near me" from last time: find the phone again, without asking. If
  // permission was taken away since, go back to home.
  const here = useDiscoverStore((s) => s.here);
  useEffect(() => {
    if (origin.kind !== 'here' || here) return;
    void currentPointIfAllowed().then((point) => {
      const store = useDiscoverStore.getState();
      if (point) store.setHere(point);
      else store.setOrigin({ kind: 'home' });
    });
  }, [origin.kind, here]);
  const communityItems = fromCommunities.data ?? [];
  const showCommunityRow = filter === 'All' && communityItems.length > 0;

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
        <Avatar
          uri={me.data?.avatarUrl ?? undefined}
          size={42}
          fallback={colors.me}
          onPress={() => router.navigate('/profile')}
          accessibilityLabel="Your profile"
        />
      </View>
      <Heading className="mt-0.5 px-[22px]">What’s happening</Heading>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 18 }}
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
          Nothing within {radiusKm} km, so this shows up to {widenedTo} km away.
        </Text>
      ) : null}

      <View className="gap-3 px-[22px]">
        {feed.isLoading ? (
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
        {feed.data && !hero ? (
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
