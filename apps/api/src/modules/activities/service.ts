import {
  ERROR_CODES,
  LIMITS,
  type ActivityDetail,
  type ActivityGroup,
  type CreateActivityInput,
  type MyActivity,
} from '@buddy/shared';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import type { Db, Tx } from '../../db/client';
import { activities, activityMembers, messages, user } from '../../db/schema';
import { conflict, forbidden, HttpError, notFound } from '../../lib/errors';
import type { Urls } from '../../lib/urls';
import { firstName, insertSystemMessage } from '../chat/system-messages';
import { areaCentre, originFor } from '../profiles/service';
import { blockedBetween, notBlockedBetween } from '../safety/blocks';
import { countHosted, findActivitySummaries, findAttendees, upcoming } from './queries';

const GROUP_CATEGORY: Record<ActivityGroup, string> = {
  Social: 'SOCIAL',
  Sports: 'SPORTS',
  Running: 'RUNNING',
  Creative: 'CREATIVE',
  Food: 'FOOD & MARKETS',
};

/** Stock photo per type until the host uploads a cover (matches the design). */
const DEFAULT_COVERS: Record<ActivityGroup, string> = {
  Social: '1543269865-cbf427effbad',
  Sports: '1574629810360-7efbbe195018',
  Running: '1552674605-db6ffd4facb5',
  Creative: '1460661419201-fd4cecdf8a8b',
  Food: '1488459716781-31db52582fe9',
};
export const stockCover = (group: ActivityGroup) =>
  `https://images.unsplash.com/photo-${DEFAULT_COVERS[group]}?w=800&q=70&auto=format&fit=crop`;

export const coverKeyPrefix = (userId: string) => `covers/${userId}/`;

export async function getActivityDetail(
  db: Db | Tx,
  urls: Urls,
  id: string,
  viewerId: string,
): Promise<ActivityDetail> {
  const near = await originFor(db, viewerId);
  const [summary] = await findActivitySummaries(db, urls, {
    viewerId,
    near,
    where: [eq(activities.id, id)],
  });
  if (!summary) throw notFound('Activity');
  const [extra] = await db
    .select({ description: activities.description })
    .from(activities)
    .where(eq(activities.id, id));
  return {
    ...summary,
    description: extra?.description ?? '',
    attendees: await findAttendees(db, urls, id, viewerId),
    host: { ...summary.host, hostedCount: await countHosted(db, summary.host.id) },
  };
}

export async function createActivity(
  db: Db,
  urls: Urls,
  host: { id: string; name: string },
  input: CreateActivityInput & { description: string },
) {
  if (new Date(input.startsAt).getTime() <= Date.now()) {
    throw new HttpError(400, ERROR_CODES.validation, 'Pick a time in the future', {
      issues: [{ path: 'startsAt', message: 'Must be in the future' }],
    });
  }
  if (new Date(input.startsAt).getTime() > Date.now() + LIMITS.maxDaysAhead * 86_400_000) {
    throw new HttpError(
      400,
      ERROR_CODES.validation,
      `Pick a date within ${LIMITS.maxDaysAhead} days`,
      { issues: [{ path: 'startsAt', message: 'Too far ahead' }] },
    );
  }
  if (input.coverKey && !input.coverKey.startsWith(coverKeyPrefix(host.id))) {
    throw forbidden('That image was not uploaded by you');
  }

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(activities)
      .values({
        hostId: host.id,
        title: input.title,
        category: input.interest ? input.interest.toUpperCase() : GROUP_CATEGORY[input.group],
        group: input.group,
        interest: input.interest ?? null,
        startsAt: new Date(input.startsAt),
        place: input.place,
        area: input.area,
        location: input.location ?? areaCentre(input.area),
        capacity: input.capacity,
        description: input.description,
        coverUrl: urls.fromKey(input.coverKey) ?? stockCover(input.group),
      })
      .returning({ id: activities.id });
    await tx.insert(activityMembers).values({ activityId: row!.id, userId: host.id, role: 'host' });
    await insertSystemMessage(tx, row!.id, `${firstName(host.name)} created this activity`);
    return row!.id;
  });

  return getActivityDetail(db, urls, id, host.id);
}

/**
 * Joins an activity. The activity row is locked for the duration, so
 * concurrent joins for the last spot are serialised and only one succeeds.
 * Joining twice is a no-op.
 */
export async function joinActivity(db: Db, me: { id: string; name: string }, activityId: string) {
  return db.transaction(async (tx) => {
    const [activity] = await tx
      .select({
        capacity: activities.capacity,
        startsAt: activities.startsAt,
        hostBlocked: blockedBetween(me.id, activities.hostId).mapWith(Boolean),
      })
      .from(activities)
      .where(eq(activities.id, activityId))
      .for('update');
    if (!activity || activity.hostBlocked) throw notFound('Activity');
    if (activity.startsAt.getTime() < Date.now() - 60 * 60 * 1000) {
      throw conflict('This activity has already happened');
    }

    const [existing] = await tx
      .select({ role: activityMembers.role })
      .from(activityMembers)
      .where(and(eq(activityMembers.activityId, activityId), eq(activityMembers.userId, me.id)));
    if (existing) return { joined: false };

    const [going] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(activityMembers)
      .where(eq(activityMembers.activityId, activityId));
    if ((going?.n ?? 0) >= activity.capacity) {
      throw conflict('This activity is full', ERROR_CODES.activityFull);
    }

    await tx.insert(activityMembers).values({ activityId, userId: me.id, role: 'guest' });
    const message = await insertSystemMessage(tx, activityId, `${firstName(me.name)} joined`);
    return { joined: true, message };
  });
}

/** Leaves an activity. Hosts can't leave their own activity. Leaving twice is a no-op. */
export async function leaveActivity(db: Db, me: { id: string; name: string }, activityId: string) {
  return db.transaction(async (tx) => {
    const [member] = await tx
      .select({ role: activityMembers.role })
      .from(activityMembers)
      .where(and(eq(activityMembers.activityId, activityId), eq(activityMembers.userId, me.id)));
    if (!member) {
      const [exists] = await tx
        .select({ id: activities.id })
        .from(activities)
        .where(eq(activities.id, activityId));
      if (!exists) throw notFound('Activity');
      return { left: false };
    }
    if (member.role === 'host') throw forbidden('Hosts can’t leave their own activity');

    await tx
      .delete(activityMembers)
      .where(and(eq(activityMembers.activityId, activityId), eq(activityMembers.userId, me.id)));
    const message = await insertSystemMessage(tx, activityId, `${firstName(me.name)} left`);
    return { left: true, message };
  });
}

/** "Your activities": upcoming ones you joined or host, with the latest chat line. */
export async function myActivities(
  db: Db,
  urls: Urls,
  userId: string,
  role: 'joined' | 'hosting',
): Promise<MyActivity[]> {
  const memberRole = role === 'hosting' ? 'host' : 'guest';
  const items = await findActivitySummaries(db, urls, {
    viewerId: userId,
    near: await originFor(db, userId),
    where: [
      upcoming(),
      inArray(
        activities.id,
        db
          .select({ id: activityMembers.activityId })
          .from(activityMembers)
          .where(and(eq(activityMembers.userId, userId), eq(activityMembers.role, memberRole))),
      ),
    ],
  });
  if (!items.length) return [];

  const latest = await db
    .selectDistinctOn([messages.activityId], {
      activityId: messages.activityId,
      kind: messages.kind,
      body: messages.body,
      senderId: messages.senderId,
      senderName: user.name,
    })
    .from(messages)
    .leftJoin(user, eq(user.id, messages.senderId))
    .where(
      and(
        inArray(
          messages.activityId,
          items.map((a) => a.id),
        ),
        eq(messages.kind, 'user'),
        notBlockedBetween(userId, messages.senderId),
      ),
    )
    .orderBy(messages.activityId, desc(messages.createdAt), desc(messages.id));
  const byActivity = new Map(latest.map((m) => [m.activityId, m]));

  return items.map((a) => {
    const m = byActivity.get(a.id);
    return {
      ...a,
      lastMessage: m
        ? {
            kind: m.kind as 'user' | 'system',
            senderName: m.senderName,
            body: m.body,
            mine: m.senderId === userId,
          }
        : null,
    };
  });
}
