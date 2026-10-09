import { createActivityInput, feedQuery, myActivitiesQuery } from '@buddy/shared';
import { eq, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import { activities, communityMembers } from '../../db/schema';
import type { AppEnv, Deps } from '../../http/context';
import { validate } from '../../lib/validate';
import { toChatMessage } from '../chat/service';
import { originFor } from '../profiles/service';
import { picksFor } from './picks';
import { filterCondition, findActivitySummaries, pointSql, upcoming } from './queries';
import {
  createActivity,
  getActivityDetail,
  joinActivity,
  leaveActivity,
  myActivities,
} from './service';

const UUID = '{[0-9a-f-]{36}}';

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

      .get(`/:id${UUID}`, async (c) =>
        c.json(await getActivityDetail(db, urls, c.req.param('id'), currentUser(c).id)),
      )

      .post('/', validate('json', createActivityInput), async (c) => {
        const me = currentUser(c);
        return c.json(await createActivity(db, urls, me, c.req.valid('json')), 201);
      })

      .post(`/:id${UUID}/membership`, async (c) => {
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

      .delete(`/:id${UUID}/membership`, async (c) => {
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
