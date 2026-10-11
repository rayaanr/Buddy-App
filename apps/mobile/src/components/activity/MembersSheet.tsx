import { firstName } from '@buddy/shared';
import type { RemovalReason, UserSummary } from '@buddy/shared';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useActivityMembers, useMe, useRemoveGuest } from '@/api/queries';
import {
  ActionSheet,
  Avatar,
  LoadError,
  Loading,
  PressableScale,
  SectionLabel,
  Dialog,
} from '@/components/ui';
import { toast } from '@/store/ui';

interface MembersSheetProps {
  activityId: string;
  open: boolean;
  onClose: () => void;
  /** e.g. "6 of 8 going" */
  title: string;
  /** The host, before it starts: can remove guests and people waiting. */
  canRemove?: boolean;
}

const REASONS: { label: string; reason: RemovalReason }[] = [
  { label: 'Not a good fit', reason: 'not_a_fit' },
  { label: 'Behaving badly', reason: 'behaviour' },
  { label: 'Something else', reason: 'other' },
];

/**
 * Everyone going to an activity, host first, then anyone on the waitlist in
 * order. Tap someone to see their profile.
 */
export function MembersSheet({
  activityId,
  open,
  onClose,
  title,
  canRemove = false,
}: MembersSheetProps) {
  const people = useActivityMembers(activityId, open);
  const me = useMe();
  const remove = useRemoveGuest(activityId);
  // Opening a profile, or asking why someone's being removed, waits until
  // the dialog has gone.
  const next = useRef<{ profile: string } | { remove: UserSummary } | null>(null);
  const [removing, setRemoving] = useState<UserSummary | null>(null);
  const waitlist = people.data?.waitlist ?? [];

  const row = (p: UserSummary, tag: ReactNode, removable = false) => {
    const isMe = p.id === me.data?.id;
    return (
      <View key={p.id} className="flex-row items-center border-b border-divider">
        <PressableScale
          scale="dim"
          disabled={isMe}
          onPress={() => {
            next.current = { profile: p.id };
            onClose();
          }}
          accessibilityRole={isMe ? undefined : 'button'}
          className="flex-1 flex-row items-center gap-3.5 py-3"
        >
          <Avatar uri={p.avatarUrl ?? undefined} name={p.name} size={40} />
          <Text className="flex-1 font-sans-medium text-[16px] text-ink" numberOfLines={1}>
            {p.name}
            {isMe ? <Text className="text-muted"> (you)</Text> : null}
          </Text>
          {tag}
        </PressableScale>
        {canRemove && removable ? (
          <Pressable
            onPress={() => {
              next.current = { remove: p };
              onClose();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${p.name}`}
            className="ml-3 rounded-full border border-outline px-3 py-1.5 active:opacity-70"
          >
            <Text className="font-sans-medium text-[13px] text-muted">Remove</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const onRemove = (reason: RemovalReason) => {
    const person = removing;
    if (!person) return;
    remove.mutate(
      { userId: person.id, reason },
      {
        onSuccess: () => toast(`${firstName(person.name)} was removed.`),
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        onClosed={() => {
          const n = next.current;
          next.current = null;
          if (n && 'profile' in n) router.push(`/user/${n.profile}`);
          if (n && 'remove' in n) setRemoving(n.remove);
        }}
      >
        <View className="px-[22px]">
          <Text className="font-sans-semibold text-[18px] text-ink">{title}</Text>
          {people.isLoading ? <Loading className="py-10" /> : null}
          {people.error ? (
            <View className="mt-4">
              <LoadError
                error={people.error}
                onRetry={() => void people.refetch()}
                stale={!!people.data}
              />
            </View>
          ) : null}
          <View className="mt-2">
            {people.data?.members.map((m) =>
              row(
                m,
                m.role === 'host' ? (
                  <Text className="overflow-hidden rounded-[10px] bg-lime-deep px-2.5 py-1 font-sans-medium text-[12.5px] text-lime">
                    Host
                  </Text>
                ) : null,
                m.role === 'guest',
              ),
            )}
          </View>
          {waitlist.length ? (
            <>
              <SectionLabel className="mb-1 mt-6">Waitlist · {waitlist.length}</SectionLabel>
              {waitlist.map((w, i) =>
                row(w, <Text className="font-mono text-[13px] text-subtle">#{i + 1}</Text>, true),
              )}
            </>
          ) : null}
        </View>
      </Dialog>
      <ActionSheet
        visible={!!removing}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove ${firstName(removing.name)}?` : undefined}
        message="They’ll be told they’re no longer going and can’t rejoin. Pick a reason; it stays private."
        cancelLabel="Keep them"
        actions={REASONS.map((r) => ({
          label: r.label,
          destructive: true,
          onPress: () => onRemove(r.reason),
        }))}
      />
    </>
  );
}
