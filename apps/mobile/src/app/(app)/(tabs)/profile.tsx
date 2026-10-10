import { dayMonth, monthYear } from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { unregisterPush } from '@/api/push';
import { signOut, useHistory, useMe } from '@/api/queries';
import {
  Avatar,
  Button,
  Heading,
  IconButton,
  QueryFallback,
  Refresh,
  SectionLabel,
  SettingsIcon,
  Tag,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { locationLabel } from '@/lib/activity';
import { colors } from '@/theme';

export default function ProfileScreen() {
  const { top } = useScreenInsets();
  const me = useMe();
  const history = useHistory();
  const [signingOut, setSigningOut] = useState(false);

  if (!me.data) return <QueryFallback query={me} />;
  const { name, area, bio, createdAt, interests, avatarUrl, stats: s } = me.data;

  const stats = [
    { value: s.joined, label: 'Joined' },
    { value: s.hosted, label: 'Hosted' },
    { value: s.communities, label: s.communities === 1 ? 'Community' : 'Communities' },
  ];

  const logOut = async () => {
    setSigningOut(true);
    await unregisterPush();
    await signOut();
  };

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
        <Avatar uri={avatarUrl ?? undefined} size={86} fallback={colors.me} />
        <IconButton
          icon={<SettingsIcon />}
          label="Settings"
          onPress={() => router.push('/settings')}
          className="absolute right-0 top-0"
        />
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
          <View key={st.label} className="flex-1 rounded-2xl bg-surface px-3.5 pb-4 pt-3.5">
            <Text className="font-display text-[22px] text-ink">{st.value}</Text>
            <Text className="mt-1 font-sans text-[13px] text-muted">{st.label}</Text>
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

      <Button
        label="Edit profile"
        variant="outline"
        size="md"
        onPress={() => router.push('/edit-profile')}
        className="mt-[22px]"
      />
      <Button
        label={signingOut ? 'Logging out…' : 'Log out'}
        variant="danger"
        size="md"
        disabled={signingOut}
        onPress={logOut}
        className="mt-2.5"
        weight="medium"
      />
    </ScrollView>
  );
}
