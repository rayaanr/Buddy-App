import type { CommunityDetail, CommunitySummary } from '@buddy/shared';
import { and, asc, eq, sql } from 'drizzle-orm';

import type { Db } from '../../db/client';
import { activities, communities, communityMembers, profiles, user } from '../../db/schema';
import { notFound } from '../../lib/errors';
import type { Urls } from '../../lib/urls';
import { findActivitySummaries, upcoming } from '../activities/queries';
import { originFor } from '../profiles/service';

const MEMBER_PREVIEW = 6;

async function findCommunitySummaries(db: Db, viewerId: string, id?: string) {
  const rows = await db
    .select({
      id: communities.id,
      name: communities.name,
      coverUrl: communities.coverUrl,
      memberCount: sql<number>`(select count(*)::int from community_members cm where cm.community_id = ${communities.id})`,
      weeklyActivityCount: sql<number>`(select count(*)::int from activities a where a.community_id = ${communities.id} and a.starts_at between now() and now() + interval '7 days')`,
      joined: sql<boolean>`exists (select 1 from community_members cm where cm.community_id = ${communities.id} and cm.user_id = ${viewerId})`,
    })
    .from(communities)
    .where(id ? eq(communities.id, id) : undefined)
    .orderBy(asc(communities.name));
  return rows satisfies CommunitySummary[];
}

export const listCommunities = (db: Db, viewerId: string) => findCommunitySummaries(db, viewerId);

export async function getCommunity(
  db: Db,
  urls: Urls,
  id: string,
  viewerId: string,
): Promise<CommunityDetail> {
  const [summary] = await findCommunitySummaries(db, viewerId, id);
  if (!summary) throw notFound('Community');

  const [info] = await db
    .select({ about: communities.about, rules: communities.rules })
    .from(communities)
    .where(eq(communities.id, id));

  const members = await db
    .select({
      id: user.id,
      name: user.name,
      avatarKey: profiles.avatarKey,
      avatarUrl: profiles.avatarUrl,
    })
    .from(communityMembers)
    .innerJoin(user, eq(user.id, communityMembers.userId))
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(communityMembers.communityId, id))
    .orderBy(asc(communityMembers.joinedAt))
    .limit(MEMBER_PREVIEW);

  const upcomingActivities = await findActivitySummaries(db, urls, {
    viewerId,
    near: await originFor(db, viewerId),
    where: [upcoming(), eq(activities.communityId, id)],
  });

  return {
    ...summary,
    about: info?.about ?? '',
    rules: info?.rules ?? [],
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      avatarUrl: urls.avatar(m.avatarKey, m.avatarUrl),
    })),
    upcoming: upcomingActivities,
  };
}

async function requireCommunity(db: Db, id: string) {
  const [row] = await db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.id, id));
  if (!row) throw notFound('Community');
}

/** Join and leave are idempotent; both return the updated summary. */
export async function joinCommunity(db: Db, id: string, userId: string) {
  await requireCommunity(db, id);
  await db.insert(communityMembers).values({ communityId: id, userId }).onConflictDoNothing();
  const [summary] = await findCommunitySummaries(db, userId, id);
  return summary!;
}

export async function leaveCommunity(db: Db, id: string, userId: string) {
  await requireCommunity(db, id);
  await db
    .delete(communityMembers)
    .where(and(eq(communityMembers.communityId, id), eq(communityMembers.userId, userId)));
  const [summary] = await findCommunitySummaries(db, userId, id);
  return summary!;
}
