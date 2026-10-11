import type { ActivitySummary, MyActivity } from '@buddy/shared';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import {
  ArrowRightIcon,
  Eyebrow,
  Heading,
  Photo,
  PressableScale,
  Scrim,
  Skeleton,
  Card,
} from '@/components/ui';
import {
  availabilityColor,
  distanceLabel,
  hueFor,
  lastMessagePreview,
  leftLabel,
  spotsLabel,
  costLabel,
  whenLabel,
} from '@/lib/activity';

type Activity = ActivitySummary;

const openActivity = (id: string) => router.push(`/activity/${id}`);

/** Large photo card at the top of Discover. */
export function ActivityHeroCard({ activity: a }: { activity: Activity }) {
  return (
    <PressableScale
      scale="dim"
      onPress={() => openActivity(a.id)}
      accessibilityRole="button"
      accessibilityLabel={a.title}
    >
      <Photo
        uri={a.coverUrl ?? undefined}
        hue={hueFor(a)}
        className="h-[410px] rounded-modal border border-line"
      >
        <Scrim from={0.45} opacity={0.8} />
        <View className="absolute right-3.5 top-3.5 h-7 justify-center rounded-tile bg-lime px-[11px]">
          <Text className="font-sans-semibold text-footnote text-bg">{whenLabel(a)}</Text>
        </View>
        {costLabel(a) ? (
          <View className="absolute left-3.5 top-3.5 h-7 justify-center rounded-tile bg-glass px-[11px]">
            <Text className="font-sans-semibold text-footnote text-ink">{costLabel(a)}</Text>
          </View>
        ) : null}
        <View className="absolute inset-x-[18px] bottom-[18px]">
          <Eyebrow>{a.category}</Eyebrow>
          <Heading size="card" className="mt-2.5">
            {a.title}
          </Heading>
          <View className="mt-2.5 flex-row justify-between gap-2.5">
            <Text className="flex-1 font-sans text-subhead text-ink-faint" numberOfLines={1}>
              {a.place} · {distanceLabel(a)}
            </Text>
            <Text className="font-sans-medium text-subhead" style={{ color: availabilityColor(a) }}>
              {spotsLabel(a)}
            </Text>
          </View>
        </View>
      </Photo>
    </PressableScale>
  );
}

interface ActivityRowProps {
  activity: Activity;
  /** Thumbnail size: 96 (Discover), 72 (community page), 64 (user profile). */
  thumb?: 96 | 72 | 64;
  /** Second line under the title: area + availability, or the venue. */
  meta?: 'availability' | 'place';
}

export function ActivityRow({ activity: a, thumb = 96, meta = 'availability' }: ActivityRowProps) {
  const big = thumb === 96;
  return (
    <PressableScale
      scale="dim"
      onPress={() => openActivity(a.id)}
      accessibilityRole="button"
      accessibilityLabel={a.title}
      className={
        big
          ? 'flex-row gap-3.5 rounded-panel bg-surface p-2.5'
          : 'flex-row gap-3.5 rounded-card bg-surface p-2.5'
      }
    >
      <Photo
        uri={a.coverUrl ?? undefined}
        hue={hueFor(a)}
        style={{ width: thumb, height: thumb, borderRadius: big ? 14 : 12 }}
      />
      <View className={big ? 'min-w-0 flex-1 py-0.5 pr-1' : 'min-w-0 flex-1 justify-center gap-1'}>
        <Text
          className={
            big
              ? 'font-sans-medium text-label text-lime'
              : 'font-sans-medium text-footnote text-lime'
          }
        >
          {whenLabel(a)}
        </Text>
        <Text
          className={
            big
              ? 'mt-[5px] font-sans-semibold text-headline leading-subhead text-ink'
              : 'font-sans-semibold text-body leading-label text-ink'
          }
        >
          {a.title}
        </Text>
        {meta === 'place' ? (
          <Text className="font-sans text-footnote text-muted">{a.place}</Text>
        ) : (
          <View className={big ? 'mt-auto flex-row justify-between' : 'flex-row justify-between'}>
            <Text
              className={
                big ? 'font-sans text-label text-muted' : 'font-sans text-footnote text-muted'
              }
            >
              {[a.area, costLabel(a)].filter(Boolean).join(' · ')}
            </Text>
            <Text
              className={big ? 'font-sans text-label' : 'font-sans text-footnote'}
              style={{ color: availabilityColor(a) }}
            >
              {leftLabel(a)}
            </Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

/** Horizontal card in the "From your communities" row. */
export function CommunityPickCard({ activity: a }: { activity: Activity }) {
  return (
    <PressableScale
      scale="dim"
      onPress={() => openActivity(a.id)}
      accessibilityRole="button"
      accessibilityLabel={a.title}
    >
      <Photo
        uri={a.coverUrl ?? undefined}
        hue={hueFor(a)}
        className="h-[150px] w-[230px] rounded-panel border border-line"
      >
        <Scrim from={0.2} topOpacity={0.1} opacity={0.9} />
        <View className="absolute left-2.5 top-2.5 h-6 justify-center rounded-xl bg-glass-strong px-2.5">
          <Text className="font-sans-medium text-caption text-ink">{a.community?.name}</Text>
        </View>
        <View className="absolute inset-x-3 bottom-3">
          <Text className="font-sans-medium text-footnote text-lime">{whenLabel(a)}</Text>
          <Text className="mt-1 font-sans-semibold text-subhead leading-label text-ink">
            {a.title}
          </Text>
        </View>
      </Photo>
    </PressableScale>
  );
}

/** Card on "Your activities" with a chat preview strip. */
export function MyActivityCard({ activity: a }: { activity: MyActivity }) {
  return (
    <Card className="overflow-hidden">
      <PressableScale
        scale="dim"
        onPress={() => openActivity(a.id)}
        accessibilityRole="button"
        accessibilityLabel={a.title}
        className="flex-row gap-3.5 p-3"
      >
        <Photo
          uri={a.coverUrl ?? undefined}
          hue={hueFor(a)}
          style={{ width: 74, height: 74, borderRadius: 14 }}
        />
        <View className="min-w-0 flex-1 gap-[3px]">
          {a.cancelled ? (
            <Text className="font-sans-medium text-footnote text-danger">
              Cancelled · {whenLabel(a)}
            </Text>
          ) : (
            <Text className="font-sans-medium text-footnote text-lime">{whenLabel(a)}</Text>
          )}
          <Text className="font-sans-semibold text-headline leading-subhead text-ink">
            {a.title}
          </Text>
          <Text className="font-sans text-label text-muted">
            {a.place} · {a.goingCount} of {a.capacity} going
          </Text>
        </View>
      </PressableScale>
      <PressableScale
        scale="dim"
        onPress={() => router.push(`/activity/${a.id}/chat`)}
        accessibilityRole="button"
        accessibilityLabel={`Open chat for ${a.title}`}
        className="flex-row items-center gap-3 border-t border-divider-strong px-4 py-[13px]"
      >
        <Text className="min-w-0 flex-1 font-sans text-subhead text-ink-soft" numberOfLines={1}>
          {lastMessagePreview(a)}
        </Text>
        <View className="flex-row items-center gap-1">
          <Text className="font-sans-medium text-subhead text-lime">Chat</Text>
          <ArrowRightIcon />
        </View>
      </PressableScale>
    </Card>
  );
}

// ── Loading placeholders, shaped like the cards above ────────────────────

export function ActivityHeroSkeleton() {
  return <Skeleton className="h-[410px] rounded-modal" />;
}

export function ActivityRowSkeleton() {
  return (
    <Card className="flex-row gap-3.5 p-2.5">
      <Skeleton className="h-24 w-24 rounded-tile" />
      <View className="flex-1 gap-2 py-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-auto h-3 w-1/2" />
      </View>
    </Card>
  );
}

export function MyActivitySkeleton() {
  return (
    <Card className="overflow-hidden">
      <View className="flex-row gap-3.5 p-3">
        <Skeleton className="h-[74px] w-[74px] rounded-tile" />
        <View className="flex-1 gap-2 py-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </View>
      </View>
      <View className="border-t border-divider-strong px-4 py-[15px]">
        <Skeleton className="h-3 w-2/3" />
      </View>
    </Card>
  );
}
