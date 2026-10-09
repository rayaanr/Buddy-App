import type { ActivitySummary, DiscoverFilter } from '@buddy/shared';
import { and, asc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';

import type { Db, Tx } from '../../db/client';
import type { LatLng } from '../../db/geography';
import { activities, activityMembers, communities, profiles, user } from '../../db/schema';
import type { Urls } from '../../lib/urls';
import { blockedBetween, notBlockedBetween } from '../safety/blocks';

/** Activities stay listed until an hour after they start. */
export const upcoming = () => gte(activities.startsAt, sql`now() - interval '1 hour'`);

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
 * Selects activities in the shape of ActivitySummary. Every list in the API
 * goes through here so counts, viewer flags and blocking apply one way:
 * activities hosted by someone the viewer blocked (or who blocked them) are
 * left out, unless the viewer is already going.
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
      hostId: user.id,
      hostName: user.name,
      hostAvatarKey: profiles.avatarKey,
      hostAvatarUrl: profiles.avatarUrl,
      communityId: communities.id,
      communityName: communities.name,
      goingCount: sql<number>`(select count(*)::int from activity_members m where m.activity_id = ${activities.id})`,
      viewerRole: viewerId
        ? sql<
            string | null
          >`(select m.role from activity_members m where m.activity_id = ${activities.id} and m.user_id = ${viewerId})`
        : sql<null>`null`,
      distanceKm: near
        ? sql<number>`ST_Distance(${activities.location}, ${pointSql(near)}) / 1000`
        : sql<null>`null`,
    })
    .from(activities)
    .innerJoin(user, eq(user.id, activities.hostId))
    .leftJoin(profiles, eq(profiles.userId, activities.hostId))
    .leftJoin(communities, eq(communities.id, activities.communityId))
    .where(
      and(
        ...where,
        viewerId
          ? sql`(not ${blockedBetween(viewerId, activities.hostId)} or exists (select 1 from activity_members m where m.activity_id = ${activities.id} and m.user_id = ${viewerId}))`
          : undefined,
      ),
    )
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
    coverUrl: r.coverUrl,
    host: {
      id: r.hostId,
      name: r.hostName,
      avatarUrl: urls.avatar(r.hostAvatarKey, r.hostAvatarUrl),
    },
    community:
      r.communityId && r.communityName ? { id: r.communityId, name: r.communityName } : null,
    viewer: { joined: r.viewerRole === 'guest', hosting: r.viewerRole === 'host' },
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

/** Up to `limit` people going, host first, then by join time; blocked people left out. */
export async function findAttendees(
  db: Db | Tx,
  urls: Urls,
  activityId: string,
  viewerId: string,
  limit = 5,
) {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      avatarKey: profiles.avatarKey,
      avatarUrl: profiles.avatarUrl,
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
    )
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatarUrl: urls.avatar(r.avatarKey, r.avatarUrl),
  }));
}

export async function countHosted(db: Db | Tx, userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(activities)
    .where(eq(activities.hostId, userId));
  return row?.n ?? 0;
}
