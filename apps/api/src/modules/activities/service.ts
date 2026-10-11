import {
  type ActivityDetail,
  type ActivityGroup,
  type CreateActivityInput,
  DELETED_ACCOUNT,
  ERROR_CODES,
  firstName,
  isDeletedAccount,
  LIMITS,
  messageSummary,
  type MyActivity,
  placeLabel,
  type RemovalReason,
  type RollCallGuest,
  type RollCallInput,
  type UpdateActivityInput,
} from '@buddy/shared';
import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import type { Db, Tx } from '../../db/client';
import {
  activities,
  activityFeedback,
  activityInvites,
  activityMembers,
  activityRemovals,
  activityWaitlist,
  messages,
  profiles,
  user,
} from '../../db/schema';
import { conflict, forbidden, HttpError, notFound } from '../../lib/errors';
import type { Storage } from '../../lib/storage';
import { requireUpload } from '../../lib/upload-keys';
import type { Urls } from '../../lib/urls';
import { insertSystemMessage } from '../chat/system-messages';
import { requireCommunityMember } from '../communities/service';
import { homePlace, nearestPlace, originFor } from '../profiles/service';
import { blockedBetween, notBlockedBetween } from '../safety/blocks';
import type { ChangeResult } from './announce';
import {
  countHosted,
  countWouldGoAgain,
  findActivitySummaries,
  findAttendees,
  upcoming,
} from './queries';

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
    .select({ description: activities.description, bring: activities.bring })
    .from(activities)
    .where(eq(activities.id, id));
  return {
    ...summary,
    description: extra?.description ?? '',
    bring: extra?.bring ?? '',
    attendees: await findAttendees(db, urls, id, viewerId),
    host: {
      ...summary.host,
      hostedCount: isDeletedAccount(summary.host) ? 0 : await countHosted(db, summary.host.id),
      wouldGoAgain: isDeletedAccount(summary.host)
        ? 0
        : await countWouldGoAgain(db, summary.host.id),
    },
    feedback: await feedbackFor(db, summary, viewerId),
    invitedBy: await findInviter(db, urls, id, viewerId),
    rollCall: await rollCallFor(db, summary),
  };
}

/** Guests can say whether they'd go again once an activity has started, for 30 days. */
const FEEDBACK_DAYS = 30;

const canGiveFeedback = (a: {
  startsAt: string;
  cancelled: boolean;
  viewer: { joined: boolean };
}) =>
  a.viewer.joined &&
  !a.cancelled &&
  new Date(a.startsAt).getTime() <= Date.now() &&
  Date.now() - new Date(a.startsAt).getTime() < FEEDBACK_DAYS * 86_400_000;

/**
 * The viewer's "would you go again?" for this activity: null when it isn't
 * theirs to answer (including when the host's roll call says they didn't come).
 */
async function feedbackFor(
  db: Db | Tx,
  a: { id: string; startsAt: string; cancelled: boolean; viewer: { joined: boolean } },
  viewerId: string,
) {
  if (!canGiveFeedback(a)) return null;
  const [[member], [row]] = await Promise.all([
    db
      .select({ attended: activityMembers.attended })
      .from(activityMembers)
      .where(and(eq(activityMembers.activityId, a.id), eq(activityMembers.userId, viewerId))),
    db
      .select({ wouldGoAgain: activityFeedback.wouldGoAgain })
      .from(activityFeedback)
      .where(and(eq(activityFeedback.activityId, a.id), eq(activityFeedback.userId, viewerId))),
  ]);
  if (member?.attended === false) return null;
  return { mine: row?.wouldGoAgain ?? null };
}

/** The host can take roll call from the start until 30 days after, like feedback. */
const rollCallOpen = (a: { startsAt: string; cancelled: boolean; viewer: { hosting: boolean } }) =>
  a.viewer.hosting &&
  !a.cancelled &&
  new Date(a.startsAt).getTime() <= Date.now() &&
  Date.now() - new Date(a.startsAt).getTime() < FEEDBACK_DAYS * 86_400_000;

/** For the host's activity page: guests, how many are marked, how many came. */
async function rollCallFor(
  db: Db | Tx,
  a: { id: string; startsAt: string; cancelled: boolean; viewer: { hosting: boolean } },
) {
  if (!rollCallOpen(a)) return null;
  const [row] = await db
    .select({
      guests: sql<number>`count(*)::int`,
      marked: sql<number>`count(${activityMembers.attended})::int`,
      came: sql<number>`count(*) filter (where ${activityMembers.attended})::int`,
    })
    .from(activityMembers)
    .where(and(eq(activityMembers.activityId, a.id), eq(activityMembers.role, 'guest')));
  return { guests: row?.guests ?? 0, marked: row?.marked ?? 0, came: row?.came ?? 0 };
}

async function requireRollCall(db: Db, urls: Urls, activityId: string, viewerId: string) {
  const detail = await getActivityDetail(db, urls, activityId, viewerId);
  if (!detail.viewer.hosting) throw forbidden('Only the host takes roll call');
  if (!detail.rollCall) throw forbidden('Roll call opens once the activity has started');
}

/** The host's roll call: every guest, with whether they came (null: not marked yet). */
export async function getRollCall(
  db: Db,
  urls: Urls,
  activityId: string,
  viewerId: string,
): Promise<RollCallGuest[]> {
  await requireRollCall(db, urls, activityId, viewerId);
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      avatarKey: profiles.avatarKey,
      avatarUrl: profiles.avatarUrl,
      attended: activityMembers.attended,
    })
    .from(activityMembers)
    .innerJoin(user, eq(user.id, activityMembers.userId))
    .leftJoin(profiles, eq(profiles.userId, activityMembers.userId))
    .where(and(eq(activityMembers.activityId, activityId), eq(activityMembers.role, 'guest')))
    .orderBy(asc(activityMembers.joinedAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatarUrl: urls.avatar(r.avatarKey, r.avatarUrl),
    attended: r.attended,
  }));
}

/** Marks guests as there or not; anyone not a guest of this activity is ignored. */
export async function setRollCall(
  db: Db,
  urls: Urls,
  activityId: string,
  viewerId: string,
  input: RollCallInput,
) {
  await requireRollCall(db, urls, activityId, viewerId);
  await db.transaction(async (tx) => {
    for (const mark of input.marks) {
      await tx
        .update(activityMembers)
        .set({ attended: mark.attended })
        .where(
          and(
            eq(activityMembers.activityId, activityId),
            eq(activityMembers.userId, mark.userId),
            eq(activityMembers.role, 'guest'),
          ),
        );
    }
  });
  return getActivityDetail(db, urls, activityId, viewerId);
}

/** Records (or changes) a guest's private "would go again" for an activity's host. */
export async function giveFeedback(
  db: Db,
  urls: Urls,
  activityId: string,
  viewerId: string,
  wouldGoAgain: boolean,
) {
  const detail = await getActivityDetail(db, urls, activityId, viewerId);
  if (!detail.feedback || isDeletedAccount(detail.host)) {
    throw forbidden('You can say this once you’ve been to the activity');
  }
  await db
    .insert(activityFeedback)
    .values({ activityId, userId: viewerId, hostId: detail.host.id, wouldGoAgain })
    .onConflictDoUpdate({
      target: [activityFeedback.activityId, activityFeedback.userId],
      set: { wouldGoAgain },
    });
  return getActivityDetail(db, urls, activityId, viewerId);
}

/** Who invited the viewer to an activity (unless either has since blocked the other). */
async function findInviter(db: Db | Tx, urls: Urls, activityId: string, viewerId: string) {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      avatarKey: profiles.avatarKey,
      avatarUrl: profiles.avatarUrl,
    })
    .from(activityInvites)
    .innerJoin(user, eq(user.id, activityInvites.inviterId))
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(
      and(
        eq(activityInvites.activityId, activityId),
        eq(activityInvites.inviteeId, viewerId),
        notBlockedBetween(viewerId, activityInvites.inviterId),
      ),
    );
  return row
    ? { id: row.id, name: row.name, avatarUrl: urls.avatar(row.avatarKey, row.avatarUrl) }
    : null;
}

/** Start times must be in the future and within LIMITS.maxDaysAhead days. */
function checkStartsAt(startsAt: string) {
  const at = new Date(startsAt).getTime();
  if (at <= Date.now()) {
    throw new HttpError(400, ERROR_CODES.validation, 'Pick a time in the future', {
      issues: [{ path: 'startsAt', message: 'Must be in the future' }],
    });
  }
  if (at > Date.now() + LIMITS.maxDaysAhead * 86_400_000) {
    throw new HttpError(
      400,
      ERROR_CODES.validation,
      `Pick a date within ${LIMITS.maxDaysAhead} days`,
      { issues: [{ path: 'startsAt', message: 'Too far ahead' }] },
    );
  }
}

/**
 * Where an activity is: the meeting point the host picked, labelled with the
 * nearest town; without one, the centre of the host's home town.
 */
async function meetingPoint(db: Db | Tx, hostId: string, at?: { lat: number; lng: number }) {
  const town = at ? await nearestPlace(db, at) : await homePlace(db, hostId);
  return { location: at ?? town.location, placeId: town.id, area: placeLabel(town) };
}

export async function createActivity(
  db: Db,
  { urls, storage }: { urls: Urls; storage: Storage | null },
  host: { id: string; name: string },
  input: CreateActivityInput & { description: string },
) {
  checkStartsAt(input.startsAt);
  if (input.coverKey) await requireUpload(storage, input.coverKey, 'cover', host.id);
  if (input.communityId) await requireCommunityMember(db, input.communityId, host.id);

  const where = await meetingPoint(db, host.id, input.location);
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
        area: where.area,
        placeId: where.placeId,
        location: where.location,
        capacity: input.capacity,
        description: input.description,
        costLkr: input.costLkr ?? null,
        bring: input.bring ?? '',
        coverUrl: urls.fromKey(input.coverKey) ?? stockCover(input.group),
        ...(input.repeatsWeekly && { seriesId: randomUUID(), repeatsWeekly: true }),
        communityId: input.communityId ?? null,
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
        cancelled: sql<boolean>`${activities.cancelledAt} is not null`,
        removed: removedSql(me.id),
      })
      .from(activities)
      .where(eq(activities.id, activityId))
      .for('update');
    if (!activity || activity.hostBlocked || activity.removed) throw notFound('Activity');
    if (activity.cancelled) throw conflict('This activity was cancelled');
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

    await addGuest(tx, activityId, me.id);
    const message = await insertSystemMessage(tx, activityId, `${firstName(me.name)} joined`);
    return { joined: true, message };
  });
}

/** Adds a guest, taking them off the waitlist if they were on it. */
async function addGuest(tx: Tx, activityId: string, userId: string) {
  await tx.insert(activityMembers).values({ activityId, userId, role: 'guest' });
  await tx
    .delete(activityWaitlist)
    .where(and(eq(activityWaitlist.activityId, activityId), eq(activityWaitlist.userId, userId)));
}

/**
 * Fills open spots from the waitlist, first in line first. Call with the
 * activity row locked. Does nothing once it has started or been cancelled.
 */
async function promoteFromWaitlist(tx: Tx, activityId: string) {
  const [activity] = await tx
    .select({
      capacity: activities.capacity,
      started: sql<boolean>`${activities.startsAt} <= now()`,
      cancelled: sql<boolean>`${activities.cancelledAt} is not null`,
      going: sql<number>`(select count(*)::int from activity_members m where m.activity_id = ${activities.id})`,
    })
    .from(activities)
    .where(eq(activities.id, activityId));
  const open = activity ? activity.capacity - activity.going : 0;
  if (!activity || activity.started || activity.cancelled || open <= 0) {
    return { messages: [], promoted: [] };
  }

  const next = await tx
    .select({ userId: activityWaitlist.userId, name: user.name })
    .from(activityWaitlist)
    .innerJoin(user, eq(user.id, activityWaitlist.userId))
    .where(eq(activityWaitlist.activityId, activityId))
    .orderBy(asc(activityWaitlist.joinedAt), asc(activityWaitlist.userId))
    .limit(open);
  const messages = [];
  for (const person of next) {
    await addGuest(tx, activityId, person.userId);
    messages.push(
      await insertSystemMessage(
        tx,
        activityId,
        `${firstName(person.name)} joined from the waitlist`,
      ),
    );
  }
  return { messages, promoted: next.map((p) => p.userId) };
}

/**
 * Joins the waitlist of a full activity. If a spot is free after all, joins
 * the activity instead. Repeat calls are no-ops.
 */
export async function joinWaitlist(db: Db, me: { id: string; name: string }, activityId: string) {
  return db.transaction(async (tx) => {
    const [activity] = await tx
      .select({
        capacity: activities.capacity,
        startsAt: activities.startsAt,
        hostBlocked: blockedBetween(me.id, activities.hostId).mapWith(Boolean),
        cancelled: sql<boolean>`${activities.cancelledAt} is not null`,
        removed: removedSql(me.id),
        member: sql<boolean>`exists (select 1 from activity_members m where m.activity_id = ${activities.id} and m.user_id = ${me.id})`,
        waiting: sql<boolean>`exists (select 1 from activity_waitlist w where w.activity_id = ${activities.id} and w.user_id = ${me.id})`,
        going: sql<number>`(select count(*)::int from activity_members m where m.activity_id = ${activities.id})`,
        waitingCount: sql<number>`(select count(*)::int from activity_waitlist w where w.activity_id = ${activities.id})`,
      })
      .from(activities)
      .where(eq(activities.id, activityId))
      .for('update');
    if (!activity || activity.hostBlocked || activity.removed) throw notFound('Activity');
    if (activity.cancelled) throw conflict('This activity was cancelled');
    if (activity.startsAt.getTime() <= Date.now())
      throw conflict('This activity has already started');
    if (activity.member || activity.waiting) return { message: null };

    if (activity.going < activity.capacity) {
      await addGuest(tx, activityId, me.id);
      return { message: await insertSystemMessage(tx, activityId, `${firstName(me.name)} joined`) };
    }
    if (activity.waitingCount >= LIMITS.waitlistMax) {
      throw conflict('The waitlist is full too', ERROR_CODES.waitlistFull);
    }
    await tx.insert(activityWaitlist).values({ activityId, userId: me.id });
    return { message: null };
  });
}

const removedSql = (userId: string) =>
  sql<boolean>`exists (select 1 from activity_removals r where r.activity_id = ${activities.id} and r.user_id = ${userId})`;

/**
 * Host removes a guest (or someone waiting). They're told they're no longer
 * going, can't rejoin or see it again, and the next person waiting moves in.
 * The reason is stored for moderation only.
 */
export async function removeGuest(
  db: Db,
  host: { id: string },
  activityId: string,
  userId: string,
  reason: RemovalReason,
) {
  return db.transaction(async (tx) => {
    // Removing someone stays possible once it's started (trouble on the day).
    const row = await lockForHost(tx, host.id, activityId, { evenIfStarted: true });
    if (userId === host.id) throw forbidden('Hosts can’t remove themselves');
    const [person] = await tx.select({ name: user.name }).from(user).where(eq(user.id, userId));
    const left = await tx
      .delete(activityMembers)
      .where(and(eq(activityMembers.activityId, activityId), eq(activityMembers.userId, userId)))
      .returning({ userId: activityMembers.userId });
    const unqueued = await tx
      .delete(activityWaitlist)
      .where(and(eq(activityWaitlist.activityId, activityId), eq(activityWaitlist.userId, userId)))
      .returning({ userId: activityWaitlist.userId });
    if (!person || (!left.length && !unqueued.length)) throw notFound('Guest');

    await tx.insert(activityRemovals).values({ activityId, userId, reason }).onConflictDoNothing();
    // Worded gently: everyone else in the chat sees this.
    const messages = left.length
      ? [await insertSystemMessage(tx, activityId, `${firstName(person.name)} is no longer going`)]
      : [];
    const moved = await promoteFromWaitlist(tx, activityId);
    return {
      wasGoing: left.length > 0,
      title: row.title,
      messages: [...messages, ...moved.messages],
      promoted: moved.promoted,
    };
  });
}

/** Leaves the waitlist. A no-op if you weren't on it. */
export async function leaveWaitlist(db: Db, userId: string, activityId: string) {
  await db.transaction(async (tx) => {
    // Locked like joins and promotions, so nobody is moved in just as they leave.
    await tx
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.id, activityId))
      .for('update');
    await tx
      .delete(activityWaitlist)
      .where(and(eq(activityWaitlist.activityId, activityId), eq(activityWaitlist.userId, userId)));
  });
}

/** "Sat 14 Nov, 17:45" in Sri Lanka time, for chat lines and notifications. */
export const whenText = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);

/**
 * Locks an activity the host is about to change. Only its host may, and only
 * while it's still ahead and not cancelled.
 */
async function lockForHost(
  tx: Tx,
  hostId: string,
  activityId: string,
  { evenIfStarted = false } = {},
) {
  const [row] = await tx
    .select()
    .from(activities)
    .where(eq(activities.id, activityId))
    .for('update');
  if (!row) throw notFound('Activity');
  if (row.hostId !== hostId) throw forbidden('Only the host can change this activity');
  if (row.cancelledAt) throw conflict('This activity was cancelled');
  if (!evenIfStarted && row.startsAt.getTime() < Date.now()) {
    throw conflict('This activity has already started');
  }
  return row;
}

/**
 * Host edits. A new time or place is posted in the chat and pushed to
 * everyone going (`notice`); other edits just update the page.
 */
export async function updateActivity(
  db: Db,
  { urls, storage }: { urls: Urls; storage: Storage | null },
  host: { id: string; name: string },
  activityId: string,
  input: UpdateActivityInput,
) {
  if (input.startsAt !== undefined) checkStartsAt(input.startsAt);
  if (input.coverKey) await requireUpload(storage, input.coverKey, 'cover', host.id);
  return db.transaction(async (tx) => {
    const row = await lockForHost(tx, host.id, activityId);

    if (input.capacity !== undefined) {
      const [going] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(activityMembers)
        .where(eq(activityMembers.activityId, activityId));
      if (input.capacity < (going?.n ?? 0)) {
        throw new HttpError(
          400,
          ERROR_CODES.validation,
          `${going!.n} people are going, so keep at least ${going!.n} spots`,
          { issues: [{ path: 'capacity', message: 'Fewer than the people going' }] },
        );
      }
    }

    const startsAt = input.startsAt === undefined ? undefined : new Date(input.startsAt);
    const timeChanged = !!startsAt && startsAt.getTime() !== row.startsAt.getTime();
    const relocated =
      !!input.location &&
      (input.location.lat !== row.location.lat || input.location.lng !== row.location.lng);
    const placeChanged = (input.place !== undefined && input.place !== row.place) || relocated;
    const where = relocated ? await meetingPoint(tx, host.id, input.location) : null;
    const group = input.group ?? (row.group as ActivityGroup);
    const groupChanged = group !== row.group;

    const patch = {
      title: input.title,
      description: input.description,
      costLkr: input.costLkr,
      bring: input.bring,
      capacity: input.capacity,
      place: input.place,
      ...(where && { location: where.location, placeId: where.placeId, area: where.area }),
      startsAt,
      // A new time gets its own reminders.
      ...(timeChanged && { dayBeforeSentAt: null, reminderSentAt: null, followUpSentAt: null }),
      ...(groupChanged
        ? {
            group,
            category: row.interest ? row.category : GROUP_CATEGORY[group],
            // Swap the stock photo along with the type; keep an uploaded cover.
            coverUrl:
              row.coverUrl === stockCover(row.group as ActivityGroup)
                ? stockCover(group)
                : row.coverUrl,
          }
        : {}),
      ...(input.coverKey !== undefined && {
        coverUrl: (input.coverKey && urls.fromKey(input.coverKey)) || stockCover(group),
      }),
    };
    const replacedPhotos =
      patch.coverUrl !== undefined && patch.coverUrl !== row.coverUrl && row.coverUrl
        ? [row.coverUrl]
        : [];
    // Some edits (e.g. only repeating) have nothing to set here.
    if (Object.values(patch).some((v) => v !== undefined)) {
      await tx.update(activities).set(patch).where(eq(activities.id, activityId));
    }

    if (input.repeatsWeekly !== undefined && input.repeatsWeekly !== row.repeatsWeekly) {
      if (input.repeatsWeekly) {
        await tx
          .update(activities)
          .set({ repeatsWeekly: true, seriesId: row.seriesId ?? randomUUID() })
          .where(eq(activities.id, activityId));
      } else {
        // Stops the series: no more weeks after this one.
        await tx
          .update(activities)
          .set({ repeatsWeekly: false })
          .where(
            row.seriesId ? eq(activities.seriesId, row.seriesId) : eq(activities.id, activityId),
          );
      }
    }

    // More spots: people waiting move in.
    const moved =
      input.capacity !== undefined && input.capacity > row.capacity
        ? await promoteFromWaitlist(tx, activityId)
        : { messages: [], promoted: [] };

    const changes = [
      timeChanged && `the time to ${whenText(startsAt!)}`,
      placeChanged && `the place to ${input.place ?? row.place}`,
    ].filter(Boolean);
    if (!changes.length) return { ...moved, notice: null, replacedPhotos };

    const message = await insertSystemMessage(
      tx,
      activityId,
      `${firstName(host.name)} changed ${changes.join(' and ')}`,
    );
    const notice = {
      title: input.title ?? row.title,
      body: `Now ${[timeChanged && whenText(startsAt!), placeChanged && `at ${input.place ?? row.place}`].filter(Boolean).join(', ')}`,
    };
    return {
      messages: [message, ...moved.messages],
      promoted: moved.promoted,
      notice,
      replacedPhotos,
    };
  });
}

/**
 * Host calls it off. People who were going keep it (marked cancelled) and its
 * chat. For a weekly activity, `stopRepeating` ends the series too; otherwise
 * only this week is off and next week's still goes up.
 */
export async function cancelActivity(
  db: Db,
  host: { id: string; name: string },
  activityId: string,
  { stopRepeating = false }: { stopRepeating?: boolean } = {},
) {
  return db.transaction(async (tx) => {
    const row = await lockForHost(tx, host.id, activityId);
    const who = firstName(host.name);
    return cancelLocked(tx, row, {
      stopRepeating,
      line: `${who} cancelled this activity`,
      notice: { title: `Cancelled: ${row.title}`, body: `${who} called it off.` },
    });
  });
}

/** Cancels an activity whose row the caller has locked, and clears its waitlist. */
export async function cancelLocked(
  tx: Tx,
  row: typeof activities.$inferSelect,
  {
    stopRepeating,
    line,
    notice,
  }: { stopRepeating: boolean; line: string; notice: { title: string; body: string } },
): Promise<ChangeResult> {
  await tx.update(activities).set({ cancelledAt: new Date() }).where(eq(activities.id, row.id));
  if (stopRepeating && row.seriesId) {
    await tx
      .update(activities)
      .set({ repeatsWeekly: false })
      .where(eq(activities.seriesId, row.seriesId));
  }
  const message = await insertSystemMessage(tx, row.id, line);
  const waiting = await tx
    .delete(activityWaitlist)
    .where(eq(activityWaitlist.activityId, row.id))
    .returning({ userId: activityWaitlist.userId });
  return { messages: [message], promoted: [], waiting: waiting.map((w) => w.userId), notice };
}

/** Leaves an activity. Hosts can't leave their own activity. Leaving twice is a no-op. */
export async function leaveActivity(db: Db, me: { id: string; name: string }, activityId: string) {
  return db.transaction(async (tx) => {
    // Locked like joins, so the freed spot goes to the waitlist, not a racing join.
    await tx
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.id, activityId))
      .for('update');
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
      return { left: false, messages: [], promoted: [] };
    }
    if (member.role === 'host') throw forbidden('Hosts can’t leave their own activity');

    await tx
      .delete(activityMembers)
      .where(and(eq(activityMembers.activityId, activityId), eq(activityMembers.userId, me.id)));
    const message = await insertSystemMessage(tx, activityId, `${firstName(me.name)} left`);
    const moved = await promoteFromWaitlist(tx, activityId);
    return { left: true, messages: [message, ...moved.messages], promoted: moved.promoted };
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
      imageKey: messages.imageKey,
      poll: messages.poll,
      deletedAt: messages.deletedAt,
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
            senderName: m.senderName ?? DELETED_ACCOUNT.name,
            body: m.deletedAt
              ? 'Message deleted'
              : messageSummary({
                  body: m.body,
                  hasImage: !!m.imageKey,
                  pollQuestion: m.poll?.question,
                }),
            mine: m.senderId === userId,
          }
        : null,
    };
  });
}
