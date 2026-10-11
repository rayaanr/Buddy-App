import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useActivity } from '@/api/queries';
import { ChatView } from '@/components/chat/ChatView';
import { whenLong } from '@/lib/activity';

/** An activity's group chat: everyone going. */
export default function ActivityChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const a = useActivity(id).data;
  return (
    <ChatView
      room={{ kind: 'activity', id }}
      title={a?.title ?? ''}
      subtitle={a ? `${a.goingCount} of ${a.capacity} going` : ''}
      membersOnly="Join this activity to see its chat."
      banner={
        a ? (
          <Pressable
            onPress={() => router.push(`/activity/${a.id}`)}
            className="mb-2 flex-row justify-between rounded-[14px] border border-lime-panel-border bg-lime-panel px-4 py-3.5 active:opacity-80"
          >
            <Text className="font-sans-medium text-[14.5px] text-lime">{whenLong(a)}</Text>
            <Text className="font-sans-medium text-[14.5px] text-ink-soft">{a.place}</Text>
          </Pressable>
        ) : null
      }
    />
  );
}
