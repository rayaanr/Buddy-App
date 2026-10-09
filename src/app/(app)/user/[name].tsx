import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { ActivityRow } from '@/components/activity/ActivityCards';
import { Avatar, BackButton, Heading, SectionLabel, Tag } from '@/components/ui';
import { getUser } from '@/data/users';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useActivitiesStore } from '@/store/activities';
import { useSessionStore } from '@/store/session';
import { colors } from '@/theme';

export default function UserProfileScreen() {
  const { name = '' } = useLocalSearchParams<{ name: string }>();
  const user = getUser(name);
  const myInterests = useSessionStore((s) => s.interests);
  const activities = useActivitiesStore((s) => s.activities);
  const { top } = useScreenInsets();

  const common = user.tags.filter((t) => myInterests.includes(t)).length;
  const hosting = activities.filter((a) => a.host === name);

  return (
    <View className="flex-1 bg-bg">
      <View className="px-[18px]" style={{ paddingTop: top(56) }}>
        <BackButton />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 30 }}
      >
        <Avatar
          uri={user.avatar}
          size={104}
          ring={colors.line}
          ringWidth={3}
          style={{ alignSelf: 'center' }}
        />
        <Heading size="section" className="mt-4 text-center">
          {user.name}
        </Heading>
        <Text className="mt-1.5 text-center font-sans text-[14.5px] text-muted">
          {user.area} · on Buddy since {user.since}
        </Text>
        {user.bio ? (
          <Text className="mt-4 max-w-[300px] self-center text-center font-sans text-[15px] leading-[22.5px] text-ink-dim">
            {user.bio}
          </Text>
        ) : null}

        <View className="mt-5 flex-row gap-2">
          <Stat value={user.hosted} label="Hosted" />
          <Stat value={user.joined} label="Joined" />
        </View>

        <View className="mb-2.5 mt-6 flex-row justify-between">
          <SectionLabel>Into</SectionLabel>
          {common ? <SectionLabel tone="lime">{common} in common</SectionLabel> : null}
        </View>
        <View className="flex-row flex-wrap gap-2">
          {user.tags.map((t) => (
            <Tag key={t} label={t} active={myInterests.includes(t)} />
          ))}
        </View>

        {hosting.length > 0 ? (
          <>
            <SectionLabel className="mb-2.5 mt-6">Hosting on Buddy</SectionLabel>
            <View className="gap-2.5">
              {hosting.map((a) => (
                <ActivityRow key={a.id} activity={a} thumb={64} meta="place" />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-surface px-3.5 pb-4 pt-3.5">
      <Text className="font-display text-[22px] text-ink">{value}</Text>
      <Text className="mt-1 font-sans text-[13px] text-muted">{label}</Text>
    </View>
  );
}
