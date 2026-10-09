import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Photo } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useCommunityActions } from '@/hooks/useCommunityActions';
import type { Community } from '@/types/models';

export const communityMeta = (c: Community) =>
  `${c.members} members · ${c.weekly} activities this week`;

export function CommunityCard({ community: c }: { community: Community }) {
  const { toggle } = useCommunityActions();
  return (
    <Pressable
      onPress={() => router.push(`/community/${c.id}`)}
      accessibilityRole="button"
      accessibilityLabel={c.name}
      className="overflow-hidden rounded-[22px] bg-surface active:opacity-90"
    >
      <Photo uri={c.image} hue={c.hue} style={{ height: 124 }} />
      <View className="flex-row items-center gap-3 py-4 pl-[18px] pr-4">
        <View className="min-w-0 flex-1">
          <Text className="font-sans-semibold text-[17.5px] text-ink">{c.name}</Text>
          <Text className="mt-1 font-sans text-[14px] leading-[19px] text-muted">
            {communityMeta(c)}
          </Text>
        </View>
        <Pressable
          onPress={() => toggle(c)}
          accessibilityRole="button"
          accessibilityState={{ selected: c.joined }}
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
