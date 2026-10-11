import type { AdminStats } from '@buddy/shared';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { useAdminStats } from '@/api/queries';
import { DayBars } from '@/components/admin/DayBars';
import {
  Card,
  QueryFallback,
  Refresh,
  ScreenHeader,
  SectionLabel,
  StatTile,
} from '@/components/ui';
import { spacing } from '@/theme';

/** "62%", or "–" when there's nothing to divide by yet. */
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '–');

/** Settings → Dashboard (Buddy team only): a few numbers on how Buddy is doing. */
export default function AdminScreen() {
  const stats = useAdminStats();
  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader title="Dashboard" />
      {stats.data ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: spacing.edge,
            paddingTop: 12,
            paddingBottom: 30,
          }}
          refreshControl={
            <Refresh refreshing={stats.isRefetching} onRefresh={() => void stats.refetch()} />
          }
        >
          <Numbers s={stats.data} />
        </ScrollView>
      ) : (
        <QueryFallback query={stats} />
      )}
    </View>
  );
}

function Numbers({ s }: { s: AdminStats }) {
  const { people, activities: a, showUp } = s;
  return (
    <>
      <SectionLabel className="mb-2.5">People</SectionLabel>
      <View className="flex-row gap-2">
        <StatTile value={people.total} label="Signed up" note={`+${people.new7} this week`} />
        <StatTile
          value={people.active7}
          label="Active this week"
          note={`${pct(people.active7, people.total)} of everyone`}
        />
      </View>
      <View className="mt-2 flex-row gap-2">
        <StatTile value={people.new30} label="New in 30 days" />
        <StatTile
          value={pct(people.onboarded, people.total)}
          label="Finished setup"
          note={`${people.onboarded} people`}
        />
      </View>
      <View className="mt-3">
        <DayBars title="Sign-ups" days={s.daily.map((d) => ({ day: d.day, value: d.signups }))} />
      </View>

      <SectionLabel className="mb-2.5 mt-7">Activities</SectionLabel>
      <View className="flex-row gap-2">
        <StatTile value={a.upcoming} label="Coming up" />
        <StatTile value={a.created7} label="Posted this week" note={`${a.created30} in 30 days`} />
      </View>
      <View className="mt-2 flex-row gap-2">
        <StatTile
          value={a.happened30}
          label="Happened (30 days)"
          note={`${a.avgGoing30} went, on average`}
        />
        <StatTile
          value={pct(a.filled30, a.happened30)}
          label="Filled up"
          note={`${a.filled30} of ${a.happened30}`}
        />
      </View>
      <View className="mt-2 flex-row gap-2">
        <StatTile
          value={pct(showUp.came, showUp.marked)}
          label="Showed up"
          note={
            showUp.marked ? `${showUp.came} of ${showUp.marked} on roll calls` : 'No roll calls yet'
          }
        />
        <StatTile value={a.cancelled30} label="Called off (30 days)" />
      </View>
      <View className="mt-3">
        <DayBars
          title="Activities posted"
          days={s.daily.map((d) => ({ day: d.day, value: d.activities }))}
        />
      </View>

      <SectionLabel className="mb-2.5 mt-7">Community</SectionLabel>
      <View className="flex-row gap-2">
        <StatTile
          value={s.communities.total}
          label="Communities"
          note={`+${s.communities.new30} in 30 days`}
        />
        <StatTile value={s.messages7} label="Messages this week" />
      </View>
      <Card className="mt-2 flex-row items-center justify-between px-4 py-3.5">
        <Text className="font-sans text-subhead text-ink">
          {s.openReports
            ? `${s.openReports} ${s.openReports === 1 ? 'report' : 'reports'} to review`
            : 'No reports waiting'}
        </Text>
        {s.openReports ? (
          <Text
            className="font-sans-semibold text-subhead text-lime"
            onPress={() => router.push('/moderation')}
            accessibilityRole="link"
          >
            Review
          </Text>
        ) : null}
      </Card>
      <Text className="mt-4 font-sans text-caption leading-caption text-subtle">
        Days are in Sri Lanka time. Pull down to refresh.
      </Text>
    </>
  );
}
