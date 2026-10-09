import type { Interest, PublicProfile } from '@buddy/shared';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import { activities, activityMembers, profiles, user } from '../../db/schema';
import type { AppEnv, Deps } from '../../http/context';
import { notFound } from '../../lib/errors';
import { countHosted, findActivitySummaries, upcoming } from '../activities/queries';
import { originFor } from '../profiles/service';

export function userRoutes({ db, urls }: Deps) {
  return new Hono<AppEnv>().use(requireUser).get('/:id{[0-9a-f-]{36}}', async (c) => {
    const viewer = currentUser(c);
    const id = c.req.param('id');

    const [row] = await db
      .select({ user, profile: profiles })
      .from(user)
      .innerJoin(profiles, eq(profiles.userId, user.id))
      .where(eq(user.id, id));
    if (!row) throw notFound('Person');

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
    };
    return c.json(profile);
  });
}
