import { DISCOVER_FILTERS, type DiscoverFilter } from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
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
  Chip,
  EmptyState,
  Heading,
  LoadError,
  Refresh,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { locationLabel } from '@/lib/activity';
import { colors } from '@/theme';
import { enterItem, layoutItem } from '@/theme/motion';

export default function DiscoverScreen() {
  const { top } = useScreenInsets();
  const [filter, setFilter] = useState<DiscoverFilter>('All');
  const me = useMe();
  const feed = useFeed(filter);
  const fromCommunities = useFromCommunities();

  const [hero, ...rows] = feed.data ?? [];
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
        <Text className="font-sans text-[14px] text-muted">
          {me.data ? locationLabel(me.data.area) : ''}
        </Text>
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
            {communityItems.map((activity, i) => (
              <AnimatedView key={activity.id} entering={enterItem(i)} layout={layoutItem}>
                <CommunityPickCard activity={activity} />
              </AnimatedView>
            ))}
          </ScrollView>
        </>
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
        {hero ? (
          <AnimatedView key={hero.id} entering={enterItem(0)} layout={layoutItem}>
            <ActivityHeroCard activity={hero} />
          </AnimatedView>
        ) : null}
        {rows.map((a, i) => (
          <AnimatedView
            key={a.id}
            entering={enterItem(i + 1)}

            layout={layoutItem}
          >
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
    </ScrollView>
  );
}
