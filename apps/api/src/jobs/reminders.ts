import { clockLabel } from '@buddy/shared';
import { and, isNull, sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import { activities } from '../db/schema';
import type { PushSender } from '../lib/push';
import type { Logger } from '../logger';

const EVERY_MS = 60_000;

/**
 * Push notifications around an activity, to everyone going:
 * - "Coming up" two hours before it starts (or soon after joining, if it was
 *   created later than that, but never within its first 15 minutes).
 * - "How was it?" three hours after it starts, if anyone joined the host.
 *
 * Each is claimed with one UPDATE … RETURNING, so it goes out once even with
 * several API instances running. A changed start time resets both.
 */
export async function sendReminders({ db, push }: { db: Db; push: PushSender }) {
  const comingUp = await db
    .update(activities)
    .set({ reminderSentAt: sql`now()` })
    .where(
      and(
        isNull(activities.reminderSentAt),
        isNull(activities.cancelledAt),
        sql`${activities.startsAt} > now()`,
        sql`${activities.startsAt} <= now() + interval '2 hours'`,
        sql`${activities.createdAt} <= now() - interval '15 minutes'`,
      ),
    )
    .returning({
      id: activities.id,
      title: activities.title,
      place: activities.place,
      startsAt: activities.startsAt,
    });

  const followUps = await db
    .update(activities)
    .set({ followUpSentAt: sql`now()` })
    .where(
      and(
        isNull(activities.followUpSentAt),
        isNull(activities.cancelledAt),
        sql`${activities.startsAt} <= now() - interval '3 hours'`,
        sql`${activities.startsAt} > now() - interval '1 day'`,
        sql`(select count(*) from activity_members m where m.activity_id = ${activities.id}) > 1`,
      ),
    )
    .returning({ id: activities.id, title: activities.title });

  await Promise.all([
    ...comingUp.map((a) =>
      push.notifyActivity(
        a.id,
        {
          title: `Coming up: ${a.title}`,
          body: `${clockLabel(a.startsAt)} at ${a.place}. Tap for the group chat.`,
          data: { activityId: a.id, screen: 'chat' },
          channelId: 'reminders',
        },
        [],
      ),
    ),
    ...followUps.map((a) =>
      push.notifyActivity(
        a.id,
        {
          title: `How was ${a.title}?`,
          body: 'Say thanks or share photos in the group chat.',
          data: { activityId: a.id, screen: 'chat' },
          channelId: 'reminders',
        },
        [],
      ),
    ),
  ]);
  return { comingUp: comingUp.length, followUps: followUps.length };
}

/** Runs sendReminders every minute until stopped. */
export function startReminders(deps: { db: Db; push: PushSender; logger: Logger }) {
  const tick = () =>
    sendReminders(deps).catch((err) => deps.logger.error({ err }, 'Reminders failed'));
  const timer = setInterval(tick, EVERY_MS);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
