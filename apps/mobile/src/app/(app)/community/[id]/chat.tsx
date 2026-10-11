import { RETENTION } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { useCommunity, useCommunityMembers } from '@/api/queries';
import { ChatView } from '@/components/chat/ChatView';

/** A community's group chat: all its members, between activities. */
export default function CommunityChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useCommunity(id).data;
  const people = useCommunityMembers(id).data ?? [];
  const members = c ? `${c.memberCount} ${c.memberCount === 1 ? 'member' : 'members'}` : '';
  return (
    <ChatView
      room={{ kind: 'community', id }}
      title={c?.name ?? ''}
      subtitle={members}
      image={c?.logoUrl}
      // Back to the community if that's where you came from, else open it.
      onTitlePress={() => router.dismissTo(`/community/${id}`)}
      membersOnly="Join this community to see its chat."
      people={people}
      banner={
        c ? (
          <View className="mb-2 rounded-[14px] border border-lime-panel-border bg-lime-panel px-4 py-3.5">
            <Text className="font-sans-medium text-[14.5px] leading-[20px] text-ink-soft">
              The group chat for everyone in {c.name}. Plan meetups, swap tips, say hi. Messages are
              kept for {RETENTION.communityChatDays} days.
            </Text>
          </View>
        ) : null
      }
    />
  );
}
