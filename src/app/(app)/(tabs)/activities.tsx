import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { MyActivityCard } from '@/components/activity/ActivityCards';
import { EmptyState, Heading, SegmentedControl } from '@/components/ui';
import { useCommunityFeed } from '@/hooks/useCommunityFeed';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { whenLabel } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { useActivitiesStore } from '@/store/activities';

type Segment = 'joined' | 'hosting';

export default function ActivitiesScreen() {
  const { top } = useScreenInsets();
  // The selected segment lives in the URL so "Publish" can deep-link to ?segment=hosting.
  const { segment = 'joined' } = useLocalSearchParams<{ segment?: Segment }>();
  const setSegment = (value: Segment) => router.setParams({ segment: value });
  const activities = useActivitiesStore((s) => s.activities);
  const communityFeed = useCommunityFeed();

  const joined = activities.filter((a) => a.joined);
  const hosting = activities.filter((a) => a.hosting);
  const isJoined = segment === 'joined';
  const list = isJoined ? joined : hosting;

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: top(62), paddingHorizontal: 22, paddingBottom: 24 }}
    >
      <Heading>Your activities</Heading>
      <SegmentedControl
        className="mt-4"
        value={segment}
        onChange={setSegment}
        segments={[
          { value: 'joined', label: `Joined · ${joined.length}` },
          { value: 'hosting', label: `Hosting · ${hosting.length}` },
        ]}
      />

      {communityFeed.length > 0 ? (
        <View className="mt-4 rounded-[20px] border border-lime-panel-border bg-lime-panel px-4 pb-1.5 pt-3.5">
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full bg-lime" />
            <Text className="font-sans-semibold text-[15px] text-ink">
              {communityFeed.length} new from your communities
            </Text>
          </View>
          {communityFeed.slice(0, 3).map(({ activity, communityName }, k) => (
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
                  {communityName} · {whenLabel(activity)}
                </Text>
              </View>
              <Text className="self-center font-sans-medium text-[14px] text-lime">View →</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View className="mt-4 gap-3">
        {list.map((a) => (
          <MyActivityCard key={a.id} activity={a} />
        ))}
        {list.length === 0 ? (
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
        ) : null}
      </View>
    </ScrollView>
  );
}
