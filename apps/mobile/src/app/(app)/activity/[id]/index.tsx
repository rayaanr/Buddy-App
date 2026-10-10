import { ERROR_CODES, isDeletedAccount, LIMITS, type ActivityDetail } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ApiRequestError, errorMessage } from '@/api/client';
import {
  useActivity,
  useCancelActivity,
  useJoinActivity,
  useLeaveActivity,
  useMuteChat,
  useWaitlist,
} from '@/api/queries';
import {
  ActionSheet,
  AnimatedView,
  ArrowRightIcon,
  Avatar,
  BackButton,
  Button,
  Eyebrow,
  Footer,
  Heading,
  IconButton,
  MoreButton,
  Photo,
  PressableScale,
  QueryFallback,
  Scrim,
  ShareIcon,
  type SheetAction,
  successHaptic,
  useEnterOnChange,
} from '@/components/ui';
import { MembersSheet } from '@/components/activity/MembersSheet';
import { useHasPassed } from '@/hooks/useNow';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import {
  distanceLabel,
  firstName,
  hueFor,
  ordinal,
  spotsLabel,
  spotsLeft,
  weekday,
  whenLong,
} from '@/lib/activity';
import { shareActivity } from '@/lib/share';
import { toast } from '@/store/ui';
import { colors } from '@/theme';
import { spring } from '@/theme/motion';

const MAX_FACES = 5;

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activity = useActivity(id);

  if (!activity.data)
    return <QueryFallback query={activity} notFound="This activity is no longer available." />;
  return <ActivityView activity={activity.data} />;
}

/** Parallax cover photo; a compact title bar fades in once the title scrolls away. */
const COVER_HEIGHT = 330;

function ActivityView({ activity: a }: { activity: ActivityDetail }) {
  const join = useJoinActivity();
  const leave = useLeaveActivity();
  const waitlist = useWaitlist();
  const mute = useMuteChat();
  const cancel = useCancelActivity();
  const { top } = useScreenInsets();
  const started = useHasPassed(a.startsAt);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Hosts can change or call off an activity until it starts.
  const canManage = a.viewer.hosting && !a.cancelled && !started;

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  // Scrolling up, the cover moves at half speed; pulling down (iOS), it stretches.
  const coverStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      transform: [
        { translateY: y < 0 ? y / 2 : y * 0.45 },
        { scale: y < 0 ? 1 + -y / COVER_HEIGHT : 1 },
      ],
    };
  });
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.get(),
      [COVER_HEIGHT - 130, COVER_HEIGHT - 70],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const left = spotsLeft(a);
  const isIn = a.viewer.joined || a.viewer.hosting;
  const position = a.viewer.waitlistPosition;
  // Full: wait for a spot, unless it has started or the waitlist is full too.
  const canWait = !isIn && left <= 0 && !started && a.waitingCount < LIMITS.waitlistMax;
  // The footer's buttons pop when you join, leave or start waiting.
  const footerStyle = useEnterOnChange(isIn ? 'in' : position ? 'waiting' : 'out', 'pop');
  const busy = join.isPending || leave.isPending || waitlist.isPending;
  const hosted = a.host.hostedCount;
  const hostMeta = [
    `Hosted ${hosted} ${hosted === 1 ? 'activity' : 'activities'}`,
    a.community?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  const onJoin = () =>
    join.mutate(a.id, {
      onSuccess: () => {
        successHaptic();
        toast('You’re in. Say hi in the group chat.');
      },
      onError: (err) =>
        toast(
          err instanceof ApiRequestError && err.code === ERROR_CODES.activityFull
            ? 'This activity just filled up.'
            : errorMessage(err),
        ),
    });
  const onMute = () =>
    mute.mutate(
      { id: a.id, muted: !a.viewer.chatMuted },
      {
        onSuccess: (detail) =>
          toast(
            detail.viewer.chatMuted
              ? 'Group chat muted. You’ll still get reminders and changes.'
              : 'Group chat unmuted.',
          ),
        onError: (err) => toast(errorMessage(err)),
      },
    );

  // ⋯ menu: what you can do depends on whether you host, are going, or are browsing.
  const menu: SheetAction[] = [
    ...(isIn
      ? [{ label: a.viewer.chatMuted ? 'Unmute group chat' : 'Mute group chat', onPress: onMute }]
      : []),
    ...(canManage
      ? [
          { label: 'Edit activity', onPress: () => router.push(`/activity/${a.id}/edit`) },
          { label: 'Cancel activity', destructive: true, onPress: () => setConfirmCancel(true) },
        ]
      : []),
    ...(a.viewer.hosting
      ? []
      : [
          {
            label: 'Report activity',
            destructive: true,
            onPress: () =>
              router.push({
                pathname: '/report',
                params: { type: 'activity', id: a.id },
              }),
          },
        ]),
  ];

  const onCancel = (stopRepeating = false) =>
    cancel.mutate(
      { id: a.id, stopRepeating },
      {
        onSuccess: () =>
          toast(
            stopRepeating
              ? 'Cancelled, and it won’t repeat. Everyone going has been told.'
              : 'Cancelled. Everyone going has been told.',
          ),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  const onWaitlist = () =>
    waitlist.mutate(
      { id: a.id, waiting: !!position },
      {
        onSuccess: (detail) => {
          if (position) return toast('You left the waitlist.');
          if (detail.viewer.joined) {
            successHaptic();
            return toast('A spot was free, so you’re in.');
          }
          toast('You’re on the waitlist. We’ll let you know if a spot opens.');
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  const onLeave = () =>
    leave.mutate(a.id, {
      onSuccess: () => toast('You left the activity.'),
      onError: (err) => toast(errorMessage(err)),
    });

  return (
    <View className="flex-1 bg-bg">
      <Animated.ScrollView style={styles.flex} onScroll={onScroll} scrollEventThrottle={16}>
        <AnimatedView style={coverStyle}>
          <Photo uri={a.coverUrl ?? undefined} hue={hueFor(a)} style={{ height: COVER_HEIGHT }}>
            <Scrim from={0.5} opacity={1} />
            <Eyebrow className="absolute bottom-1 left-[22px]">{a.category}</Eyebrow>
          </Photo>
        </AnimatedView>

        <View className="bg-bg px-[22px] pb-6 pt-3">
          <Heading size="page">{a.title}</Heading>
          {a.cancelled ? (
            <View className="mt-3 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3">
              <Text className="font-sans-semibold text-[15px] text-danger">Cancelled</Text>
              <Text className="mt-0.5 font-sans text-[14px] leading-[20px] text-ink-dim">
                {a.viewer.hosting
                  ? 'You called this off. The group chat stays open.'
                  : `${firstName(a.host.name)} called this off. The group chat stays open.`}
              </Text>
            </View>
          ) : null}
          {a.community ? (
            <PressableScale
              onPress={() => router.push(`/community/${a.community!.id}`)}
              className="mt-3 h-8 flex-row items-center gap-1.5 self-start rounded-2xl border border-outline px-[13px]"
            >
              <Text className="font-sans-medium text-[13.5px] text-muted">Part of</Text>
              <Text className="font-sans-medium text-[13.5px] text-ink">{a.community.name}</Text>
              <ArrowRightIcon size={14} />
            </PressableScale>
          ) : null}

          <View className="mt-5 flex-row gap-[9px]">
            <InfoTile
              label="When"
              value={whenLong(a)}
              sub={a.repeatsWeekly ? `Every ${weekday(new Date(a.startsAt))}` : undefined}
            />
            <InfoTile label="Where" value={a.place} sub={`${a.area} · ${distanceLabel(a)}`} />
          </View>

          <Attendance activity={a} canRemove={canManage} />

          <PressableScale
            disabled={a.viewer.hosting || isDeletedAccount(a.host)}
            onPress={() => router.push(`/user/${a.host.id}`)}
            className="mt-[18px] flex-row items-center gap-3.5"
            accessibilityRole={a.viewer.hosting || isDeletedAccount(a.host) ? undefined : 'button'}
            scale="dim"
          >
            <Avatar uri={a.host.avatarUrl ?? undefined} size={46} />
            <View>
              <Text className="font-sans-semibold text-[16px] text-ink">
                Hosted by {a.viewer.hosting ? 'you' : a.host.name}
              </Text>
              <Text className="mt-[3px] font-sans text-[13.5px] text-muted">{hostMeta}</Text>
            </View>
          </PressableScale>

          {a.description ? (
            <Text className="mt-5 font-sans text-[15px] leading-[22.5px] text-ink-dim">
              {a.description}
            </Text>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* Fixed header: a bar with the title fades in over the buttons as you scroll. */}
      <View className="absolute inset-x-0 top-0" pointerEvents="box-none">
        <AnimatedView pointerEvents="none" style={[styles.bar, barStyle]} />
        <View
          className="flex-row items-center gap-3 px-[18px] pb-2.5"
          style={{ paddingTop: top(56) }}
          pointerEvents="box-none"
        >
          <BackButton tone="glass" />
          <AnimatedView style={[styles.flex, barStyle]} pointerEvents="none">
            <Text className="font-sans-semibold text-[16px] text-ink" numberOfLines={1}>
              {a.title}
            </Text>
          </AnimatedView>
          {a.cancelled ? null : (
            <IconButton
              tone="glass"
              icon={<ShareIcon />}
              label="Share"
              onPress={() => void shareActivity(a)}
            />
          )}
          {menu.length ? <MoreButton tone="glass" onPress={() => setMenuOpen(true)} /> : null}
        </View>
      </View>

      <Footer className="flex-row gap-2.5">
        <AnimatedView style={[styles.footerRow, footerStyle]}>
          {!isIn && left > 0 ? (
            <Button
              label={join.isPending ? 'Joining…' : 'Join activity'}
              inactive={busy}
              onPress={onJoin}
              className="flex-1"
            />
          ) : null}
          {!isIn && left <= 0 && position ? (
            <>
              <View className="flex-1 justify-center">
                <Text className="font-sans-semibold text-[16px] text-ink">
                  You’re {ordinal(position)} in line
                </Text>
                <Text className="mt-0.5 font-sans text-[13px] text-muted">
                  We’ll move you in if a spot opens.
                </Text>
              </View>
              <Button
                label={waitlist.isPending ? 'Leaving…' : 'Leave waitlist'}
                variant="outline"
                disabled={busy}
                onPress={onWaitlist}
                className="px-5"
              />
            </>
          ) : null}
          {!isIn && left <= 0 && !position && canWait ? (
            <Button
              label={waitlist.isPending ? 'Joining…' : 'Join waitlist'}
              variant="outline"
              disabled={busy}
              onPress={onWaitlist}
              className="flex-1"
            />
          ) : null}
          {!isIn && left <= 0 && !position && !canWait ? (
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
        </AnimatedView>
      </Footer>

      <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} actions={menu} />
      <ActionSheet
        visible={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this activity?"
        message={
          a.repeatsWeekly
            ? 'Everyone going gets a notification. You can’t undo this. Next week’s still goes up unless you stop it repeating.'
            : 'Everyone going gets a notification. You can’t undo this.'
        }
        cancelLabel="Keep it"
        actions={
          a.repeatsWeekly
            ? [
                { label: 'Cancel this week only', destructive: true, onPress: () => onCancel() },
                {
                  label: 'Cancel and stop repeating',
                  destructive: true,
                  onPress: () => onCancel(true),
                },
              ]
            : [{ label: 'Cancel activity', destructive: true, onPress: () => onCancel() }]
        }
      />
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

function Attendance({ activity: a, canRemove }: { activity: ActivityDetail; canRemove: boolean }) {
  const pct = Math.min(100, (a.goingCount / a.capacity) * 100);
  const extra = a.goingCount - a.attendees.length;

  // The bar fills in on arrival and slides when someone joins or leaves.
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withSpring(pct, spring.gentle));
  }, [pct, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get()}%` }));
  const countStyle = useEnterOnChange(a.goingCount);
  const [membersOpen, setMembersOpen] = useState(false);
  const going = `${a.goingCount} of ${a.capacity} going`;

  return (
    <>
      <PressableScale
        scale="dim"
        onPress={() => setMembersOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${going}. See who's going`}
        className="mt-2.5 rounded-[18px] bg-surface p-4"
      >
        <View className="flex-row justify-between">
          <AnimatedView style={countStyle}>
            <Text className="font-sans-semibold text-[15.5px] text-ink">{going}</Text>
          </AnimatedView>
          <Text className="font-sans text-[14px] text-muted">{spotsLabel(a)}</Text>
        </View>
        <View className="mt-3.5 h-1.5 overflow-hidden rounded-[3px] bg-track">
          <AnimatedView style={[styles.fill, fillStyle]} />
        </View>
        <View className="mt-3.5 flex-row items-center">
          {a.attendees.slice(0, MAX_FACES).map((p) => (
            <Avatar
              key={p.id}
              uri={p.avatarUrl ?? undefined}
              size={32}
              ring={colors.surface}
              style={{ marginRight: -6 }}
            />
          ))}
          {extra > 0 ? (
            <Text className="ml-[18px] font-sans text-[14px] text-muted">+{extra} more</Text>
          ) : null}
          <View className="ml-auto flex-row items-center gap-1">
            <Text className="font-sans-medium text-[14px] text-lime">See all</Text>
            <ArrowRightIcon size={14} />
          </View>
        </View>
      </PressableScale>
      <MembersSheet
        activityId={a.id}
        canRemove={canRemove}
        title={going}
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
      />
    </>
  );
}

// Style objects, not classes: NativeWind doesn't style Reanimated views.
const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  flex: { flex: 1 },
  footerRow: { flex: 1, flexDirection: 'row', gap: 10 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.lime },
});
