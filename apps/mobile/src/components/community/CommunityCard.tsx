import type { CommunitySummary } from '@buddy/shared';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Avatar, Photo, PressableScale, Skeleton, Card } from '@/components/ui';
import { COMMUNITY_HUE } from '@/data/constants';
import { useCommunityToggle } from '@/hooks/useCommunityToggle';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';

const PHOTO_HEIGHT = 124;
const LOGO = 72;
/** How far the logo hangs below the cover; the text starts under it. */
const LOGO_OVERHANG = 12;

/** "Kandy · 6 members · 2 this week". */
export const communityMeta = (c: CommunitySummary) =>
  `${c.area} · ${c.memberCount} member${c.memberCount === 1 ? '' : 's'} · ${
    c.weeklyActivityCount
  } this week`;

export function CommunityCard({ community: c }: { community: CommunitySummary }) {
  const { toggle, pending } = useCommunityToggle();
  // The Join button sits over the card rather than inside it: nested buttons
  // hide the inner one from screen readers (and are invalid on web).
  return (
    <View>
      <PressableScale
        scale="dim"
        onPress={() => router.push(`/community/${c.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${c.name}, ${communityMeta(c)}`}
        className="overflow-hidden rounded-hero bg-surface"
      >
        <Photo uri={c.coverUrl ?? undefined} hue={COMMUNITY_HUE} style={{ height: PHOTO_HEIGHT }} />
        {/* The logo hangs over the cover's bottom-left edge, above the name. */}
        <View
          pointerEvents="none"
          className="absolute left-4"
          style={{ top: PHOTO_HEIGHT - LOGO + LOGO_OVERHANG }}
        >
          <Avatar
            uri={c.logoUrl ?? undefined}
            name={c.name}
            shape="rounded"
            size={LOGO}
            ring={colors.surface}
            ringWidth={3}
          />
        </View>
        <View className="pb-4 pl-[18px] pr-[120px]" style={{ paddingTop: LOGO_OVERHANG + 10 }}>
          <Text className="font-sans-semibold text-title3 text-ink" numberOfLines={2}>
            {c.name}
          </Text>
          <Text className="mt-1 font-sans text-label leading-label text-muted">
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
            'h-11 items-center justify-center rounded-hero border px-5',
            c.joined ? 'border-lime-outline bg-transparent' : 'border-lime bg-lime',
          )}
        >
          <Text
            className={cn('font-sans-semibold text-subhead', c.joined ? 'text-lime' : 'text-bg')}
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
    <Card radius="hero" className="overflow-hidden">
      <Skeleton className="h-[124px] rounded-none" />
      <View className="flex-row items-center gap-3 py-4 pl-[18px] pr-4">
        <View className="flex-1 gap-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-4/5" />
        </View>
        <Skeleton className="h-11 w-[86px] rounded-hero" />
      </View>
    </Card>
  );
}
