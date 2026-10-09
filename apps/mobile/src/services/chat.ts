import { AUTO_REPLIES, GUEST_REPLIERS } from '@/data/constants';
import { clockTime, newId } from '@/lib/activity';
import { useActivitiesStore } from '@/store/activities';
import { useUiStore } from '@/store/ui';

/**
 * Mock chat transport. Simulates delivery receipts and a reply from the group
 * so the chat feels alive. Swap this module for a real socket/API client.
 */
const SENT_AFTER_MS = 450;
const SEEN_AFTER_MS = 600;
const TYPING_FOR_MS = 1400;

// One pending reply per chat, so messaging one group never cancels another
// group's reply. Sending again in the same chat restarts that chat's reply.
const replyTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelReply(activityId: string) {
  const timer = replyTimers.get(activityId);
  if (timer) clearTimeout(timer);
  replyTimers.delete(activityId);
  const ui = useUiStore.getState();
  if (ui.typing?.activityId === activityId) ui.setTyping(null);
}

export function sendMessage(activityId: string, rawText: string) {
  const text = rawText.trim();
  if (!text) return;

  const store = useActivitiesStore.getState();
  const messageId = newId('m');
  store.addMessage(activityId, {
    id: messageId,
    kind: 'me',
    text,
    time: clockTime(),
    status: 'sending',
  });

  setTimeout(() => {
    useActivitiesStore.getState().setMessageStatus(activityId, messageId, 'sent');
  }, SENT_AFTER_MS);

  const activity = store.activities.find((a) => a.id === activityId);
  if (!activity) return;
  const from = activity.hosting
    ? GUEST_REPLIERS[activity.messages.length % GUEST_REPLIERS.length]!
    : activity.host;

  cancelReply(activityId);
  replyTimers.set(
    activityId,
    setTimeout(() => {
      useActivitiesStore.getState().markMineSeen(activityId);
      useUiStore.getState().setTyping({ activityId, from });

      replyTimers.set(
        activityId,
        setTimeout(() => {
          replyTimers.delete(activityId);
          useUiStore.getState().setTyping(null);
          const current = useActivitiesStore.getState().activities.find((a) => a.id === activityId);
          const reply = AUTO_REPLIES[(current?.messages.length ?? 0) % AUTO_REPLIES.length]!;
          useActivitiesStore
            .getState()
            .addMessage(activityId, { id: newId('m'), kind: 'other', from, text: reply });
        }, TYPING_FOR_MS),
      );
    }, SEEN_AFTER_MS),
  );
}
