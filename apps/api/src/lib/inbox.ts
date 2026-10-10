import { and, eq, notInArray } from 'drizzle-orm';

import type { Db } from '../db/client';
import { activityMembers, notifications } from '../db/schema';
import type { Logger } from '../logger';
import type { PushMessage, PushSender } from './push';

/**
 * Keeps a copy of each notification in the in-app inbox (the bell), then
 * sends the push. Chat messages are left out: they're in the chat already.
 * Recording never stops the push, and never throws.
 */
export function withInbox(
  db: Db,
  logger: Logger,
  push: PushSender,
): PushSender & { settled(): Promise<void> } {
  // Callers fire and forget; tests wait for these before wiping the database.
  const inFlight = new Set<Promise<unknown>>();
  const track = <T>(p: Promise<T>) => {
    inFlight.add(p);
    p.finally(() => inFlight.delete(p)).catch(() => {});
    return p;
  };

  const record = async (userIds: string[], message: PushMessage) => {
    if (message.channelId === 'chat' || !userIds.length) return;
    try {
      await db.insert(notifications).values(
        userIds.map((userId) => ({
          userId,
          kind: message.channelId ?? 'reminders',
          title: message.title,
          body: message.body,
          data: message.data,
        })),
      );
    } catch (err) {
      logger.error({ err }, 'Could not save notifications to the inbox');
    }
  };

  return {
    /** Resolves once everything sent so far has been saved and pushed. */
    async settled() {
      await Promise.allSettled([...inFlight]);
    },
    notifyActivity: (activityId, message, exceptUserIds) =>
      track(notifyActivity(activityId, message, [...exceptUserIds])),
    notifyUsers: (userIds, message) => track(notifyUsers(userIds, message)),
  };

  async function notifyActivity(activityId: string, message: PushMessage, except: string[]) {
    if (message.channelId !== 'chat') {
      const members = await db
        .select({ userId: activityMembers.userId })
        .from(activityMembers)
        .where(
          and(
            eq(activityMembers.activityId, activityId),
            except.length ? notInArray(activityMembers.userId, except) : undefined,
          ),
        )
        .catch(() => []);
      await record(
        members.map((m) => m.userId),
        message,
      );
    }
    await push.notifyActivity(activityId, message, except);
  }

  async function notifyUsers(userIds: string[], message: PushMessage) {
    await record(userIds, message);
    await push.notifyUsers(userIds, message);
  }
}
