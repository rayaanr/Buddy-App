import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Avatar, Button, Heading, SectionLabel, Tag } from '@/components/ui';
import { RECENT_ACTIVITY } from '@/data/constants';
import { MY_AVATAR } from '@/data/images';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useActivitiesStore } from '@/store/activities';
import { useAccount, useSessionStore } from '@/store/session';
import { colors } from '@/theme';

/** Historical counts from before this device, added to live counts. */
const PAST_JOINED = 7;
const PAST_HOSTED = 2;

export default function ProfileScreen() {
  const { top } = useScreenInsets();
  const account = useAccount();
  const interests = useSessionStore((s) => s.interests);
  const signOut = useSessionStore((s) => s.signOut);
  const joined = useActivitiesStore((s) => s.activities.filter((a) => a.joined).length);
  const hosted = useActivitiesStore((s) => s.activities.filter((a) => a.hosting).length);
  const communities = useActivitiesStore((s) => s.communities.filter((c) => c.joined).length);

  const stats = [
    { value: PAST_JOINED + joined, label: 'Joined' },
    { value: PAST_HOSTED + hosted, label: 'Hosted' },
    { value: communities, label: communities === 1 ? 'Community' : 'Communities' },
  ];

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: top(68), paddingHorizontal: 22, paddingBottom: 24 }}
    >
      <Avatar uri={MY_AVATAR} size={86} fallback={colors.me} style={{ alignSelf: 'center' }} />
      <Heading size="page" className="mt-4 text-center">
        {account.name}
      </Heading>
      <Text className="mt-1.5 text-center font-sans text-[14.5px] text-muted">
        {account.location} · on Buddy since March
      </Text>

      <View className="mt-5 flex-row gap-2">
        {stats.map((s) => (
          <View key={s.label} className="flex-1 rounded-2xl bg-surface px-3.5 pb-4 pt-3.5">
            <Text className="font-display text-[22px] text-ink">{s.value}</Text>
            <Text className="mt-1 font-sans text-[13px] text-muted">{s.label}</Text>
          </View>
        ))}
      </View>

      <SectionLabel className="mb-2.5 mt-6">Into</SectionLabel>
      <View className="flex-row flex-wrap gap-2">
        {interests.map((i) => (
          <Tag key={i} label={i} />
        ))}
      </View>

      <SectionLabel className="mb-1 mt-6">Recent</SectionLabel>
      {RECENT_ACTIVITY.map((r) => (
        <View
          key={r.title}
          className="flex-row items-center justify-between border-b border-divider py-3.5"
        >
          <Text className="font-sans text-[15.5px] text-ink">{r.title}</Text>
          <Text className="font-sans text-[14px] text-muted">{r.date}</Text>
        </View>
      ))}

      <Button
        label="Edit profile"
        variant="outline"
        size="md"
        onPress={() => router.push('/edit-profile')}
        className="mt-[22px]"
      />
      <Button
        label="Log out"
        variant="danger"
        size="md"
        onPress={signOut}
        className="mt-2.5"
        weight="medium"
      />
    </ScrollView>
  );
}
