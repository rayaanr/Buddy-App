import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useCommunity, useDeleteCommunity } from '@/api/queries';
import { ActivityRow } from '@/components/activity/ActivityCards';
import { communityMeta } from '@/components/community/CommunityCard';
import {
  ActionSheet,
  Avatar,
  BackButton,
  Button,
  Heading,
  MoreButton,
  Photo,
  QueryFallback,
  Scrim,
  SectionLabel,
  TickIcon,
} from '@/components/ui';
import { COMMUNITY_HUE } from '@/data/constants';
import { useCommunityToggle } from '@/hooks/useCommunityToggle';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const community = useCommunity(id);
  const { toggle, pending } = useCommunityToggle();
  const { top } = useScreenInsets();
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useDeleteCommunity();

  if (!community.data)
    return <QueryFallback query={community} notFound="This community no longer exists." />;
  const c = community.data;
  const others = c.memberCount - c.members.length;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 30 }}>
      <Photo uri={c.coverUrl ?? undefined} hue={COMMUNITY_HUE} style={{ height: 250 }}>
        <Scrim from={0.3} topOpacity={0.2} opacity={1} />
        <View className="absolute inset-x-[18px] flex-row justify-between" style={{ top: top(56) }}>
          <BackButton tone="glass" />
          <MoreButton tone="glass" onPress={() => setMenu(true)} />
        </View>
      </Photo>

      <View className="-mt-[30px] px-[22px]">
        <Heading size="page">{c.name}</Heading>
        <Text className="mt-2 font-sans text-[14.5px] text-muted">{communityMeta(c)}</Text>

        {c.joined ? (
          <>
            <View className="mt-3.5 h-8 flex-row items-center gap-[7px] self-start rounded-2xl bg-lime-deep px-[13px]">
              <TickIcon size={14} color={colors.lime} />
              <Text className="font-sans-medium text-[13.5px] text-lime">You’re a member</Text>
            </View>
            <Button
              label="Host an activity"
              size="md"
              onPress={() => router.push({ pathname: '/create', params: { communityId: c.id } })}
              className="mt-4"
            />
          </>
        ) : (
          <Button
            label={pending ? 'Joining…' : 'Join community'}
            size="md"
            inactive={pending}
            onPress={() => toggle(c)}
            className="mt-4"
          />
        )}

        <View className="mt-5 flex-row items-center">
          {c.members.map((m) => (
            <Avatar
              key={m.id}
              uri={m.avatarUrl ?? undefined}
              size={38}
              ring={colors.bg}
              style={{ marginRight: -8 }}
              onPress={() => router.push(`/user/${m.id}`)}
              accessibilityLabel={m.name}
            />
          ))}
          <Pressable
            onPress={() => router.push(`/community/${c.id}/members`)}
            accessibilityRole="button"
            hitSlop={8}
            className="ml-[18px] active:opacity-70"
          >
            <Text className="font-sans text-[14px] text-muted">
              {others > 0 ? `+${others} member${others === 1 ? '' : 's'} · ` : ''}
              <Text className="font-sans-medium text-lime">See all</Text>
            </Text>
          </Pressable>
        </View>

        <SectionLabel className="mb-2.5 mt-[26px]">Upcoming</SectionLabel>
        <View className="gap-2.5">
          {c.upcoming.map((a) => (
            <ActivityRow key={a.id} activity={a} thumb={72} />
          ))}
          {c.upcoming.length === 0 ? (
            <View className="rounded-[18px] bg-surface p-5">
              <Text className="text-center font-sans text-[14.5px] text-muted">
                No upcoming activities this week.
              </Text>
            </View>
          ) : null}
        </View>

        {c.about ? (
          <>
            <SectionLabel className="mb-2 mt-[26px]">About</SectionLabel>
            <Text className="font-sans text-[15px] leading-[22.5px] text-ink-dim">{c.about}</Text>
          </>
        ) : null}

        {c.rules.length ? (
          <>
            <SectionLabel className="mb-1 mt-6">Group rules</SectionLabel>
            {c.rules.map((rule, k) => (
              <View key={rule} className="flex-row gap-3 border-b border-divider py-3">
                <Text className="font-mono-medium text-[13px] leading-[21px] text-muted">
                  {String(k + 1).padStart(2, '0')}
                </Text>
                <Text className="flex-1 font-sans text-[15px] leading-[21px] text-ink">{rule}</Text>
              </View>
            ))}
          </>
        ) : null}

        {c.joined ? (
          <Button
            label={pending ? 'Leaving…' : 'Leave community'}
            variant="danger-outline"
            size="md"
            weight="medium"
            disabled={pending}
            onPress={() => toggle(c)}
            className="mt-[22px]"
          />
        ) : null}
      </View>

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        actions={
          c.isCreator
            ? [
                { label: 'Edit community', onPress: () => router.push(`/community/${c.id}/edit`) },
                {
                  label: 'Delete community',
                  destructive: true,
                  onPress: () => setConfirmDelete(true),
                },
              ]
            : [
                {
                  label: 'Report community',
                  destructive: true,
                  onPress: () =>
                    router.push({ pathname: '/report', params: { type: 'community', id: c.id } }),
                },
              ]
        }
      />
      <ActionSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${c.name}?`}
        message="Everyone leaves it and it disappears for good. Activities posted in it stay up on their own."
        actions={[
          {
            label: 'Delete community',
            destructive: true,
            onPress: () =>
              remove.mutate(c.id, {
                onSuccess: () => {
                  if (router.canGoBack()) router.back();
                  else router.replace('/communities');
                  toast('Community deleted.');
                },
                onError: (err) => toast(errorMessage(err)),
              }),
          },
        ]}
      />
    </ScrollView>
  );
}
