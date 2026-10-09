import type { Interest, PublicProfile } from '@buddy/shared';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import { activities, activityMembers, blocks, profiles, user } from '../../db/schema';
import type { AppEnv, Deps } from '../../http/context';
import { notFound } from '../../lib/errors';
import { idParam } from '../../lib/validate';
import { countHosted, findActivitySummaries, upcoming } from '../activities/queries';
import { originFor } from '../profiles/service';
import { blockUser, unblockUser } from '../safety/service';

export function userRoutes({ db, urls }: Deps) {
  return new Hono<AppEnv>()
    .use(requireUser)
    .get('/:id', idParam(), async (c) => {
      const viewer = currentUser(c);
      const id = c.req.param('id');

      const [row] = await db
        .select({
          user,
          profile: profiles,
          blockedByYou: sql<boolean>`exists (select 1 from ${blocks} b where b.blocker_id = ${viewer.id} and b.blocked_id = ${user.id})`,
          blockedYou: sql<boolean>`exists (select 1 from ${blocks} b where b.blocker_id = ${user.id} and b.blocked_id = ${viewer.id})`,
        })
        .from(user)
        .innerJoin(profiles, eq(profiles.userId, user.id))
        .where(eq(user.id, id));
      // Someone who blocked you looks the same as someone who doesn't exist.
      if (!row || row.blockedYou) throw notFound('Person');

      const [[mine], [joined], hosting, hostedCount] = await Promise.all([
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
          where: [upcoming(), eq(activities.hostId, id)],
        }),
        countHosted(db, id),
      ]);

      const interests = row.profile.interests as Interest[];
      const viewerInterests = new Set(mine?.interests ?? []);
      const profile: PublicProfile = {
        id,
        name: row.user.name,
        area: row.profile.area,
        bio: row.profile.bio,
        avatarUrl: urls.avatar(row.profile.avatarKey, row.profile.avatarUrl),
        interests,
        commonInterests: id === viewer.id ? [] : interests.filter((i) => viewerInterests.has(i)),
        memberSince: row.user.createdAt.toISOString(),
        hostedCount,
        joinedCount: joined?.n ?? 0,
        hosting,
        blockedByYou: row.blockedByYou,
      };
      return c.json(profile);
    })

    .post('/:id/block', idParam(), async (c) => {
      await blockUser(db, currentUser(c).id, c.req.param('id'));
      return c.body(null, 204);
    })

    .delete('/:id/block', idParam(), async (c) => {
      await unblockUser(db, currentUser(c).id, c.req.param('id'));
      return c.body(null, 204);
    });
}
