import type { ChatRoom } from '@/api/chat';
import { errorMessage } from '@/api/client';
import { useMuteChat } from '@/api/queries';
import { toast } from '@/store/ui';

/** Mutes or unmutes a group chat, and says so. */
export function useToggleMute() {
  const mute = useMuteChat();
  return (room: ChatRoom, muted: boolean) =>
    mute.mutate(
      { room, muted },
      {
        onSuccess: (now) =>
          toast(
            now
              ? room.kind === 'activity'
                ? 'Group chat muted. You’ll still get reminders and changes.'
                : 'Group chat muted. You’ll still hear when someone @mentions you.'
              : 'Group chat unmuted.',
          ),
        onError: (err) => toast(errorMessage(err)),
      },
    );
}
