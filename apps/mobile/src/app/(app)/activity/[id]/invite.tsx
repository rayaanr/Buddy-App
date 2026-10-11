import { type ActivityDetail, type Invitee, LIMITS } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useActivity, useInvite, useInvitees } from '@/api/queries';
import {
  Avatar,
  Button,
  CheckIcon,
  EmptyState,
  Footer,
  Heading,
  KeyboardAwareScrollView,
  KeyboardScreen,
  LoadError,
  Loading,
  QueryFallback,
  SectionLabel,
  ShareIcon,
  successHaptic,
  TextField,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { whenLong } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { shareActivity } from '@/lib/share';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

/**
 * Invite people you've been at an activity with: each gets a notification
 * from you, with your note. Anyone else gets a link through the share sheet.
 */
export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activity = useActivity(id);
  if (!activity.data)
    return <QueryFallback query={activity} notFound="This activity is no longer available." />;
  return <Invite activity={activity.data} />;
}

function Invite({ activity: a }: { activity: ActivityDetail }) {
  const people = useInvitees(a.id);
  const invite = useInvite(a.id);
  const { top } = useScreenInsets();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');

  const toggle = (p: Invitee) =>
    setPicked((now) => {
      const next = new Set(now);
      if (next.has(p.id)) next.delete(p.id);
      else if (next.size >= LIMITS.invitesMax)
        toast(`You can invite up to ${LIMITS.invitesMax} people at a time.`);
      else next.add(p.id);
      return next;
    });

  const send = () =>
    invite.mutate(
      { userIds: [...picked], note: note.trim() || undefined },
      {
        onSuccess: ({ invited }) => {
          successHaptic();
          router.back();
          toast(
            invited === 1
              ? 'Invite sent.'
              : invited
                ? `${invited} invites sent.`
                : 'Already invited.',
          );
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );

  const list = people.data ?? [];
  const count = picked.size;

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: top(58), paddingHorizontal: 22, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} hitSlop={8} className="self-start py-1.5">
          <Text className="font-sans text-[16px] text-muted">Cancel</Text>
        </Pressable>
        <Heading size="page" className="mt-4">
          Invite friends
        </Heading>
        <Text className="mt-2 font-sans text-[15px] leading-[22px] text-muted">
          {a.title}, {whenLong(a)}. They’ll get a notification from you.
        </Text>

        <Pressable
          onPress={() => void shareActivity(a)}
          accessibilityRole="button"
          className="mt-5 flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 active:opacity-80"
        >
          <View className="h-9 w-9 items-center justify-center rounded-full bg-lime-tint">
            <ShareIcon size={17} color={colors.lime} />
          </View>
          <View className="flex-1">
            <Text className="font-sans-semibold text-[15.5px] text-ink">Share a link</Text>
            <Text className="mt-0.5 font-sans text-[13.5px] text-muted">
              For anyone, on WhatsApp or anywhere else
            </Text>
          </View>
        </Pressable>

        {people.isLoading ? <Loading className="py-10" /> : null}
        {people.error ? (
          <LoadError
            error={people.error}
            onRetry={() => void people.refetch()}
            stale={!!people.data}
          />
        ) : null}
        {people.data && !list.length ? (
          <EmptyState
            title="No one to invite here yet"
            subtitle="People you’ve been at an activity with show up here. Until then, share a link."
          />
        ) : null}

        {list.length ? (
          <>
            <SectionLabel className="mb-1 mt-6">People you’ve met on Buddy</SectionLabel>
            {list.map((p) => {
              const selected = picked.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => toggle(p)}
                  disabled={p.invited}
                  role="checkbox"
                  aria-checked={selected || p.invited}
                  aria-disabled={p.invited}
                  className="flex-row items-center gap-3 border-b border-divider py-3 active:opacity-80"
                >
                  <Avatar uri={p.avatarUrl ?? undefined} name={p.name} size={42} />
                  <View className="flex-1">
                    <Text className="font-sans-medium text-[15.5px] text-ink" numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text className="mt-0.5 font-sans text-[13.5px] text-muted" numberOfLines={1}>
                      {p.invited ? 'Invited' : `Met at ${p.met}`}
                    </Text>
                  </View>
                  <View
                    className={cn(
                      'h-[24px] w-[24px] items-center justify-center rounded-full border-2',
                      selected
                        ? 'border-lime bg-lime'
                        : p.invited
                          ? 'border-outline bg-surface'
                          : 'border-outline',
                    )}
                  >
                    {selected || p.invited ? (
                      <CheckIcon
                        size={14}
                        strokeWidth={3}
                        color={selected ? colors.bg : colors.muted}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}

            <SectionLabel className="mb-2.5 mt-6">Add a note (optional)</SectionLabel>
            <TextField
              value={note}
              onChangeText={setNote}
              placeholder="Come along, it’s a relaxed one!"
              maxLength={LIMITS.inviteNoteMax}
              size="md"
            />
          </>
        ) : null}
      </KeyboardAwareScrollView>

      {list.length ? (
        <Footer>
          <Button
            label={
              invite.isPending
                ? 'Sending…'
                : count
                  ? `Invite ${count} ${count === 1 ? 'person' : 'people'}`
                  : 'Invite'
            }
            inactive={!count || invite.isPending}
            onPress={send}
          />
        </Footer>
      ) : null}
    </KeyboardScreen>
  );
}
