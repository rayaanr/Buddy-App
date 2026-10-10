import { eq } from 'drizzle-orm';

import { activities } from '../../db/schema';
import type { Deps } from '../../http/context';
import { HOUR } from '../../lib/rate-limit';
import { toChatMessage, type MessageRow } from '../chat/service';

/** What a change to an activity produced, for `announce` to pass on. */
export interface ChangeResult {
  messages: MessageRow[];
  promoted: string[];
  notice?: { title: string; body: string } | null;
  waiting?: string[];
}

/**
 * After a change: posts its chat lines, tells everyone going about a host
 * change (`notice`, except `actorId`), tells people moved off the waitlist
 * they're in, and tells people still waiting about a cancellation.
 */
export function createAnnouncer({
  db,
  urls,
  hub,
  push,
  limiter,
}: Pick<Deps, 'db' | 'urls' | 'hub' | 'push' | 'limiter'>) {
  return async (id: string, actorId: string, result: ChangeResult) => {
    for (const row of result.messages) {
      hub.publish(id, { type: 'message', message: await toChatMessage(db, urls, row) });
    }
    // Host notices push to everyone going: at most 3 an hour per activity, so
    // repeated edits can't spam phones (the chat lines still go up).
    if (result.notice && limiter.hit(`notice:${id}`, 3, HOUR).ok) {
      const message = {
        ...result.notice,
        data: { activityId: id },
        channelId: 'reminders' as const,
      };
      void push.notifyActivity(id, message, [actorId, ...result.promoted]);
      if (result.waiting?.length) void push.notifyUsers(result.waiting, message);
    }
    if (result.promoted.length) {
      const [activity] = await db
        .select({ title: activities.title })
        .from(activities)
        .where(eq(activities.id, id));
      void push.notifyUsers(result.promoted, {
        title: `You’re in: ${activity?.title ?? 'your activity'}`,
        body: 'A spot opened up. Say hi in the group chat.',
        data: { activityId: id, screen: 'chat' },
        channelId: 'reminders',
      });
    }
  };
}
