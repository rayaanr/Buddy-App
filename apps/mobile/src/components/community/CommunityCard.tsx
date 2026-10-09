import type { CommunitySummary } from '@buddy/shared';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Photo } from '@/components/ui';
import { COMMUNITY_HUE } from '@/data/constants';
import { useCommunityToggle } from '@/hooks/useCommunityToggle';
import { cn } from '@/lib/cn';

export const communityMeta = (c: CommunitySummary) =>
  `${c.memberCount} member${c.memberCount === 1 ? '' : 's'} · ${c.weeklyActivityCount} ${
    c.weeklyActivityCount === 1 ? 'activity' : 'activities'
  } this week`;

export function CommunityCard({ community: c }: { community: CommunitySummary }) {
  const { toggle, pending } = useCommunityToggle();
  return (
    <Pressable
      onPress={() => router.push(`/community/${c.id}`)}
      accessibilityRole="button"
      accessibilityLabel={c.name}
      className="overflow-hidden rounded-[22px] bg-surface active:opacity-90"
    >
      <Photo uri={c.coverUrl ?? undefined} hue={COMMUNITY_HUE} style={{ height: 124 }} />
      <View className="flex-row items-center gap-3 py-4 pl-[18px] pr-4">
        <View className="min-w-0 flex-1">
          <Text className="font-sans-semibold text-[17.5px] text-ink">{c.name}</Text>
          <Text className="mt-1 font-sans text-[14px] leading-[19px] text-muted">
            {communityMeta(c)}
          </Text>
        </View>
        <Pressable
          onPress={() => toggle(c)}
          disabled={pending}
          accessibilityRole="button"
          accessibilityState={{ selected: c.joined, busy: pending }}
          className={cn(
            'h-11 items-center justify-center rounded-[22px] border px-5 active:opacity-80',
            c.joined ? 'border-lime-outline bg-transparent' : 'border-lime bg-lime',
          )}
        >
          <Text
            className={cn('font-sans-semibold text-[15px]', c.joined ? 'text-lime' : 'text-bg')}
          >
            {c.joined ? 'Joined' : 'Join'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
