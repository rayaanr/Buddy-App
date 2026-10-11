import { RETENTION } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useActivity, useActivityMembers } from '@/api/queries';
import { ChatView } from '@/components/chat/ChatView';
import { whenLong } from '@/lib/activity';

/** An activity's group chat: everyone going. */
export default function ActivityChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const a = useActivity(id).data;
  const people = useActivityMembers(id, true).data?.members ?? [];
  return (
    <ChatView
      room={{ kind: 'activity', id }}
      title={a?.title ?? ''}
      subtitle={a ? `${a.goingCount} of ${a.capacity} going` : ''}
      membersOnly="Join this activity to see its chat."
      image={a?.coverUrl}
      // Back to the activity if that's where you came from, else open it.
      onTitlePress={() => router.dismissTo(`/activity/${id}`)}
      people={people}
      muted={a && (a.viewer.joined || a.viewer.hosting) ? a.viewer.chatMuted : undefined}
      banner={
        a ? (
          <View className="mb-2">
            <Pressable
              onPress={() => router.dismissTo(`/activity/${a.id}`)}
              className="flex-row justify-between rounded-[14px] border border-lime-panel-border bg-lime-panel px-4 py-3.5 active:opacity-80"
            >
              <Text className="font-sans-medium text-[14.5px] text-lime">{whenLong(a)}</Text>
              <Text className="font-sans-medium text-[14.5px] text-ink-soft">{a.place}</Text>
            </Pressable>
            <Text className="mt-2.5 text-center font-sans text-[12.5px] text-subtle">
              Messages are kept until {RETENTION.activityChatDays} days after the activity.
            </Text>
          </View>
        ) : null
      }
    />
  );
}
