import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  Avatar,
  BackButton,
  Button,
  Eyebrow,
  Footer,
  Heading,
  Photo,
  Scrim,
} from '@/components/ui';
import { NotFound } from '@/components/ui/NotFound';
import { MY_AVATAR } from '@/data/images';
import { ATTENDEE_FACES, USERS } from '@/data/users';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { spotsLabel, spotsLeft, whenLong } from '@/lib/activity';
import { useActivitiesStore, useActivity, useCommunity } from '@/store/activities';
import { useAccount } from '@/store/session';
import { toast } from '@/store/ui';
import { colors } from '@/theme';
import type { Activity } from '@/types/models';

const MAX_FACES = 5;

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activity = useActivity(id);
  const community = useCommunity(activity?.communityId);
  const account = useAccount();
  const join = useActivitiesStore((s) => s.join);
  const leave = useActivitiesStore((s) => s.leave);
  const { top } = useScreenInsets();

  if (!activity) return <NotFound message="This activity is no longer available." />;
  const a = activity;

  const left = spotsLeft(a);
  const isIn = !!(a.joined || a.hosting);
  const canJoin = !isIn && left > 0;
  const hostAvatar = a.hosting ? MY_AVATAR : USERS[a.host]?.avatar;

  const onJoin = () => {
    join(a.id, account.name);
    toast('You’re in. Say hi in the group chat.');
  };
  const onLeave = () => {
    leave(a.id, account.name);
    toast('You left the activity.');
  };

  return (
    <View className="flex-1 bg-bg">
      <ScrollView className="flex-1">
        <Photo uri={a.image} hue={a.hue} style={{ height: 330 }}>
          <Scrim from={0.5} opacity={1} />
          <View className="absolute left-[18px]" style={{ top: top(56) }}>
            <BackButton tone="glass" />
          </View>
          <Eyebrow className="absolute bottom-1 left-[22px]">{a.category}</Eyebrow>
        </Photo>

        <View className="px-[22px] pb-6 pt-3">
          <Heading size="page">{a.title}</Heading>
          {community ? (
            <Pressable
              onPress={() => router.push(`/community/${community.id}`)}
              className="mt-3 h-8 flex-row items-center gap-1.5 self-start rounded-2xl border border-outline px-[13px] active:opacity-80"
            >
              <Text className="font-sans-medium text-[13.5px] text-muted">Part of</Text>
              <Text className="font-sans-medium text-[13.5px] text-ink">{community.name}</Text>
              <Text className="font-sans-medium text-[13.5px] text-lime">→</Text>
            </Pressable>
          ) : null}

          <View className="mt-5 flex-row gap-[9px]">
            <InfoTile label="When" value={whenLong(a)} />
            <InfoTile label="Where" value={a.place} sub={a.placeDetail} />
          </View>

          <Attendance activity={a} />

          <Pressable
            disabled={a.hosting}
            onPress={() => router.push({ pathname: '/user/[name]', params: { name: a.host } })}
            className="mt-[18px] flex-row items-center gap-3.5 active:opacity-80"
            accessibilityRole={a.hosting ? undefined : 'button'}
          >
            <Avatar uri={hostAvatar} size={46} fallback={a.hosting ? colors.me : a.hostColor} />
            <View>
              <Text className="font-sans-semibold text-[16px] text-ink">Hosted by {a.host}</Text>
              <Text className="mt-[3px] font-sans text-[13.5px] text-muted">{a.hostMeta}</Text>
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
        {canJoin ? <Button label="Join activity" onPress={onJoin} className="flex-1" /> : null}
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
            {a.joined ? (
              <Button label="Leave" variant="outline" onPress={onLeave} className="px-5" />
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

function Attendance({ activity: a }: { activity: Activity }) {
  const pct = Math.min(100, (a.going / a.capacity) * 100);
  const n = Math.min(a.going, MAX_FACES);

  let faces: { uri?: string; fallback: string }[] = [
    { uri: USERS[a.host]?.avatar, fallback: a.hostColor },
    ...ATTENDEE_FACES.map((uri) => ({ uri, fallback: colors['avatar-fallback'] })),
  ].slice(0, n);
  if (a.joined && n) faces[n - 1] = { uri: MY_AVATAR, fallback: colors.me };
  if (a.hosting) faces = [{ uri: MY_AVATAR, fallback: colors.me }];

  return (
    <View className="mt-2.5 rounded-[18px] bg-surface p-4">
      <View className="flex-row justify-between">
        <Text className="font-sans-semibold text-[15.5px] text-ink">
          {a.going} of {a.capacity} going
        </Text>
        <Text className="font-sans text-[14px] text-muted">{spotsLabel(a)}</Text>
      </View>
      <View className="mt-3.5 h-1.5 overflow-hidden rounded-[3px] bg-track">
        <View className="h-full rounded-[3px] bg-lime" style={{ width: `${pct}%` }} />
      </View>
      <View className="mt-3.5 flex-row items-center">
        {faces.map((f, k) => (
          <Avatar
            key={k}
            uri={f.uri}
            size={32}
            fallback={f.fallback}
            ring={colors.surface}
            style={{ marginRight: -6 }}
          />
        ))}
        {a.going > MAX_FACES ? (
          <Text className="ml-[18px] font-sans text-[14px] text-muted">
            +{a.going - MAX_FACES} more
          </Text>
        ) : null}
      </View>
    </View>
  );
}
