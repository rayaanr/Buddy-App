import { feedQuery, type ActivityDetail } from '@buddy/shared';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import { activities } from '../../db/schema';
import type { AppEnv, Deps } from '../../http/context';
import { notFound } from '../../lib/errors';
import { validate } from '../../lib/validate';
import { originFor } from '../profiles/service';
import {
  countHosted,
  filterCondition,
  findActivitySummaries,
  findAttendees,
  pointSql,
  upcoming,
} from './queries';

export function activityRoutes({ db, urls }: Deps) {
  return new Hono<AppEnv>()
    .use(requireUser)

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

    .get('/:id{[0-9a-f-]{36}}', async (c) => {
      const me = currentUser(c);
      const id = c.req.param('id');
      const near = await originFor(db, me.id);
      const [summary] = await findActivitySummaries(db, urls, {
        viewerId: me.id,
        near,
        where: [eq(activities.id, id)],
      });
      if (!summary) throw notFound('Activity');

      const [extra] = await db
        .select({ description: activities.description })
        .from(activities)
        .where(eq(activities.id, id));
      const detail: ActivityDetail = {
        ...summary,
        description: extra?.description ?? '',
        attendees: await findAttendees(db, urls, id),
        host: { ...summary.host, hostedCount: await countHosted(db, summary.host.id) },
      };
      return c.json(detail);
    });
}
