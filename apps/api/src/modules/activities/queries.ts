import { DELETED_ACCOUNT, type ActivitySummary, type DiscoverFilter } from '@buddy/shared';
import { and, asc, eq, gte, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Db, Tx } from '../../db/client';
import type { LatLng } from '../../db/geography';
import {
  activityFeedback,
  activities,
  activityMembers,
  activityWaitlist,
  communities,
  profiles,
  user,
} from '../../db/schema';
import type { Urls } from '../../lib/urls';

const viewerMember = alias(activityMembers, 'viewer_member');
import { blockedBetween, notBlockedBetween } from '../safety/blocks';

/** Activities stay listed until an hour after they start. */
export const upcoming = () => gte(activities.startsAt, sql`now() - interval '1 hour'`);

/** For browsing lists (Discover, communities, profiles); "Your activities" keeps cancelled ones. */
export const notCancelled = () => isNull(activities.cancelledAt);

/** Discover filters, evaluated in Sri Lanka time. */
export function filterCondition(filter: DiscoverFilter): SQL | undefined {
  const localDate = (col: SQL | typeof activities.startsAt) =>
    sql`(${col} at time zone 'Asia/Colombo')::date`;
  switch (filter) {
    case 'All':
      return undefined;
    case 'Tonight':
      return sql`${localDate(activities.startsAt)} = ${localDate(sql`now()`)}`;
    case 'Weekend':
      return sql`extract(isodow from ${activities.startsAt} at time zone 'Asia/Colombo') in (6, 7)`;
    case 'Sports':
      return inArray(activities.group, ['Sports', 'Running']);
    default:
      return eq(activities.group, filter);
  }
}

export const pointSql = ({ lat, lng }: LatLng) =>
  sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

export interface SummaryOptions {
  viewerId: string | null;
  /** Origin for distanceKm; omit to leave distance null. */
  near?: LatLng;
  where?: (SQL | undefined)[];
  orderBy?: SQL[];
  limit?: number;
}

/**
 * Activities someone may see: not hosted by someone on either side of a block
 * with them, not cancelled, unless they're going; never one they were removed
 * from. Signed out (null): not cancelled.
 */
export function visibleTo(viewerId: string | null) {
  if (!viewerId) return isNull(activities.cancelledAt);
  return and(
    sql`(not ${blockedBetween(viewerId, activities.hostId)} or ${isMember(viewerId)})`,
    sql`(${activities.cancelledAt} is null or ${isMember(viewerId)})`,
    sql`not exists (select 1 from activity_removals r where r.activity_id = ${activities.id} and r.user_id = ${viewerId})`,
  );
}

const isMember = (viewerId: string) =>
  sql`exists (select 1 from activity_members m where m.activity_id = ${activities.id} and m.user_id = ${viewerId})`;

/**
 * Selects activities in the shape of ActivitySummary. Every list in the API
 * goes through here so counts, viewer flags and blocking apply one way:
 * activities hosted by someone the viewer blocked (or who blocked them), and
 * cancelled activities, are left out unless the viewer is already going;
 * activities the host removed the viewer from are always left out.
 */
export async function findActivitySummaries(
  db: Db | Tx,
  urls: Urls,
  { viewerId, near, where = [], orderBy, limit }: SummaryOptions,
): Promise<ActivitySummary[]> {
  const query = db
    .select({
      id: activities.id,
      title: activities.title,
      category: activities.category,
      group: activities.group,
      interest: activities.interest,
      startsAt: activities.startsAt,
      place: activities.place,
      area: activities.area,
      location: activities.location,
      capacity: activities.capacity,
      coverUrl: activities.coverUrl,
      costLkr: activities.costLkr,
      cancelledAt: activities.cancelledAt,
      repeatsWeekly: activities.repeatsWeekly,
      hostId: user.id,
      hostName: user.name,
      hostAvatarKey: profiles.avatarKey,
      hostAvatarUrl: profiles.avatarUrl,
      communityId: communities.id,
      communityName: communities.name,
      goingCount: sql<number>`(select count(*)::int from activity_members m where m.activity_id = ${activities.id})`,
      waitingCount: sql<number>`(select count(*)::int from activity_waitlist w where w.activity_id = ${activities.id})`,
      chatMuted: sql<boolean>`coalesce(${viewerMember.chatMuted}, false)`,
      waitlistPosition: viewerId
        ? sql<
            number | null
          >`(select count(*)::int from activity_waitlist w, activity_waitlist mine where mine.activity_id = ${activities.id} and mine.user_id = ${viewerId} and w.activity_id = mine.activity_id and (w.joined_at, w.user_id) <= (mine.joined_at, mine.user_id) having count(*) > 0)`
        : sql<null>`null`,
      viewerRole: viewerMember.role,
      distanceKm: near
        ? sql<number>`ST_Distance(${activities.location}, ${pointSql(near)}) / 1000`
        : sql<null>`null`,
    })
    .from(activities)
    // Left joins: an activity outlives a host who deleted their account.
    .leftJoin(user, eq(user.id, activities.hostId))
    .leftJoin(profiles, eq(profiles.userId, activities.hostId))
    .leftJoin(communities, eq(communities.id, activities.communityId))
    // The viewer's own membership row, if any (role and mute in one lookup).
    .leftJoin(
      viewerMember,
      viewerId
        ? and(eq(viewerMember.activityId, activities.id), eq(viewerMember.userId, viewerId))
        : sql`false`,
    )
    .where(and(...where, visibleTo(viewerId)))
    .orderBy(...(orderBy ?? [asc(activities.startsAt), asc(activities.id)]));

  const rows = limit ? await query.limit(limit) : await query;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    group: r.group as ActivitySummary['group'],
    interest: (r.interest as ActivitySummary['interest']) ?? null,
    startsAt: r.startsAt.toISOString(),
    place: r.place,
    area: r.area,
    location: r.location,
    distanceKm: r.distanceKm === null ? null : Math.round(Number(r.distanceKm) * 10) / 10,
    capacity: r.capacity,
    goingCount: r.goingCount,
    waitingCount: r.waitingCount,
    coverUrl: r.coverUrl,
    costLkr: r.costLkr,
    host:
      r.hostId && r.hostName
        ? {
            id: r.hostId,
            name: r.hostName,
            avatarUrl: urls.avatar(r.hostAvatarKey, r.hostAvatarUrl),
          }
        : DELETED_ACCOUNT,
    community:
      r.communityId && r.communityName ? { id: r.communityId, name: r.communityName } : null,
    viewer: {
      joined: r.viewerRole === 'guest',
      hosting: r.viewerRole === 'host',
      waitlistPosition: r.waitlistPosition,
      chatMuted: r.chatMuted,
    },
    cancelled: r.cancelledAt !== null,
    repeatsWeekly: r.repeatsWeekly,
  }));
}

export async function findActivitySummary(
  db: Db | Tx,
  urls: Urls,
  id: string,
  viewerId: string | null,
) {
  const [row] = await findActivitySummaries(db, urls, {
    viewerId,
    where: [eq(activities.id, id)],
  });
  return row ?? null;
}

/** People going, host first, then by join time; blocked people left out. */
export async function findMembers(
  db: Db | Tx,
  urls: Urls,
  activityId: string,
  viewerId: string,
  limit?: number,
) {
  const query = db
    .select({
      id: user.id,
      name: user.name,
      avatarKey: profiles.avatarKey,
      avatarUrl: profiles.avatarUrl,
      role: activityMembers.role,
    })
    .from(activityMembers)
    .innerJoin(user, eq(user.id, activityMembers.userId))
    .leftJoin(profiles, eq(profiles.userId, activityMembers.userId))
    .where(
      and(
        eq(activityMembers.activityId, activityId),
        notBlockedBetween(viewerId, activityMembers.userId),
      ),
    )
    .orderBy(
      sql`case when ${activityMembers.role} = 'host' then 0 else 1 end`,
      asc(activityMembers.joinedAt),
    );
  const rows = limit ? await query.limit(limit) : await query;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatarUrl: urls.avatar(r.avatarKey, r.avatarUrl),
    role: r.role as 'host' | 'guest',
  }));
}

/** People waiting for a spot, first in line first; blocked people left out. */
export async function findWaitlist(db: Db | Tx, urls: Urls, activityId: string, viewerId: string) {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      avatarKey: profiles.avatarKey,
      avatarUrl: profiles.avatarUrl,
    })
    .from(activityWaitlist)
    .innerJoin(user, eq(user.id, activityWaitlist.userId))
    .leftJoin(profiles, eq(profiles.userId, activityWaitlist.userId))
    .where(
      and(
        eq(activityWaitlist.activityId, activityId),
        notBlockedBetween(viewerId, activityWaitlist.userId),
      ),
    )
    .orderBy(asc(activityWaitlist.joinedAt), asc(activityWaitlist.userId));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatarUrl: urls.avatar(r.avatarKey, r.avatarUrl),
  }));
}

/** The first few people going, for the activity page's face pile. */
export async function findAttendees(
  db: Db | Tx,
  urls: Urls,
  activityId: string,
  viewerId: string,
  limit = 5,
) {
  const members = await findMembers(db, urls, activityId, viewerId, limit);
  return members.map(({ role: _role, ...person }) => person);
}

export async function countHosted(db: Db | Tx, userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(activities)
    .where(eq(activities.hostId, userId));
  return row?.n ?? 0;
}

/** Guests who said they'd go again with this host. */
export async function countWouldGoAgain(db: Db | Tx, hostId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(activityFeedback)
    .where(
      and(
        eq(activityFeedback.hostId, hostId),
        eq(activityFeedback.wouldGoAgain, true),
        // Only from guests still in it, not marked absent by the host's roll
        // call, who joined before it started (or the host marked as there):
        // otherwise anyone could join a started activity, vote and leave.
        sql`exists (
          select 1 from activity_members m join activities a on a.id = m.activity_id
          where m.activity_id = ${activityFeedback.activityId}
            and m.user_id = ${activityFeedback.userId}
            and m.role = 'guest'
            and m.attended is not false
            and (m.joined_at < a.starts_at or m.attended)
        )`,
      ),
    );
  return row?.n ?? 0;
}
