import type { CommunitySummary } from '@buddy/shared';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Photo, PressableScale, Skeleton } from '@/components/ui';
import { COMMUNITY_HUE } from '@/data/constants';
import { useCommunityToggle } from '@/hooks/useCommunityToggle';
import { cn } from '@/lib/cn';

const PHOTO_HEIGHT = 124;

export const communityMeta = (c: CommunitySummary) =>
  `${c.memberCount} member${c.memberCount === 1 ? '' : 's'} · ${c.weeklyActivityCount} ${
    c.weeklyActivityCount === 1 ? 'activity' : 'activities'
  } this week`;

export function CommunityCard({ community: c }: { community: CommunitySummary }) {
  const { toggle, pending } = useCommunityToggle();
  // The Join button sits over the card rather than inside it: nested buttons
  // hide the inner one from screen readers (and are invalid on web).
  return (
    <View>
      <PressableScale
        onPress={() => router.push(`/community/${c.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${c.name}, ${communityMeta(c)}`}
        className="overflow-hidden rounded-[22px] bg-surface"
        scaleTo={0.985}
      >
        <Photo uri={c.coverUrl ?? undefined} hue={COMMUNITY_HUE} style={{ height: PHOTO_HEIGHT }} />
        <View className="py-4 pl-[18px] pr-[120px]">
          <Text className="font-sans-semibold text-[17.5px] text-ink">{c.name}</Text>
          <Text className="mt-1 font-sans text-[14px] leading-[19px] text-muted">
            {communityMeta(c)}
          </Text>
        </View>
      </PressableScale>
      <View
        pointerEvents="box-none"
        className="absolute bottom-0 right-4 justify-center"
        style={{ top: PHOTO_HEIGHT }}
      >
        <PressableScale
          onPress={() => toggle(c)}
          disabled={pending}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel={`${c.joined ? 'Joined' : 'Join'} ${c.name}`}
          accessibilityState={{ selected: c.joined, busy: pending }}
          className={cn(
            'h-11 items-center justify-center rounded-[22px] border px-5',
            c.joined ? 'border-lime-outline bg-transparent' : 'border-lime bg-lime',
          )}
        >
          <Text
            className={cn('font-sans-semibold text-[15px]', c.joined ? 'text-lime' : 'text-bg')}
          >
            {c.joined ? 'Joined' : 'Join'}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

export function CommunityCardSkeleton() {
  return (
    <View className="overflow-hidden rounded-[22px] bg-surface">
      <Skeleton className="h-[124px] rounded-none" />
      <View className="flex-row items-center gap-3 py-4 pl-[18px] pr-4">
        <View className="flex-1 gap-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-4/5" />
        </View>
        <Skeleton className="h-11 w-[86px] rounded-[22px]" />
      </View>
    </View>
  );
}
