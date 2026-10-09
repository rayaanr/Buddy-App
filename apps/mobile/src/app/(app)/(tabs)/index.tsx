import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  ActivityHeroCard,
  ActivityRow,
  CommunityPickCard,
} from '@/components/activity/ActivityCards';
import { Avatar, Chip, EmptyState, Heading } from '@/components/ui';
import { DISCOVER_FILTERS, type DiscoverFilter } from '@/data/constants';
import { MY_AVATAR } from '@/data/images';
import { useCommunityFeed } from '@/hooks/useCommunityFeed';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { matchesFilter } from '@/lib/activity';
import { useActivitiesStore } from '@/store/activities';
import { useAccount } from '@/store/session';
import { colors } from '@/theme';

export default function DiscoverScreen() {
  const { top } = useScreenInsets();
  const account = useAccount();
  const activities = useActivitiesStore((s) => s.activities);
  const communityFeed = useCommunityFeed();
  const [filter, setFilter] = useState<DiscoverFilter>('All');

  const feed = useMemo(
    () => activities.filter((a) => matchesFilter(a, filter)),
    [activities, filter],
  );
  const [hero, ...rows] = feed;
  const showCommunityRow = filter === 'All' && communityFeed.length > 0;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: top(58), paddingBottom: 24 }}
    >
      <View className="flex-row items-center justify-between px-[22px]">
        <Text className="font-sans text-[14px] text-muted">{account.location}</Text>
        <Avatar
          uri={MY_AVATAR}
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
            {communityFeed.map(({ activity, communityName }) => (
              <CommunityPickCard
                key={activity.id}
                activity={activity}
                communityName={communityName}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <View className="gap-3 px-[22px]">
        {hero ? <ActivityHeroCard activity={hero} /> : null}
        {rows.map((a) => (
          <ActivityRow key={a.id} activity={a} />
        ))}
        {!hero ? (
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
