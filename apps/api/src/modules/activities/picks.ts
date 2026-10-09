import type { ActivitySummary, Pick } from '@buddy/shared';
import { eq, sql } from 'drizzle-orm';

import type { Db } from '../../db/client';
import { activities, communities, communityMembers, profiles } from '../../db/schema';
import type { Urls } from '../../lib/urls';
import { originFor } from '../profiles/service';
import { findActivitySummaries, pointSql, upcoming } from './queries';

const DECK_SIZE = 5;
const RADIUS_KM = 25;

/**
 * "Picked for you": open activities nearby that you're not part of, ranked by
 * joined community (+2), matching interest (+1), then start time.
 */
export async function picksFor(db: Db, urls: Urls, userId: string): Promise<Pick[]> {
  const [[profile], joinedComms, near] = await Promise.all([
    db.select({ interests: profiles.interests }).from(profiles).where(eq(profiles.userId, userId)),
    db
      .select({ id: communities.id })
      .from(communityMembers)
      .innerJoin(communities, eq(communities.id, communityMembers.communityId))
      .where(eq(communityMembers.userId, userId)),
    originFor(db, userId),
  ]);
  const interests = profile?.interests ?? [];
  const communityIds = joinedComms.map((c) => c.id);

  const interestScore = interests.length
    ? sql`case when ${activities.interest} in ${interests} then 1 else 0 end`
    : sql`0`;
  const communityScore = communityIds.length
    ? sql`case when ${activities.communityId} in ${communityIds} then 2 else 0 end`
    : sql`0`;

  const candidates = await findActivitySummaries(db, urls, {
    viewerId: userId,
    near,
    where: [
      upcoming(),
      sql`ST_DWithin(${activities.location}, ${pointSql(near)}, ${RADIUS_KM * 1000})`,
      sql`not exists (select 1 from activity_members m where m.activity_id = ${activities.id} and m.user_id = ${userId})`,
      sql`(select count(*) from activity_members m where m.activity_id = ${activities.id}) < ${activities.capacity}`,
    ],
    orderBy: [sql`(${communityScore}) + (${interestScore}) desc`, sql`${activities.startsAt} asc`],
    limit: DECK_SIZE,
  });

  const joined = new Set(communityIds);
  return candidates.map((activity) => ({
    activity,
    reason: reasonFor(activity, interests, joined),
  }));
}

function reasonFor(a: ActivitySummary, interests: string[], joinedCommunities: Set<string>) {
  if (a.community && joinedCommunities.has(a.community.id)) return `From ${a.community.name}`;
  if (a.interest && interests.includes(a.interest)) return `Because you’re into ${a.interest}`;
  return 'Popular nearby';
}
