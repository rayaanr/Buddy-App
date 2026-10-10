import { dayMonth, monthYear } from '@buddy/shared';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useHistory, useMe } from '@/api/queries';
import {
  Avatar,
  Heading,
  IconButton,
  PencilIcon,
  QueryFallback,
  Refresh,
  SectionLabel,
  SettingsIcon,
  StatTile,
  Tag,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { locationLabel } from '@/lib/activity';

export default function ProfileScreen() {
  const { top } = useScreenInsets();
  const me = useMe();
  const history = useHistory();

  if (!me.data) return <QueryFallback query={me} />;
  const { name, area, bio, createdAt, interests, avatarUrl, stats: s } = me.data;

  const stats = [
    { value: s.joined, label: 'Joined' },
    { value: s.hosted, label: 'Hosted' },
    { value: s.communities, label: s.communities === 1 ? 'Community' : 'Communities' },
  ];

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: top(68), paddingHorizontal: 22, paddingBottom: 24 }}
      refreshControl={
        <Refresh
          refreshing={me.isRefetching}
          onRefresh={() => void Promise.all([me.refetch(), history.refetch()])}
        />
      }
    >
      <View className="items-center">
        <Avatar uri={avatarUrl ?? undefined} name={name} size={86} />
        <View className="absolute right-0 top-0 flex-row gap-2">
          <IconButton
            icon={<PencilIcon />}
            label="Edit profile"
            onPress={() => router.push('/edit-profile')}
          />
          <IconButton
            icon={<SettingsIcon />}
            label="Settings"
            onPress={() => router.push('/settings')}
          />
        </View>
      </View>
      <Heading size="page" className="mt-4 text-center">
        {name}
      </Heading>
      <Text className="mt-1.5 text-center font-sans text-[14.5px] text-muted">
        {locationLabel(area)}
      </Text>
      <Text className="mt-0.5 text-center font-sans text-[12.5px] text-subtle">
        On Buddy since {monthYear(new Date(createdAt))}
      </Text>
      {bio ? (
        <Text className="mt-4 max-w-[300px] self-center text-center font-sans text-[15px] leading-[22.5px] text-ink-dim">
          {bio}
        </Text>
      ) : null}

      <View className="mt-5 flex-row gap-2">
        {stats.map((st) => (
          <StatTile key={st.label} value={st.value} label={st.label} />
        ))}
      </View>

      <SectionLabel className="mb-2.5 mt-6">Into</SectionLabel>
      <View className="flex-row flex-wrap gap-2">
        {interests.map((i) => (
          <Tag key={i} label={i} />
        ))}
      </View>

      <SectionLabel className="mb-1 mt-6">Recent</SectionLabel>
      {history.data?.length === 0 ? (
        <Text className="py-3.5 font-sans text-[14.5px] text-muted">
          Activities you’ve been to will show up here.
        </Text>
      ) : null}
      {history.data?.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => router.push(`/activity/${a.id}`)}
          className="flex-row items-center justify-between gap-3 border-b border-divider py-3.5 active:opacity-80"
        >
          <Text className="flex-1 font-sans text-[15.5px] text-ink" numberOfLines={1}>
            {a.title}
          </Text>
          <Text className="font-sans text-[14px] text-muted">{dayMonth(new Date(a.startsAt))}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
