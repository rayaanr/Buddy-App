import { clockLabel } from '@buddy/shared';
import { and, isNull, sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import { activities } from '../db/schema';
import type { PushSender } from '../lib/push';
import type { Logger } from '../logger';

const EVERY_MS = 60_000;

/**
 * Push notifications around an activity, to everyone going:
 * - "Tomorrow" a day before it starts, if it was posted at least a day ahead
 *   (and is still more than two hours away, so the two don't land together).
 * - "Starting in an hour" an hour before (or soon after joining, if it was
 *   created later than that, but never within its first 15 minutes).
 * - "How was it?" three hours after it starts, if anyone joined the host;
 *   the host is asked to take roll call instead.
 *
 * Each is claimed with one UPDATE … RETURNING, so it goes out once even with
 * several API instances running. A changed start time resets them all.
 */
export async function sendReminders({ db, push }: { db: Db; push: PushSender }) {
  const fields = {
    id: activities.id,
    title: activities.title,
    place: activities.place,
    startsAt: activities.startsAt,
  };

  const dayBefore = await db
    .update(activities)
    .set({ dayBeforeSentAt: sql`now()` })
    .where(
      and(
        isNull(activities.dayBeforeSentAt),
        isNull(activities.cancelledAt),
        sql`${activities.startsAt} > now() + interval '2 hours'`,
        sql`${activities.startsAt} <= now() + interval '1 day'`,
        sql`${activities.createdAt} <= ${activities.startsAt} - interval '1 day'`,
      ),
    )
    .returning(fields);

  const comingUp = await db
    .update(activities)
    .set({ reminderSentAt: sql`now()` })
    .where(
      and(
        isNull(activities.reminderSentAt),
        isNull(activities.cancelledAt),
        sql`${activities.startsAt} > now()`,
        sql`${activities.startsAt} <= now() + interval '1 hour'`,
        sql`${activities.createdAt} <= now() - interval '15 minutes'`,
      ),
    )
    .returning(fields);

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
    .returning({ id: activities.id, title: activities.title, hostId: activities.hostId });

  await Promise.all([
    ...dayBefore.map((a) =>
      push.notifyActivity(
        a.id,
        {
          title: `Tomorrow: ${a.title}`,
          body: `${clockLabel(a.startsAt)} at ${a.place}. Still coming? If not, leave so someone else can join.`,
          data: { activityId: a.id },
          channelId: 'reminders',
        },
        [],
      ),
    ),
    ...comingUp.map((a) =>
      push.notifyActivity(
        a.id,
        {
          title: `Starting in an hour: ${a.title}`,
          body: `${clockLabel(a.startsAt)} at ${a.place}. Tap for the group chat.`,
          data: { activityId: a.id, screen: 'chat' },
          channelId: 'reminders',
        },
        [],
      ),
    ),
    ...followUps.flatMap((a) => [
      push.notifyActivity(
        a.id,
        {
          title: `How was ${a.title}?`,
          body: 'Say thanks or share photos in the group chat.',
          data: { activityId: a.id, screen: 'chat' },
          channelId: 'reminders',
        },
        a.hostId ? [a.hostId] : [],
      ),
      push.notifyUsers(a.hostId ? [a.hostId] : [], {
        title: `Who came to ${a.title}?`,
        body: 'Take roll call: it takes a few seconds and helps the people who showed up.',
        data: { activityId: a.id, screen: 'roll-call' },
        channelId: 'reminders',
      }),
    ]),
  ]);
  return { dayBefore: dayBefore.length, comingUp: comingUp.length, followUps: followUps.length };
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
