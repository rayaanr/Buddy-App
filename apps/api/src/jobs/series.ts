import { eq, sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import { activities, activityMembers, activityRemovals, user } from '../db/schema';
import type { PushSender } from '../lib/push';
import type { Logger } from '../logger';
import { firstName, insertSystemMessage } from '../modules/chat/system-messages';
import { whenText } from '../modules/activities/service';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EVERY_MS = 60_000;

/**
 * Weekly activities: once the latest occurrence of a series has started,
 * posts the next one, a week later (or the first future week, if the job was
 * down), copied from the latest so the host's edits carry forward. The host
 * is in it, people the host removed stay removed, and last week's group gets
 * a heads-up. The (series, start) unique index makes this safe to run on
 * several API instances at once.
 */
export async function extendSeries({ db, push }: { db: Db; push: PushSender }) {
  const due = await db
    .selectDistinctOn([activities.seriesId])
    .from(activities)
    .where(sql`${activities.seriesId} is not null`)
    .orderBy(activities.seriesId, sql`${activities.startsAt} desc`);

  let posted = 0;
  for (const latest of due) {
    if (!latest.repeatsWeekly || latest.startsAt.getTime() > Date.now()) continue;
    const weeks = Math.max(1, Math.ceil((Date.now() - latest.startsAt.getTime()) / WEEK_MS));
    const startsAt = new Date(latest.startsAt.getTime() + weeks * WEEK_MS);

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(activities)
        .values({
          hostId: latest.hostId,
          communityId: latest.communityId,
          title: latest.title,
          category: latest.category,
          group: latest.group,
          interest: latest.interest,
          startsAt,
          place: latest.place,
          area: latest.area,
          location: latest.location,
          capacity: latest.capacity,
          description: latest.description,
          coverUrl: latest.coverUrl,
          seriesId: latest.seriesId,
          repeatsWeekly: true,
        })
        .onConflictDoNothing()
        .returning({ id: activities.id });
      if (!row) return null; // Another instance got there first.

      await tx.insert(activityMembers).values({
        activityId: row.id,
        userId: latest.hostId,
        role: 'host',
      });
      await tx.execute(sql`
        insert into ${activityRemovals} (activity_id, user_id, reason)
        select ${row.id}, user_id, reason from ${activityRemovals}
        where activity_id = ${latest.id}`);
      const [host] = await tx
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, latest.hostId));
      await insertSystemMessage(
        tx,
        row.id,
        `${firstName(host?.name ?? 'The host')} created this activity`,
      );
      return row.id;
    });
    if (!created) continue;
    posted++;

    void push.notifyActivity(
      latest.id,
      {
        title: `${latest.title} is on again`,
        body: `${whenText(startsAt)} at ${latest.place}. Tap to join.`,
        data: { activityId: created },
        channelId: 'reminders',
      },
      [latest.hostId],
    );
  }
  return { posted };
}

/** Runs extendSeries every minute until stopped. */
export function startSeries(deps: { db: Db; push: PushSender; logger: Logger }) {
  const tick = () =>
    extendSeries(deps).catch((err) => deps.logger.error({ err }, 'Weekly series failed'));
  const timer = setInterval(tick, EVERY_MS);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
