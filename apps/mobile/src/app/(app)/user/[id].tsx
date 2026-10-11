import { firstName, monthYear } from '@buddy/shared';
import type { PublicProfile } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useMe, useSetBlocked, useUser } from '@/api/queries';
import { ActivityRow } from '@/components/activity/ActivityCards';
import {
  ActionSheet,
  Avatar,
  Button,
  Heading,
  Menu,
  QueryFallback,
  ScreenHeader,
  SectionLabel,
  StatTile,
  Tag,
} from '@/components/ui';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser(id);
  const me = useMe();

  if (!user.data)
    return <QueryFallback query={user} notFound="This person is no longer on Buddy." />;
  const u = user.data;
  const common = new Set(u.commonInterests);
  const isMe = me.data?.id === u.id;

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader right={me.data && !isMe ? <SafetyMenu person={u} /> : null} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 30 }}
      >
        <Avatar
          uri={u.avatarUrl ?? undefined}
          name={u.name}
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
          On Buddy since {monthYear(new Date(u.memberSince))}
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
              <StatTile value={u.hostedCount} label="Hosted" />
              <StatTile value={u.joinedCount} label="Joined" />
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
function SafetyMenu({ person }: { person: PublicProfile }) {
  const { update, name } = useBlockToggle(person);
  const [confirmBlock, setConfirmBlock] = useState(false);
  return (
    <>
      <Menu
        label="More options"
        items={[
          {
            label: `Report ${name}`,
            onPress: () =>
              router.push({ pathname: '/report', params: { type: 'user', id: person.id } }),
          },
          person.blockedByYou
            ? { label: `Unblock ${name}`, onPress: () => update(false) }
            : { label: `Block ${name}`, destructive: true, onPress: () => setConfirmBlock(true) },
        ]}
      />
      <ActionSheet
        visible={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title={`Block ${name}?`}
        message="You won’t see each other’s activities or messages, and they can’t view your profile. They won’t be told."
        actions={[{ label: 'Block', destructive: true, onPress: () => update(true) }]}
      />
    </>
  );
}

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
