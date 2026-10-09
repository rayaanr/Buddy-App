import type { UserSummary } from '@buddy/shared';
import { router } from 'expo-router';
import { useRef, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useActivityMembers, useMe } from '@/api/queries';
import { Avatar, LoadError, Loading, PressableScale, SectionLabel, Sheet } from '@/components/ui';

interface MembersSheetProps {
  activityId: string;
  open: boolean;
  onClose: () => void;
  /** e.g. "6 of 8 going" */
  title: string;
}

/**
 * Everyone going to an activity, host first, then anyone on the waitlist in
 * order. Tap someone to see their profile.
 */
export function MembersSheet({ activityId, open, onClose, title }: MembersSheetProps) {
  const people = useActivityMembers(activityId, open);
  const me = useMe();
  // Opening a profile waits until the drawer has slid away.
  const next = useRef<string | null>(null);
  const waitlist = people.data?.waitlist ?? [];

  const row = (p: UserSummary, tag: ReactNode) => {
    const isMe = p.id === me.data?.id;
    return (
      <PressableScale
        key={p.id}
        scale="dim"
        disabled={isMe}
        onPress={() => {
          next.current = p.id;
          onClose();
        }}
        accessibilityRole={isMe ? undefined : 'button'}
        className="flex-row items-center gap-3.5 border-b border-divider py-3"
      >
        <Avatar uri={p.avatarUrl ?? undefined} size={40} />
        <Text className="flex-1 font-sans-medium text-[16px] text-ink" numberOfLines={1}>
          {p.name}
          {isMe ? <Text className="text-muted"> (you)</Text> : null}
        </Text>
        {tag}
      </PressableScale>
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onClosed={() => {
        const id = next.current;
        next.current = null;
        if (id) router.push(`/user/${id}`);
      }}
    >
      <View className="px-[22px]">
        <Text className="font-sans-semibold text-[18px] text-ink">{title}</Text>
        {people.isLoading ? <Loading className="py-10" /> : null}
        {people.error ? (
          <View className="mt-4">
            <LoadError error={people.error} onRetry={() => void people.refetch()} />
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
            ),
          )}
        </View>
        {waitlist.length ? (
          <>
            <SectionLabel className="mb-1 mt-6">Waitlist · {waitlist.length}</SectionLabel>
            {waitlist.map((w, i) =>
              row(w, <Text className="font-mono text-[13px] text-subtle">#{i + 1}</Text>),
            )}
          </>
        ) : null}
      </View>
    </Sheet>
  );
}
