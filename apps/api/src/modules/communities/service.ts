import { artFromKey, FALLBACK_ART, placeLabel } from '@buddy/shared';
import type {
  CommunityDetail,
  CommunitySummary,
  CreateCommunityInput,
  UpdateCommunityInput,
} from '@buddy/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { Db } from '../../db/client';
import {
  activities,
  communities,
  communityMembers,
  communityRemovals,
  places,
  profiles,
  user,
} from '../../db/schema';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import type { Storage } from '../../lib/storage';
import { requireUpload } from '../../lib/upload-keys';
import type { Urls } from '../../lib/urls';
import { communityChatPhotos } from '../chat/service';
import { findActivitySummaries, notCancelled, pointSql, upcoming } from '../activities/queries';
import { homePlace, originFor, requirePlace, toPlace } from '../profiles/service';
import { notBlockedBetween } from '../safety/blocks';

const MEMBER_PREVIEW = 6;
/** The full list is short for now; page it once communities get big. */
const MEMBER_LIST_MAX = 500;
/** Activities on the community page; "See all" lists the rest. */
const UPCOMING_PREVIEW = 10;
const UPCOMING_MAX = 100;

/** Everything coming up in a community, soonest first (Community → See all). */
export async function communityActivities(db: Db, urls: Urls, id: string, viewerId: string) {
  await getCommunity(db, urls, id, viewerId); // exists, and not hidden from you
  return findActivitySummaries(db, urls, {
    viewerId,
    near: await originFor(db, viewerId),
    where: [upcoming(), notCancelled(), eq(activities.communityId, id)],
    limit: UPCOMING_MAX,
  });
}

// Spelled out: with a single table Drizzle writes a bare "id", which inside
// these subqueries would mean the activity's or member's own id.
const communityId = sql.raw('"communities"."id"');

/**
 * Communities as cards, nearest to the viewer's home town first. `q` keeps
 * those whose name, description or town matches.
 */
async function findCommunitySummaries(
  db: Db,
  urls: Urls,
  viewerId: string,
  { id, q }: { id?: string; q?: string } = {},
): Promise<CommunitySummary[]> {
  const near = pointSql(await originFor(db, viewerId));
  const term = q ? `%${q.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%` : null;
  const distance = sql<number>`ST_Distance(${places.location}, ${near}) / 1000`;
  const rows = await db
    .select({
      id: communities.id,
      name: communities.name,
      coverUrl: communities.coverUrl,
      logoUrl: communities.logoUrl,
      place: places,
      distanceKm: distance,
      memberCount: sql<number>`(select count(*)::int from community_members cm where cm.community_id = ${communityId})`,
      weeklyActivityCount: sql<number>`(select count(*)::int from activities a where a.community_id = ${communityId} and a.cancelled_at is null and a.starts_at between now() and now() + interval '7 days')`,
      joined: sql<boolean>`exists (select 1 from community_members cm where cm.community_id = ${communityId} and cm.user_id = ${viewerId})`,
    })
    .from(communities)
    .innerJoin(places, eq(places.id, communities.placeId))
    .where(
      and(
        id ? eq(communities.id, id) : undefined,
        term
          ? sql`(lower(${communities.name}) like ${term}
              or lower(${communities.about}) like ${term}
              or lower(${places.name}) like ${term}
              or lower(${places.district}) like ${term})`
          : undefined,
      ),
    )
    .orderBy(distance, asc(communities.name));
  return rows.map(({ place, distanceKm, ...c }) => ({
    ...c,
    coverUrl: urls.image(c.coverUrl),
    logoUrl: urls.image(c.logoUrl),
    area: placeLabel(toPlace(place)),
    placeId: place.id,
    distanceKm: Math.round(Number(distanceKm) * 10) / 10,
  }));
}

export const listCommunities = (db: Db, urls: Urls, viewerId: string, q?: string) =>
  findCommunitySummaries(db, urls, viewerId, { q });

export async function getCommunity(
  db: Db,
  urls: Urls,
  id: string,
  viewerId: string,
): Promise<CommunityDetail> {
  const [summary] = await findCommunitySummaries(db, urls, viewerId, { id });
  if (!summary) throw notFound('Community');

  const [info] = await db
    .select({
      about: communities.about,
      rules: communities.rules,
      createdBy: communities.createdBy,
    })
    .from(communities)
    .where(eq(communities.id, id));

  const [mine] = await db
    .select({ chatMuted: communityMembers.chatMuted })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, id), eq(communityMembers.userId, viewerId)));

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
    .where(
      and(
        eq(communityMembers.communityId, id),
        notBlockedBetween(viewerId, communityMembers.userId),
      ),
    )
    .orderBy(asc(communityMembers.joinedAt))
    .limit(MEMBER_PREVIEW);

  const near = await originFor(db, viewerId);
  const [upcomingActivities, [counted]] = await Promise.all([
    findActivitySummaries(db, urls, {
      viewerId,
      near,
      where: [upcoming(), notCancelled(), eq(activities.communityId, id)],
      limit: UPCOMING_PREVIEW,
    }),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(activities)
      .where(and(upcoming(), notCancelled(), eq(activities.communityId, id))),
  ]);

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
    upcomingCount: counted?.n ?? upcomingActivities.length,
    isCreator: info?.createdBy === viewerId,
    chatMuted: mine?.chatMuted ?? false,
    place: await requirePlace(db, summary.placeId),
  };
}

/** Postgres "unique_violation": another community already has the name (any capitalisation). */
const nameTaken = (err: unknown) =>
  (err as { code?: string; cause?: { code?: string } }).code === '23505' ||
  (err as { cause?: { code?: string } }).cause?.code === '23505';
const takenError = () => conflict('There’s already a community with that name.');

/**
 * A community picture for what its creator chose: their upload, one of our
 * pictures they picked (`art:<id>`), or with neither, ours for it.
 */
async function pictureFrom(
  { urls, storage }: { urls: Urls; storage: Storage | null },
  userId: string,
  kind: 'cover' | 'logo',
  key: string | null | undefined,
  community: { id: string; name: string; about?: string },
) {
  const picked = artFromKey(key);
  const set = kind === 'cover' ? FALLBACK_ART.communityCover : FALLBACK_ART.communityLogo;
  if (picked) {
    if (!set.includes(picked)) throw badRequest('Pick one of the pictures shown');
    return urls.art.path(picked);
  }
  if (key) {
    await requireUpload(storage, key, kind, userId);
    return key;
  }
  return kind === 'cover' ? urls.art.communityCover(community) : urls.art.communityLogo(community);
}

/** Starts a community; the creator joins it straight away. */
export async function createCommunity(
  db: Db,
  { urls, storage }: { urls: Urls; storage: Storage | null },
  userId: string,
  input: CreateCommunityInput & { about: string; rules: string[] },
) {
  // Its id now, so its pictures (without photos) are always the same ones.
  const newId = randomUUID();
  const described = { id: newId, name: input.name, about: input.about };
  const coverUrl = await pictureFrom({ urls, storage }, userId, 'cover', input.coverKey, described);
  const logoUrl = await pictureFrom({ urls, storage }, userId, 'logo', input.logoKey, described);
  // Where it meets: the town picked, or else where its creator lives.
  const placeId =
    input.placeId !== undefined
      ? (await requirePlace(db, input.placeId)).id
      : (await homePlace(db, userId)).id;
  const id = await db
    .transaction(async (tx) => {
      const [row] = await tx
        .insert(communities)
        .values({
          id: newId,
          name: input.name,
          about: input.about,
          rules: input.rules,
          coverUrl,
          logoUrl,
          placeId,
          createdBy: userId,
        })
        .returning({ id: communities.id });
      await tx.insert(communityMembers).values({ communityId: row!.id, userId });
      return row!.id;
    })
    .catch((err: unknown) => {
      throw nameTaken(err) ? takenError() : err;
    });
  return getCommunity(db, urls, id, userId);
}

/** Only whoever started the community can change it. */
export async function updateCommunity(
  db: Db,
  { urls, storage }: { urls: Urls; storage: Storage | null },
  id: string,
  userId: string,
  input: UpdateCommunityInput,
) {
  const [row] = await db
    .select({
      createdBy: communities.createdBy,
      name: communities.name,
      about: communities.about,
      coverUrl: communities.coverUrl,
      logoUrl: communities.logoUrl,
    })
    .from(communities)
    .where(eq(communities.id, id));
  if (!row) throw notFound('Community');
  if (row.createdBy !== userId) throw forbidden('Only the person who started it can edit it');
  const described = { id, name: input.name ?? row.name, about: input.about ?? row.about };
  const deps = { urls, storage };
  const coverUrl =
    input.coverKey === undefined
      ? undefined
      : await pictureFrom(deps, userId, 'cover', input.coverKey, described);
  const logoUrl =
    input.logoKey === undefined
      ? undefined
      : await pictureFrom(deps, userId, 'logo', input.logoKey, described);

  if (input.placeId !== undefined) await requirePlace(db, input.placeId);

  const patch = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.about !== undefined && { about: input.about }),
    ...(input.rules !== undefined && { rules: input.rules }),
    ...(coverUrl !== undefined && { coverUrl }),
    ...(logoUrl !== undefined && { logoUrl }),
    ...(input.placeId !== undefined && { placeId: input.placeId }),
  };
  if (Object.keys(patch).length) {
    await db
      .update(communities)
      .set(patch)
      .where(eq(communities.id, id))
      .catch((err: unknown) => {
        throw nameTaken(err) ? takenError() : err;
      });
  }
  // Photos it no longer uses, for the caller to clean up.
  const replacedPhotos = [
    patch.coverUrl !== undefined && patch.coverUrl !== row.coverUrl ? row.coverUrl : null,
    patch.logoUrl !== undefined && patch.logoUrl !== row.logoUrl ? row.logoUrl : null,
  ].filter((u): u is string => !!u);
  return { community: await getCommunity(db, urls, id, userId), replacedPhotos };
}

/** Activities can be posted in a community by its members. */
export async function requireCommunityMember(db: Db, id: string, userId: string) {
  const [row] = await db
    .select({ userId: communityMembers.userId })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, id), eq(communityMembers.userId, userId)));
  if (!row) throw forbidden('Join the community to post in it');
}

async function requireCommunity(db: Db, id: string) {
  const [row] = await db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.id, id));
  if (!row) throw notFound('Community');
}

/** Join and leave are idempotent; both return the updated summary. */
export async function joinCommunity(db: Db, urls: Urls, id: string, userId: string) {
  await requireCommunity(db, id);
  const [removed] = await db
    .select({ userId: communityRemovals.userId })
    .from(communityRemovals)
    .where(and(eq(communityRemovals.communityId, id), eq(communityRemovals.userId, userId)));
  if (removed) throw forbidden('You were removed from this community');
  await db.insert(communityMembers).values({ communityId: id, userId }).onConflictDoNothing();
  const [summary] = await findCommunitySummaries(db, urls, userId, { id });
  return summary!;
}

export async function leaveCommunity(db: Db, urls: Urls, id: string, userId: string) {
  await requireCommunity(db, id);
  await db
    .delete(communityMembers)
    .where(and(eq(communityMembers.communityId, id), eq(communityMembers.userId, userId)));
  const [summary] = await findCommunitySummaries(db, urls, userId, { id });
  return summary!;
}

async function requireCreator(db: Db, id: string, userId: string) {
  const [row] = await db
    .select({ createdBy: communities.createdBy })
    .from(communities)
    .where(eq(communities.id, id));
  if (!row) throw notFound('Community');
  if (row.createdBy !== userId) throw forbidden('Only the person who started it can do that');
}

/** Everyone in the community (minus anyone blocked either way), creator first. */
/** Mutes or unmutes a community's chat notifications (members only). */
export async function muteCommunityChat(db: Db, id: string, userId: string, muted: boolean) {
  const [row] = await db
    .update(communityMembers)
    .set({ chatMuted: muted })
    .where(and(eq(communityMembers.communityId, id), eq(communityMembers.userId, userId)))
    .returning({ id: communityMembers.communityId });
  if (!row) throw notFound('Community');
}

export async function listCommunityMembers(db: Db, urls: Urls, id: string, viewerId: string) {
  await requireCommunity(db, id);
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      avatarKey: profiles.avatarKey,
      avatarUrl: profiles.avatarUrl,
      isCreator: sql<boolean>`${communities.createdBy} = ${user.id}`,
    })
    .from(communityMembers)
    .innerJoin(user, eq(user.id, communityMembers.userId))
    .innerJoin(communities, eq(communities.id, communityMembers.communityId))
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(
      and(
        eq(communityMembers.communityId, id),
        notBlockedBetween(viewerId, communityMembers.userId),
      ),
    )
    .orderBy(sql`${communities.createdBy} = ${user.id} desc`, asc(communityMembers.joinedAt))
    .limit(MEMBER_LIST_MAX);
  return rows.map((m) => ({
    id: m.id,
    name: m.name,
    avatarUrl: urls.avatar(m.avatarKey, m.avatarUrl),
    isCreator: m.isCreator,
  }));
}

/** The creator removes someone; they can't join again. Their activities stay. */
export async function removeCommunityMember(
  db: Db,
  id: string,
  creatorId: string,
  memberId: string,
) {
  await requireCreator(db, id, creatorId);
  if (memberId === creatorId)
    throw badRequest('You can’t remove yourself; delete the community instead');
  await db.transaction(async (tx) => {
    await tx
      .delete(communityMembers)
      .where(and(eq(communityMembers.communityId, id), eq(communityMembers.userId, memberId)));
    await tx
      .insert(communityRemovals)
      .values({ communityId: id, userId: memberId })
      .onConflictDoNothing();
  });
}

/** The creator deletes it. Its activities go on without a community. */
export async function deleteCommunity(db: Db, id: string, creatorId: string) {
  await requireCreator(db, id, creatorId);
  const chatPhotos = await communityChatPhotos(db, id);
  const [gone] = await db
    .delete(communities)
    .where(eq(communities.id, id))
    .returning({ coverUrl: communities.coverUrl, logoUrl: communities.logoUrl });
  // Its photos, chat ones included, for the caller to clean up.
  return [gone?.coverUrl, gone?.logoUrl, ...chatPhotos].filter((u): u is string => !!u);
}

/** Members to tell about a new activity: everyone but the host and anyone blocked either way. */
export async function communityAudience(db: Db, id: string, hostId: string) {
  const rows = await db
    .select({ userId: communityMembers.userId })
    .from(communityMembers)
    .where(
      and(
        eq(communityMembers.communityId, id),
        sql`${communityMembers.userId} <> ${hostId}`,
        notBlockedBetween(hostId, communityMembers.userId),
      ),
    );
  return rows.map((r) => r.userId);
}
