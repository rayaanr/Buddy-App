import {
  peopleQuery,
  placeLabel,
  type Interest,
  type PersonResult,
  type PublicProfile,
} from '@buddy/shared';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import { activities, activityMembers, blocks, places, profiles, user } from '../../db/schema';
import type { AppEnv, Deps } from '../../http/context';
import { notFound } from '../../lib/errors';
import { idParam, validate } from '../../lib/validate';
import {
  countHosted,
  countWouldGoAgain,
  findActivitySummaries,
  notCancelled,
  upcoming,
} from '../activities/queries';
import { removeBlockedFromHosted } from '../activities/removal';
import { originFor } from '../profiles/service';
import { blockUser, unblockUser } from '../safety/service';

const HOSTING_PREVIEW = 10;

export function userRoutes(deps: Deps) {
  const { db, urls } = deps;
  return (
    new Hono<AppEnv>()
      .use(requireUser)
      // People you share a community or an activity with, by name. Strangers
      // aren't findable, and blocks either way hide people.
      .get('/search', validate('query', peopleQuery), async (c) => {
        const me = currentUser(c).id;
        const like = `%${c.req.valid('query').q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
        const rows = await db
          .select({ user, profile: profiles, place: places })
          .from(user)
          .innerJoin(profiles, eq(profiles.userId, user.id))
          .innerJoin(places, eq(places.id, profiles.placeId))
          .where(
            and(
              sql`${user.name} ilike ${like}`,
              sql`${user.id} <> ${me}`,
              sql`not exists (select 1 from ${blocks} b where (b.blocker_id = ${me} and b.blocked_id = ${user.id}) or (b.blocker_id = ${user.id} and b.blocked_id = ${me}))`,
              sql`(
              exists (select 1 from community_members a join community_members b on a.community_id = b.community_id
                      where a.user_id = ${me} and b.user_id = ${user.id})
              or exists (select 1 from activity_members a join activity_members b on a.activity_id = b.activity_id
                      where a.user_id = ${me} and b.user_id = ${user.id})
            )`,
            ),
          )
          .orderBy(
            sql`position(lower(${c.req.valid('query').q}) in lower(${user.name}))`,
            user.name,
          )
          .limit(20);
        const people: PersonResult[] = rows.map((r) => ({
          id: r.user.id,
          name: r.user.name,
          avatarUrl: urls.avatar(r.profile.avatarKey, r.profile.avatarUrl),
          area: placeLabel(r.place),
        }));
        return c.json({ people });
      })
      .get('/:id', idParam(), async (c) => {
        const viewer = currentUser(c);
        const id = c.req.param('id');

        const [row] = await db
          .select({
            user,
            profile: profiles,
            place: places,
            blockedByYou: sql<boolean>`exists (select 1 from ${blocks} b where b.blocker_id = ${viewer.id} and b.blocked_id = ${user.id})`,
            blockedYou: sql<boolean>`exists (select 1 from ${blocks} b where b.blocker_id = ${user.id} and b.blocked_id = ${viewer.id})`,
          })
          .from(user)
          .innerJoin(profiles, eq(profiles.userId, user.id))
          .innerJoin(places, eq(places.id, profiles.placeId))
          .where(eq(user.id, id));
        // Someone who blocked you looks the same as someone who doesn't exist.
        if (!row || row.blockedYou) throw notFound('Person');

        const [[mine], [joined], hosting, hostedCount, wouldGoAgain] = await Promise.all([
          db
            .select({ interests: profiles.interests })
            .from(profiles)
            .where(eq(profiles.userId, viewer.id)),
          db
            .select({ n: sql<number>`count(*)::int` })
            .from(activityMembers)
            .where(and(eq(activityMembers.userId, id), eq(activityMembers.role, 'guest'))),
          findActivitySummaries(db, urls, {
            viewerId: viewer.id,
            near: await originFor(db, viewer.id),
            where: [upcoming(), notCancelled(), eq(activities.hostId, id)],
            // Their next few; a profile isn't the place for a long schedule.
            limit: HOSTING_PREVIEW,
          }),
          countHosted(db, id),
          countWouldGoAgain(db, id),
        ]);

        const interests = row.profile.interests as Interest[];
        const viewerInterests = new Set(mine?.interests ?? []);
        const profile: PublicProfile = {
          id,
          name: row.user.name,
          area: placeLabel(row.place),
          bio: row.profile.bio,
          avatarUrl: urls.avatar(row.profile.avatarKey, row.profile.avatarUrl),
          interests,
          commonInterests: id === viewer.id ? [] : interests.filter((i) => viewerInterests.has(i)),
          memberSince: row.user.createdAt.toISOString(),
          hostedCount,
          wouldGoAgain,
          joinedCount: joined?.n ?? 0,
          hosting,
          blockedByYou: row.blockedByYou,
        };
        // Blocked by you: just enough to recognise them and unblock.
        if (row.blockedByYou) {
          return c.json({
            ...profile,
            area: '',
            bio: '',
            interests: [],
            commonInterests: [],
            hostedCount: 0,
            joinedCount: 0,
            hosting: [],
          } satisfies PublicProfile);
        }
        return c.json(profile);
      })

      .post('/:id/block', idParam(), async (c) => {
        const me = currentUser(c);
        await blockUser(db, me.id, c.req.param('id'));
        await removeBlockedFromHosted(deps, me, c.req.param('id'));
        return c.body(null, 204);
      })

      .delete('/:id/block', idParam(), async (c) => {
        await unblockUser(db, currentUser(c).id, c.req.param('id'));
        return c.body(null, 204);
      })
  );
}
