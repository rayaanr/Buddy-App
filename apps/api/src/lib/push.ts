import { and, eq, inArray, notInArray } from 'drizzle-orm';

import type { Db } from '../db/client';
import { activityMembers, pushTokens } from '../db/schema';
import type { Logger } from '../logger';

export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, string>;
  /** Android notification channel the app created (see apps/mobile/src/api/push.ts). */
  channelId?: 'chat' | 'reminders';
}

export interface PushSender {
  /** Notifies an activity's members, except the listed users. Never throws. */
  notifyActivity(
    activityId: string,
    message: PushMessage,
    exceptUserIds: Iterable<string>,
  ): Promise<void>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/** Sends through Expo's push service, which forwards to APNs and FCM. */
export function createPushSender(db: Db, logger: Logger, accessToken?: string): PushSender {
  return {
    async notifyActivity(activityId, message, exceptUserIds) {
      try {
        const except = [...exceptUserIds];
        const rows = await db
          .select({ token: pushTokens.token })
          .from(pushTokens)
          .innerJoin(activityMembers, eq(activityMembers.userId, pushTokens.userId))
          .where(
            and(
              eq(activityMembers.activityId, activityId),
              except.length ? notInArray(pushTokens.userId, except) : undefined,
            ),
          );
        const tokens = rows.map((r) => r.token);

        for (let i = 0; i < tokens.length; i += BATCH) {
          const batch = tokens.slice(i, i + BATCH);
          const res = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify(batch.map((to) => ({ to, sound: 'default', ...message }))),
          });
          if (!res.ok) {
            logger.warn({ status: res.status }, 'Expo push request failed');
            continue;
          }
          const { data } = (await res.json()) as { data: ExpoTicket[] };
          // Uninstalled apps: forget their tokens so we stop sending to them.
          const dead = batch.filter((_, k) => data[k]?.details?.error === 'DeviceNotRegistered');
          if (dead.length) await db.delete(pushTokens).where(inArray(pushTokens.token, dead));
        }
      } catch (err) {
        logger.error({ err, activityId }, 'Push notification failed');
      }
    },
  };
}
