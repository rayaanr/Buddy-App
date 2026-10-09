import { router } from 'expo-router';
import { useRef } from 'react';
import { Text, View } from 'react-native';

import { useActivityMembers, useMe } from '@/api/queries';
import { Avatar, LoadError, Loading, PressableScale, Sheet } from '@/components/ui';

interface MembersSheetProps {
  activityId: string;
  open: boolean;
  onClose: () => void;
  /** e.g. "6 of 8 going" */
  title: string;
}

/** Everyone going to an activity, host first; tap someone to see their profile. */
export function MembersSheet({ activityId, open, onClose, title }: MembersSheetProps) {
  const members = useActivityMembers(activityId, open);
  const me = useMe();
  // Opening a profile waits until the drawer has slid away.
  const next = useRef<string | null>(null);

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
        {members.isLoading ? <Loading className="py-10" /> : null}
        {members.error ? (
          <View className="mt-4">
            <LoadError error={members.error} onRetry={() => void members.refetch()} />
          </View>
        ) : null}
        <View className="mt-2">
          {members.data?.map((m) => {
            const isMe = m.id === me.data?.id;
            return (
              <PressableScale
                key={m.id}
                scale="dim"
                disabled={isMe}
                onPress={() => {
                  next.current = m.id;
                  onClose();
                }}
                accessibilityRole={isMe ? undefined : 'button'}
                className="flex-row items-center gap-3.5 border-b border-divider py-3"
              >
                <Avatar uri={m.avatarUrl ?? undefined} size={40} />
                <Text className="flex-1 font-sans-medium text-[16px] text-ink" numberOfLines={1}>
                  {m.name}
                  {isMe ? <Text className="text-muted"> (you)</Text> : null}
                </Text>
                {m.role === 'host' ? (
                  <Text className="overflow-hidden rounded-[10px] bg-lime-deep px-2.5 py-1 font-sans-medium text-[12.5px] text-lime">
                    Host
                  </Text>
                ) : null}
              </PressableScale>
            );
          })}
        </View>
      </View>
    </Sheet>
  );
}
