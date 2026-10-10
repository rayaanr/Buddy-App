import type { PublicProfile } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ApiRequestError, errorMessage } from '@/api/client';
import { useMe, useSetBlocked, useUser } from '@/api/queries';
import { ActivityRow } from '@/components/activity/ActivityCards';
import {
  ActionSheet,
  Avatar,
  BackButton,
  Button,
  Heading,
  LoadError,
  Loading,
  MoreButton,
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
  const [sheet, setSheet] = useState<'menu' | 'confirm-block' | null>(null);

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
  const isMe = me.data?.id === u.id;

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row justify-between px-[18px]" style={{ paddingTop: top(56) }}>
        <BackButton />
        {me.data && !isMe ? <MoreButton onPress={() => setSheet('menu')} /> : null}
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
        {u.area ? (
          <Text className="mt-1.5 text-center font-sans text-[14.5px] text-muted">{u.area}</Text>
        ) : null}
        <Text className="mt-0.5 text-center font-sans text-[12.5px] text-subtle">
          On Buddy since {monthYear(u.memberSince)}
        </Text>
        {u.bio ? (
          <Text className="mt-4 max-w-[300px] self-center text-center font-sans text-[15px] leading-[22.5px] text-ink-dim">
            {u.bio}
          </Text>
        ) : null}

        {/* Blocked by you: the API only sends their name and photo. */}
        {u.blockedByYou ? null : (
          <>
            <View className="mt-5 flex-row gap-2">
              <Stat value={u.hostedCount} label="Hosted" />
              <Stat value={u.joinedCount} label="Joined" />
            </View>

            <View className="mb-2.5 mt-6 flex-row justify-between">
              <SectionLabel>Into</SectionLabel>
              {common.size ? (
                <SectionLabel tone="lime">{common.size} in common</SectionLabel>
              ) : null}
            </View>
            <View className="flex-row flex-wrap gap-2">
              {u.interests.map((t) => (
                <Tag key={t} label={t} active={common.has(t)} />
              ))}
            </View>
          </>
        )}

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

        {u.blockedByYou ? <BlockedNotice person={u} /> : null}
      </ScrollView>

      <SafetySheet person={u} mode={sheet} onChange={setSheet} />
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

function useBlockToggle(person: PublicProfile) {
  const setBlocked = useSetBlocked();
  const name = firstName(person.name);
  const update = (blocked: boolean) =>
    setBlocked.mutate(
      { userId: person.id, blocked },
      {
        onSuccess: () => toast(blocked ? `Blocked ${name}.` : `Unblocked ${name}.`),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  return { update, pending: setBlocked.isPending, name };
}

/** "⋯" menu: report or block, then a confirmation before blocking. */
function SafetySheet({
  person,
  mode,
  onChange,
}: {
  person: PublicProfile;
  mode: 'menu' | 'confirm-block' | null;
  onChange: (mode: 'menu' | 'confirm-block' | null) => void;
}) {
  const { update, name } = useBlockToggle(person);
  const close = () => onChange(null);

  if (mode === 'confirm-block') {
    return (
      <ActionSheet
        visible
        onClose={close}
        title={`Block ${name}?`}
        message="You won’t see each other’s activities or messages, and they can’t view your profile. They won’t be told."
        actions={[{ label: 'Block', destructive: true, onPress: () => update(true) }]}
      />
    );
  }

  return (
    <ActionSheet
      visible={mode === 'menu'}
      onClose={close}
      actions={[
        {
          label: `Report ${name}`,
          onPress: () =>
            router.push({
              pathname: '/report',
              params: { type: 'user', id: person.id, userId: person.id, name: person.name },
            }),
        },
        person.blockedByYou
          ? { label: `Unblock ${name}`, onPress: () => update(false) }
          : { label: `Block ${name}`, destructive: true, onPress: () => onChange('confirm-block') },
      ]}
    />
  );
}

/** Shown on the profile of someone you blocked, with a quick way back. */
function BlockedNotice({ person }: { person: PublicProfile }) {
  const { update, pending, name } = useBlockToggle(person);
  return (
    <View className="mt-8 rounded-[18px] bg-surface px-[18px] py-4">
      <Text className="font-sans-semibold text-[16px] text-ink">You blocked {name}</Text>
      <Text className="mt-1.5 font-sans text-[14.5px] leading-[21px] text-muted">
        You won’t see each other’s activities or messages.
      </Text>
      <Button
        label="Unblock"
        variant="outline"
        size="md"
        disabled={pending}
        onPress={() => update(false)}
        className="mt-4"
      />
    </View>
  );
}
