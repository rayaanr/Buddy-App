import {
  createActivityInput,
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
import { idParam, validate } from '../../lib/validate';
import { toChatMessage, type MessageRow } from '../chat/service';
import { originFor } from '../profiles/service';
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
/** Discover widens to these (km) while it has fewer than ENOUGH to show; 450 covers the island. */
const WIDER_KM = [50, 100, 200, 450];
const ENOUGH = 3;

export function activityRoutes(deps: Deps) {
  const { db, urls, hub, push } = deps;

  /**
   * After a change: posts its chat lines, tells everyone going about a host
   * change (`notice`, except `actorId`), tells people moved off the waitlist
   * they're in, and tells people still waiting about a cancellation.
   */
  const announce = async (
    id: string,
    actorId: string,
    result: {
      messages: MessageRow[];
      promoted: string[];
      notice?: { title: string; body: string } | null;
      waiting?: string[];
    },
  ) => {
    for (const row of result.messages) {
      hub.publish(id, { type: 'message', message: await toChatMessage(db, urls, row) });
    }
    if (result.notice) {
      const message = {
        ...result.notice,
        data: { activityId: id },
        channelId: 'reminders' as const,
      };
      void push.notifyActivity(id, message, [actorId, ...result.promoted]);
      if (result.waiting?.length) void push.notifyUsers(result.waiting, message);
    }
    if (result.promoted.length) {
      const [activity] = await db
        .select({ title: activities.title })
        .from(activities)
        .where(eq(activities.id, id));
      void push.notifyUsers(result.promoted, {
        title: `You’re in: ${activity?.title ?? 'your activity'}`,
        body: 'A spot opened up. Say hi in the group chat.',
        data: { activityId: id, screen: 'chat' },
        channelId: 'reminders',
      });
    }
  };
  return (
    new Hono<AppEnv>()
      .use(requireUser)

      // Discover feed.
      .get('/', validate('query', feedQuery), async (c) => {
        const me = currentUser(c);
        const q = c.req.valid('query');
        const near = await originFor(db, me.id, q);
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

      .post('/', validate('json', createActivityInput), async (c) => {
        const me = currentUser(c);
        return c.json(await createActivity(db, urls, me, c.req.valid('json')), 201);
      })

      .patch('/:id', idParam(), validate('json', updateActivityInput), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        await announce(id, me.id, await updateActivity(db, urls, me, id, c.req.valid('json')));
        return c.json(await getActivityDetail(db, urls, id, me.id));
      })

      .post('/:id/cancel', idParam(), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        await announce(id, me.id, await cancelActivity(db, me, id));
        return c.json(await getActivityDetail(db, urls, id, me.id));
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
        if (result.left) hub.disconnect(id, me.id);
        await announce(id, me.id, result);
        return c.json(await getActivityDetail(db, urls, id, me.id));
      })

      // Host removes a guest or someone waiting.
      .post(
        '/:id/members/:userId/remove',
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
      .post('/:id/waitlist', idParam(), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        const result = await joinWaitlist(db, me, id);
        await announce(id, me.id, {
          messages: result.message ? [result.message] : [],
          promoted: [],
        });
        return c.json(await getActivityDetail(db, urls, id, me.id));
      })

      .delete('/:id/waitlist', idParam(), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        await leaveWaitlist(db, me.id, id);
        return c.json(await getActivityDetail(db, urls, id, me.id));
      })
  );
}
