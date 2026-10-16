import type { ActivitySummary, Pick } from '@buddy/shared';
import { eq, sql } from 'drizzle-orm';

import type { Db } from '../../db/client';
import { activities, communities, communityMembers, profiles } from '../../db/schema';
import type { Urls } from '../../lib/urls';
import { originFor } from '../profiles/service';
import { findActivitySummaries, pointSql, upcoming } from './queries';

const DECK_SIZE = 5;
const CANDIDATES = 20;
const RADIUS_KM = 25;
const WIDER_KM = [100, 450];

/**
 * "Picked for you": open activities nearby that you're not part of, ranked by
 * joined community (+2), matching interest (+1), then start time. Kinds you
 * said you're not into stay out (except from your communities).
 */
export async function picksFor(db: Db, urls: Urls, userId: string): Promise<Pick[]> {
  const [[profile], joinedComms, near] = await Promise.all([
    db
      .select({ interests: profiles.interests, hidden: profiles.hiddenInterests })
      .from(profiles)
      .where(eq(profiles.userId, userId)),
    db
      .select({ id: communities.id })
      .from(communityMembers)
      .innerJoin(communities, eq(communities.id, communityMembers.communityId))
      .where(eq(communityMembers.userId, userId)),
    originFor(db, userId),
  ]);
  const interests = profile?.interests ?? [];
  const hidden = profile?.hidden ?? [];
  const communityIds = joinedComms.map((c) => c.id);
  // "Not into this": leave those kinds out, unless they're from a community you joined.
  const notHidden = hidden.length
    ? sql`(${activities.interest} is null or ${activities.interest} not in ${hidden}${
        communityIds.length ? sql` or ${activities.communityId} in ${communityIds}` : sql``
      })`
    : sql`true`;

  const interestScore = interests.length
    ? sql`case when ${activities.interest} in ${interests} then 1 else 0 end`
    : sql`0`;
  const communityScore = communityIds.length
    ? sql`case when ${activities.communityId} in ${communityIds} then 2 else 0 end`
    : sql`0`;

  const within = (km: number) =>
    findActivitySummaries(db, urls, {
      viewerId: userId,
      near,
      where: [
        upcoming(),
        sql`ST_DWithin(${activities.location}, ${pointSql(near)}, ${km * 1000})`,
        // Their own activities, looked up once rather than per activity.
        sql`${activities.id} not in (select m.activity_id from activity_members m where m.user_id = ${userId})`,
        notHidden,
      ],
      orderBy: [
        sql`(${communityScore}) + (${interestScore}) desc`,
        sql`${activities.startsAt} asc`,
      ],
      // A few spare: full ones are dropped below. Counting who's going for
      // every activity nearby, to skip full ones in the query, made this the
      // slowest query in the app.
      limit: CANDIDATES,
    }).then((found) => found.filter((a) => a.goingCount < a.capacity).slice(0, DECK_SIZE));
  // Few nearby (outside the cities): keep those first and top up from further away.
  const candidates = await within(RADIUS_KM);
  for (const km of WIDER_KM) {
    if (candidates.length >= DECK_SIZE) break;
    const have = new Set(candidates.map((a) => a.id));
    const more = (await within(km)).filter((a) => !have.has(a.id));
    candidates.push(...more.slice(0, DECK_SIZE - candidates.length));
  }

  const joined = new Set(communityIds);
  return candidates.map((activity) => ({
    activity,
    reason: reasonFor(activity, interests, joined),
    fromYourCommunity: !!activity.community && joined.has(activity.community.id),
  }));
}

function reasonFor(a: ActivitySummary, interests: string[], joinedCommunities: Set<string>) {
  if (a.community && joinedCommunities.has(a.community.id)) return `From ${a.community.name}`;
  if (a.interest && interests.includes(a.interest)) return `Because you’re into ${a.interest}`;
  return 'Popular nearby';
}
