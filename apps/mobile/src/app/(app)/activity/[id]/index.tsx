import { ERROR_CODES, type ActivityDetail } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ApiRequestError, errorMessage } from '@/api/client';
import { useActivity, useJoinActivity, useLeaveActivity } from '@/api/queries';
import {
  Avatar,
  BackButton,
  Button,
  Eyebrow,
  Footer,
  Heading,
  LoadError,
  Loading,
  Photo,
  Scrim,
} from '@/components/ui';
import { NotFound } from '@/components/ui/NotFound';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { distanceLabel, hueFor, spotsLabel, spotsLeft, whenLong } from '@/lib/activity';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

const MAX_FACES = 5;

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activity = useActivity(id);
  const join = useJoinActivity();
  const leave = useLeaveActivity();
  const { top } = useScreenInsets();

  if (activity.isLoading) return <Loading className="flex-1 bg-bg" />;
  if (activity.error instanceof ApiRequestError && activity.error.status === 404) {
    return <NotFound message="This activity is no longer available." />;
  }
  if (!activity.data) {
    return (
      <View className="flex-1 justify-center bg-bg px-[22px]">
        <LoadError error={activity.error} onRetry={() => void activity.refetch()} />
      </View>
    );
  }
  const a = activity.data;

  const left = spotsLeft(a);
  const isIn = a.viewer.joined || a.viewer.hosting;
  const busy = join.isPending || leave.isPending;
  const hosted = a.host.hostedCount;
  const hostMeta = [
    `Hosted ${hosted} ${hosted === 1 ? 'activity' : 'activities'}`,
    a.community?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  const onJoin = () =>
    join.mutate(a.id, {
      onSuccess: () => toast('You’re in. Say hi in the group chat.'),
      onError: (err) =>
        toast(
          err instanceof ApiRequestError && err.code === ERROR_CODES.activityFull
            ? 'This activity just filled up.'
            : errorMessage(err),
        ),
    });
  const onLeave = () =>
    leave.mutate(a.id, {
      onSuccess: () => toast('You left the activity.'),
      onError: (err) => toast(errorMessage(err)),
    });

  return (
    <View className="flex-1 bg-bg">
      <ScrollView className="flex-1">
        <Photo uri={a.coverUrl ?? undefined} hue={hueFor(a)} style={{ height: 330 }}>
          <Scrim from={0.5} opacity={1} />
          <View className="absolute left-[18px]" style={{ top: top(56) }}>
            <BackButton tone="glass" />
          </View>
          <Eyebrow className="absolute bottom-1 left-[22px]">{a.category}</Eyebrow>
        </Photo>

        <View className="px-[22px] pb-6 pt-3">
          <Heading size="page">{a.title}</Heading>
          {a.community ? (
            <Pressable
              onPress={() => router.push(`/community/${a.community!.id}`)}
              className="mt-3 h-8 flex-row items-center gap-1.5 self-start rounded-2xl border border-outline px-[13px] active:opacity-80"
            >
              <Text className="font-sans-medium text-[13.5px] text-muted">Part of</Text>
              <Text className="font-sans-medium text-[13.5px] text-ink">{a.community.name}</Text>
              <Text className="font-sans-medium text-[13.5px] text-lime">→</Text>
            </Pressable>
          ) : null}

          <View className="mt-5 flex-row gap-[9px]">
            <InfoTile label="When" value={whenLong(a)} />
            <InfoTile label="Where" value={a.place} sub={`${a.area} · ${distanceLabel(a)}`} />
          </View>

          <Attendance activity={a} />

          <Pressable
            disabled={a.viewer.hosting}
            onPress={() => router.push(`/user/${a.host.id}`)}
            className="mt-[18px] flex-row items-center gap-3.5 active:opacity-80"
            accessibilityRole={a.viewer.hosting ? undefined : 'button'}
          >
            <Avatar uri={a.host.avatarUrl ?? undefined} size={46} />
            <View>
              <Text className="font-sans-semibold text-[16px] text-ink">
                Hosted by {a.viewer.hosting ? 'you' : a.host.name}
              </Text>
              <Text className="mt-[3px] font-sans text-[13.5px] text-muted">{hostMeta}</Text>
            </View>
          </Pressable>

          {a.description ? (
            <Text className="mt-5 font-sans text-[15px] leading-[22.5px] text-ink-dim">
              {a.description}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <Footer className="flex-row gap-2.5">
        {!isIn && left > 0 ? (
          <Button
            label={join.isPending ? 'Joining…' : 'Join activity'}
            inactive={busy}
            onPress={onJoin}
            className="flex-1"
          />
        ) : null}
        {!isIn && left <= 0 ? (
          <Button label="Activity full" inactive disabled className="flex-1" />
        ) : null}
        {isIn ? (
          <>
            <Button
              label="Open group chat"
              onPress={() => router.push(`/activity/${a.id}/chat`)}
              className="flex-1"
            />
            {a.viewer.joined ? (
              <Button
                label={leave.isPending ? 'Leaving…' : 'Leave'}
                variant="outline"
                disabled={busy}
                onPress={onLeave}
                className="px-5"
              />
            ) : null}
          </>
        ) : null}
      </Footer>
    </View>
  );
}

function InfoTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-surface px-[15px] py-3.5">
      <Text className="font-sans text-[13px] text-muted">{label}</Text>
      <Text className="mt-[5px] font-sans-semibold text-[15.5px] text-ink">{value}</Text>
      {sub ? <Text className="mt-[3px] font-sans text-[13px] text-muted">{sub}</Text> : null}
    </View>
  );
}

function Attendance({ activity: a }: { activity: ActivityDetail }) {
  const pct = Math.min(100, (a.goingCount / a.capacity) * 100);
  const extra = a.goingCount - a.attendees.length;

  return (
    <View className="mt-2.5 rounded-[18px] bg-surface p-4">
      <View className="flex-row justify-between">
        <Text className="font-sans-semibold text-[15.5px] text-ink">
          {a.goingCount} of {a.capacity} going
        </Text>
        <Text className="font-sans text-[14px] text-muted">{spotsLabel(a)}</Text>
      </View>
      <View className="mt-3.5 h-1.5 overflow-hidden rounded-[3px] bg-track">
        <View className="h-full rounded-[3px] bg-lime" style={{ width: `${pct}%` }} />
      </View>
      <View className="mt-3.5 flex-row items-center">
        {a.attendees.slice(0, MAX_FACES).map((p) => (
          <Avatar
            key={p.id}
            uri={p.avatarUrl ?? undefined}
            size={32}
            ring={colors.surface}
            style={{ marginRight: -6 }}
            onPress={() => router.push(`/user/${p.id}`)}
            accessibilityLabel={p.name}
          />
        ))}
        {extra > 0 ? (
          <Text className="ml-[18px] font-sans text-[14px] text-muted">+{extra} more</Text>
        ) : null}
      </View>
    </View>
  );
}
