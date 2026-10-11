import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useFromCommunities, useMyActivities } from '@/api/queries';
import { MyActivityCard, MyActivitySkeleton } from '@/components/activity/ActivityCards';
import {
  ArrowRightIcon,
  EmptyState,
  Heading,
  LoadError,
  Refresh,
  SegmentedControl,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { whenLabel } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';
import { layoutItem } from '@/theme/motion';

type Segment = 'joined' | 'hosting';

export default function ActivitiesScreen() {
  const { top } = useScreenInsets();
  // The selected segment lives in the URL so "Publish" can deep-link to ?segment=hosting.
  const { segment = 'joined' } = useLocalSearchParams<{ segment?: Segment }>();
  const setSegment = (value: Segment) => router.setParams({ segment: value });
  const joined = useMyActivities('joined');
  const hosting = useMyActivities('hosting');
  const fromCommunities = useFromCommunities();

  const isJoined = segment === 'joined';
  const current = isJoined ? joined : hosting;
  const list = current.data ?? [];
  const news = fromCommunities.data ?? [];
  const count = (q: typeof joined) => (q.data ? ` · ${q.data.length}` : '');

  return (
    // Virtualised; rows glide into place when one is added or removed.
    <Animated.FlatList
      style={styles.screen}
      data={list}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <MyActivityCard activity={item} />}
      itemLayoutAnimation={layoutItem}
      contentContainerStyle={{
        paddingTop: top(62),
        paddingHorizontal: 22,
        paddingBottom: 24,
        gap: 12,
      }}
      refreshControl={
        <Refresh
          refreshing={current.isRefetching}
          onRefresh={() =>
            void Promise.all([joined.refetch(), hosting.refetch(), fromCommunities.refetch()])
          }
        />
      }
      ListHeaderComponent={
        <View className="mb-1">
          <Heading>Your activities</Heading>
          <SegmentedControl
            className="mt-4"
            value={segment}
            onChange={setSegment}
            segments={[
              { value: 'joined', label: `Joined${count(joined)}` },
              { value: 'hosting', label: `Hosting${count(hosting)}` },
            ]}
          />

          {news.length > 0 ? (
            <View className="mt-4 rounded-[20px] border border-lime-panel-border bg-lime-panel px-4 pb-1.5 pt-3.5">
              <View className="flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full bg-lime" />
                <Text className="font-sans-semibold text-[15px] text-ink">
                  {news.length} new from your communities
                </Text>
              </View>
              {news.slice(0, 3).map((activity, k) => (
                <Pressable
                  key={activity.id}
                  onPress={() => router.push(`/activity/${activity.id}`)}
                  className={cn(
                    'flex-row justify-between gap-3 border-t border-lime-panel-divider py-3 active:opacity-80',
                    k === 0 && 'mt-2',
                  )}
                >
                  <View className="min-w-0 flex-1">
                    <Text className="font-sans-medium text-[15px] text-ink" numberOfLines={1}>
                      {activity.title}
                    </Text>
                    <Text className="mt-[3px] font-sans text-[13px] text-lime-panel-muted">
                      {activity.community?.name} · {whenLabel(activity)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1 self-center">
                    <Text className="font-sans-medium text-[14px] text-lime">View</Text>
                    <ArrowRightIcon size={14} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {current.isLoading ? (
            <View className="mt-4 gap-3">
              <MyActivitySkeleton />
              <MyActivitySkeleton />
            </View>
          ) : null}
          {current.error ? (
            <View className="mt-4">
              <LoadError
                error={current.error}
                onRetry={() => void current.refetch()}
                stale={!!current.data}
              />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        current.data && list.length === 0 ? (
          isJoined ? (
            <EmptyState
              title="Nothing joined yet"
              subtitle="Find something happening nearby."
              cta="Browse Discover"
              onPress={() => router.navigate('/')}
            />
          ) : (
            <EmptyState
              title="You’re not hosting anything"
              subtitle="Start something and people nearby can join."
              cta="Host an activity"
              onPress={() => router.push('/create')}
            />
          )
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg } });
