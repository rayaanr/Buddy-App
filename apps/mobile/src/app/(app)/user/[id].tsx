import type { PublicProfile } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ApiRequestError, errorMessage } from '@/api/client';
import { useMe, useSetBlocked, useUser } from '@/api/queries';
import { ActivityRow } from '@/components/activity/ActivityCards';
import {
  Avatar,
  BackButton,
  Button,
  Heading,
  LoadError,
  Loading,
  SectionLabel,
  Tag,
} from '@/components/ui';
import { NotFound } from '@/components/ui/NotFound';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { firstName, monthYear } from '@/lib/activity';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser(id);
  const me = useMe();
  const { top } = useScreenInsets();

  if (user.isLoading) return <Loading className="flex-1 bg-bg" />;
  if (user.error instanceof ApiRequestError && user.error.status === 404) {
    return <NotFound message="This person is no longer on Buddy." />;
  }
  if (!user.data) {
    return (
      <View className="flex-1 justify-center bg-bg px-[22px]">
        <LoadError error={user.error} onRetry={() => void user.refetch()} />
      </View>
    );
  }
  const u = user.data;
  const common = new Set(u.commonInterests);

  return (
    <View className="flex-1 bg-bg">
      <View className="px-[18px]" style={{ paddingTop: top(56) }}>
        <BackButton />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 30 }}
      >
        <Avatar
          uri={u.avatarUrl ?? undefined}
          size={104}
          ring={colors.line}
          ringWidth={3}
          style={{ alignSelf: 'center' }}
        />
        <Heading size="section" className="mt-4 text-center">
          {u.name}
        </Heading>
        <Text className="mt-1.5 text-center font-sans text-[14.5px] text-muted">
          {u.area} · on Buddy since {monthYear(u.memberSince)}
        </Text>
        {u.bio ? (
          <Text className="mt-4 max-w-[300px] self-center text-center font-sans text-[15px] leading-[22.5px] text-ink-dim">
            {u.bio}
          </Text>
        ) : null}

        <View className="mt-5 flex-row gap-2">
          <Stat value={u.hostedCount} label="Hosted" />
          <Stat value={u.joinedCount} label="Joined" />
        </View>

        <View className="mb-2.5 mt-6 flex-row justify-between">
          <SectionLabel>Into</SectionLabel>
          {common.size ? <SectionLabel tone="lime">{common.size} in common</SectionLabel> : null}
        </View>
        <View className="flex-row flex-wrap gap-2">
          {u.interests.map((t) => (
            <Tag key={t} label={t} active={common.has(t)} />
          ))}
        </View>

        {u.hosting.length > 0 ? (
          <>
            <SectionLabel className="mb-2.5 mt-6">Hosting on Buddy</SectionLabel>
            <View className="gap-2.5">
              {u.hosting.map((a) => (
                <ActivityRow key={a.id} activity={a} thumb={64} meta="place" />
              ))}
            </View>
          </>
        ) : null}

        {me.data && me.data.id !== u.id ? <SafetyActions person={u} /> : null}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-surface px-3.5 pb-4 pt-3.5">
      <Text className="font-display text-[22px] text-ink">{value}</Text>
      <Text className="mt-1 font-sans text-[13px] text-muted">{label}</Text>
    </View>
  );
}

/** Report and block, or unblock if you already blocked them. */
function SafetyActions({ person }: { person: PublicProfile }) {
  const setBlocked = useSetBlocked();
  const [confirming, setConfirming] = useState(false);
  const name = firstName(person.name);

  const update = (blocked: boolean) =>
    setBlocked.mutate(
      { userId: person.id, blocked },
      {
        onSuccess: () => {
          setConfirming(false);
          toast(blocked ? `Blocked ${name}.` : `Unblocked ${name}.`);
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );

  if (person.blockedByYou || confirming) {
    return (
      <View className="mt-8 rounded-[18px] bg-surface px-[18px] py-4">
        <Text className="font-sans-semibold text-[16px] text-ink">
          {person.blockedByYou ? `You blocked ${name}` : `Block ${name}?`}
        </Text>
        <Text className="mt-1.5 font-sans text-[14.5px] leading-[21px] text-muted">
          {person.blockedByYou
            ? 'You won’t see each other’s activities or messages.'
            : 'You won’t see each other’s activities or messages, and they can’t view your profile. They won’t be told.'}
        </Text>
        <View className="mt-4 flex-row gap-2.5">
          {person.blockedByYou ? (
            <Button
              label="Unblock"
              variant="outline"
              size="md"
              disabled={setBlocked.isPending}
              onPress={() => update(false)}
              className="flex-1"
            />
          ) : (
            <>
              <Button
                label="Cancel"
                variant="outline"
                size="md"
                onPress={() => setConfirming(false)}
                className="flex-1"
              />
              <Button
                label={setBlocked.isPending ? 'Blocking…' : 'Block'}
                variant="danger-outline"
                size="md"
                disabled={setBlocked.isPending}
                onPress={() => update(true)}
                className="flex-1"
              />
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View className="mt-8 flex-row justify-center gap-2">
      <Button
        label={`Report ${name}`}
        variant="ghost"
        size="sm"
        weight="medium"
        onPress={() =>
          router.push({
            pathname: '/report',
            params: { type: 'user', id: person.id, userId: person.id, name: person.name },
          })
        }
      />
      <Button
        label={`Block ${name}`}
        variant="danger"
        size="sm"
        weight="medium"
        onPress={() => setConfirming(true)}
      />
    </View>
  );
}
