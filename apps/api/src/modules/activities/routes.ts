import { createActivityInput, feedQuery, myActivitiesQuery } from '@buddy/shared';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import { activities, activityMembers, communityMembers } from '../../db/schema';
import type { AppEnv, Deps } from '../../http/context';
import { notFound } from '../../lib/errors';
import { idParam, validate } from '../../lib/validate';
import { toChatMessage } from '../chat/service';
import { originFor } from '../profiles/service';
import { picksFor } from './picks';
import {
  filterCondition,
  findActivitySummaries,
  findActivitySummary,
  findMembers,
  pointSql,
  upcoming,
} from './queries';
import {
  createActivity,
  getActivityDetail,
  joinActivity,
  leaveActivity,
  myActivities,
} from './service';

const HISTORY_LIMIT = 10;

export function activityRoutes(deps: Deps) {
  const { db, urls, hub } = deps;
  return (
    new Hono<AppEnv>()
      .use(requireUser)

      // Discover feed.
      .get('/', validate('query', feedQuery), async (c) => {
        const me = currentUser(c);
        const q = c.req.valid('query');
        const near = await originFor(db, me.id, q);
        const items = await findActivitySummaries(db, urls, {
          viewerId: me.id,
          near,
          where: [
            upcoming(),
            filterCondition(q.filter),
            sql`ST_DWithin(${activities.location}, ${pointSql(near)}, ${q.radiusKm * 1000})`,
          ],
          limit: q.limit,
        });
        return c.json({ activities: items });
      })

      // "From your communities": upcoming activities in communities you joined, not yet joined.
      .get('/from-communities', async (c) => {
        const me = currentUser(c);
        const items = await findActivitySummaries(db, urls, {
          viewerId: me.id,
          near: await originFor(db, me.id),
          where: [
            upcoming(),
            inArray(
              activities.communityId,
              db
                .select({ id: communityMembers.communityId })
                .from(communityMembers)
                .where(eq(communityMembers.userId, me.id)),
            ),
            sql`not exists (select 1 from activity_members m where m.activity_id = ${activities.id} and m.user_id = ${me.id})`,
          ],
        });
        return c.json({ activities: items });
      })

      .get('/picks', async (c) => c.json({ picks: await picksFor(db, urls, currentUser(c).id) }))

      .get('/mine', validate('query', myActivitiesQuery), async (c) => {
        const me = currentUser(c);
        const { role } = c.req.valid('query');
        return c.json({ activities: await myActivities(db, urls, me.id, role) });
      })

      // Past activities you joined or hosted, newest first (Profile → Recent).
      .get('/history', async (c) => {
        const me = currentUser(c);
        const items = await findActivitySummaries(db, urls, {
          viewerId: me.id,
          where: [
            sql`${activities.startsAt} < now() - interval '1 hour'`,
            inArray(
              activities.id,
              db
                .select({ id: activityMembers.activityId })
                .from(activityMembers)
                .where(eq(activityMembers.userId, me.id)),
            ),
          ],
          orderBy: [desc(activities.startsAt)],
          limit: HISTORY_LIMIT,
        });
        return c.json({ activities: items });
      })

      .get('/:id', idParam(), async (c) =>
        c.json(await getActivityDetail(db, urls, c.req.param('id'), currentUser(c).id)),
      )

      // Everyone going (the "6 of 8 going" card). Hidden wherever the activity is.
      .get('/:id/members', idParam(), async (c) => {
        const viewerId = currentUser(c).id;
        const id = c.req.param('id');
        if (!(await findActivitySummary(db, urls, id, viewerId))) throw notFound('Activity');
        return c.json({ members: await findMembers(db, urls, id, viewerId) });
      })

      .post('/', validate('json', createActivityInput), async (c) => {
        const me = currentUser(c);
        return c.json(await createActivity(db, urls, me, c.req.valid('json')), 201);
      })

      .post('/:id/membership', idParam(), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        const result = await joinActivity(db, me, id);
        if (result.message) {
          hub.publish(id, {
            type: 'message',
            message: await toChatMessage(db, urls, result.message),
          });
        }
        return c.json(await getActivityDetail(db, urls, id, me.id));
      })

      .delete('/:id/membership', idParam(), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        const result = await leaveActivity(db, me, id);
        if (result.message) {
          hub.disconnect(id, me.id);
          hub.publish(id, {
            type: 'message',
            message: await toChatMessage(db, urls, result.message),
          });
        }
        return c.json(await getActivityDetail(db, urls, id, me.id));
      })
  );
}
