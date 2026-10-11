import {
  type ActivityDetail,
  cancelActivityInput,
  createActivityInput,
  firstName,
  whenLong,
  feedQuery,
  muteInput,
  removeGuestInput,
  myActivitiesQuery,
  updateActivityInput,
} from '@buddy/shared';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { currentUser, requireUser } from '../../auth/middleware';
import { activities, activityMembers, communityMembers } from '../../db/schema';
import type { AppEnv, Deps } from '../../http/context';
import { notFound } from '../../lib/errors';
import { DAY, HOUR, limits, MINUTE } from '../../lib/rate-limit';
import { forgetPhotos } from '../../lib/photos';
import { idParam, validate } from '../../lib/validate';
import { toChatMessage } from '../chat/service';
import { communityAudience } from '../communities/service';
import { originFor } from '../profiles/service';
import { createAnnouncer } from './announce';
import { picksFor } from './picks';
import {
  filterCondition,
  findActivitySummaries,
  findActivitySummary,
  findMembers,
  findWaitlist,
  notCancelled,
  pointSql,
  upcoming,
} from './queries';
import {
  cancelActivity,
  createActivity,
  getActivityDetail,
  joinActivity,
  joinWaitlist,
  leaveActivity,
  leaveWaitlist,
  myActivities,
  removeGuest,
  updateActivity,
} from './service';

const HISTORY_LIMIT = 10;
const FROM_COMMUNITIES_LIMIT = 20;
/** Discover widens to these (km) while it has fewer than ENOUGH to show; 450 covers the island. */
const WIDER_KM = [50, 100, 200, 450];
const ENOUGH = 3;

export function activityRoutes(deps: Deps) {
  const { db, urls, hub, push, storage } = deps;
  const limit = limits(deps);
  const joins = limit({ name: 'joins', limit: 30, windowMs: 10 * MINUTE, by: 'user' });
  const hosting = limit({ name: 'hosting', limit: 30, windowMs: HOUR, by: 'user' });

  const announce = createAnnouncer(deps);
  const photoDeps = { ...deps, publicUrl: deps.env.R2_PUBLIC_URL };

  /**
   * A new activity in a community: its members hear about it. At most a few a
   * day per host and community, so one person can't flood everyone's phone.
   */
  const tellCommunity = async (a: ActivityDetail, host: { id: string; name: string }) => {
    const community = a.community!;
    if (!deps.limiter.hit(`community-post:${community.id}:${host.id}`, 3, DAY).ok) return;
    const audience = await communityAudience(db, community.id, host.id);
    void push.notifyUsers(audience, {
      title: community.name,
      body: `${firstName(host.name)} is hosting ${a.title}, ${whenLong(new Date(a.startsAt))}`,
      data: { activityId: a.id },
      channelId: 'communities',
    });
  };
  return (
    new Hono<AppEnv>()
      .use(requireUser)

      // Discover feed.
      .get('/', validate('query', feedQuery), async (c) => {
        const me = currentUser(c);
        const q = c.req.valid('query');
        const near = await originFor(db, me.id, q);
        if (q.q) {
          // Like-escaped, so "50%" or "a_b" mean themselves.
          const term = `%${q.q.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
          const items = await findActivitySummaries(db, urls, {
            viewerId: me.id,
            near,
            where: [
              upcoming(),
              notCancelled(),
              filterCondition(q.filter),
              sql`(lower(${activities.title}) like ${term}
                or lower(${activities.place}) like ${term}
                or lower(${activities.area}) like ${term}
                or lower(coalesce(${activities.interest}, '')) like ${term})`,
            ],
            orderBy: [
              sql`${activities.location} <-> ${pointSql(near)}`,
              sql`${activities.startsAt}`,
            ],
            limit: q.limit,
          });
          return c.json({ activities: items, radiusKm: q.radiusKm });
        }
        const within = (km: number) =>
          findActivitySummaries(db, urls, {
            viewerId: me.id,
            near,
            where: [
              upcoming(),
              notCancelled(),
              filterCondition(q.filter),
              sql`ST_DWithin(${activities.location}, ${pointSql(near)}, ${km * 1000})`,
            ],
            // Widened: nearest first, so the few close ones aren't crowded out
            // by sooner ones far away.
            ...(km > q.radiusKm && {
              orderBy: [
                sql`${activities.location} <-> ${pointSql(near)}`,
                sql`${activities.startsAt}`,
              ],
            }),
            limit: q.limit,
          });
        // Outside the cities there may be nothing close: widen until there's something.
        let radiusKm = q.radiusKm;
        let items = await within(radiusKm);
        for (const wider of WIDER_KM) {
          if (items.length >= ENOUGH || wider <= radiusKm) continue;
          radiusKm = wider;
          items = await within(wider);
        }
        return c.json({ activities: items, radiusKm });
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
          limit: FROM_COMMUNITIES_LIMIT,
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
            isNull(activities.cancelledAt),
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
        return c.json({
          members: await findMembers(db, urls, id, viewerId),
          waitlist: await findWaitlist(db, urls, id, viewerId),
        });
      })

      .post(
        '/',
        limit({ name: 'create', limit: 20, windowMs: HOUR, by: 'user' }),
        validate('json', createActivityInput),
        async (c) => {
          const me = currentUser(c);
          const detail = await createActivity(db, { urls, storage }, me, c.req.valid('json'));
          if (detail.community) void tellCommunity(detail, me);
          return c.json(detail, 201);
        },
      )

      .patch('/:id', hosting, idParam(), validate('json', updateActivityInput), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        const result = await updateActivity(db, { urls, storage }, me, id, c.req.valid('json'));
        await announce(id, me.id, result);
        await forgetPhotos(photoDeps, result.replacedPhotos ?? []);
        return c.json(await getActivityDetail(db, urls, id, me.id));
      })

      // No JSON body (older apps) validates as {}: cancel this week only.
      .post('/:id/cancel', hosting, idParam(), validate('json', cancelActivityInput), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        await announce(id, me.id, await cancelActivity(db, me, id, c.req.valid('json')));
        return c.json(await getActivityDetail(db, urls, id, me.id));
      })

      .post('/:id/membership', joins, idParam(), async (c) => {
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

      .delete('/:id/membership', joins, idParam(), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        const result = await leaveActivity(db, me, id);
        if (result.left) hub.disconnect(id, me.id);
        await announce(id, me.id, result);
        return c.json(await getActivityDetail(db, urls, id, me.id));
      })

      // Host removes a guest or someone waiting.
      .post(
        '/:id/members/:userId/remove',
        hosting,
        validate('param', z.object({ id: z.uuid(), userId: z.uuid() })),
        validate('json', removeGuestInput),
        async (c) => {
          const me = currentUser(c);
          const { id, userId } = c.req.valid('param');
          const result = await removeGuest(db, me, id, userId, c.req.valid('json').reason);
          if (result.wasGoing) hub.disconnect(id, userId);
          await announce(id, me.id, result);
          void push.notifyUsers([userId], {
            title: `You’re no longer going to ${result.title}`,
            body: 'The host removed you from this activity.',
            data: {},
            channelId: 'reminders',
          });
          return c.json(await getActivityDetail(db, urls, id, me.id));
        },
      )

      // Mute or unmute this activity's group chat notifications (members only).
      .post('/:id/mute', idParam(), validate('json', muteInput), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        const [row] = await db
          .update(activityMembers)
          .set({ chatMuted: c.req.valid('json').muted })
          .where(and(eq(activityMembers.activityId, id), eq(activityMembers.userId, me.id)))
          .returning({ id: activityMembers.activityId });
        if (!row) throw notFound('Activity');
        return c.json(await getActivityDetail(db, urls, id, me.id));
      })

      // Full activities: wait for a spot (joins straight away if one is free).
      .post('/:id/waitlist', joins, idParam(), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        const result = await joinWaitlist(db, me, id);
        await announce(id, me.id, {
          messages: result.message ? [result.message] : [],
          promoted: [],
        });
        return c.json(await getActivityDetail(db, urls, id, me.id));
      })

      .delete('/:id/waitlist', joins, idParam(), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        await leaveWaitlist(db, me.id, id);
        return c.json(await getActivityDetail(db, urls, id, me.id));
      })
  );
}
