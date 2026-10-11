import { adminPeopleQuery, adminReportsQuery, resolveReportInput } from '@buddy/shared';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { badRequest, forbidden } from '../../lib/errors';
import { forgetPhotos } from '../../lib/photos';
import { idParam, validate } from '../../lib/validate';
import { createAnnouncer } from '../activities/announce';
import { roomOf } from '../chat/service';
import {
  findPeople,
  liftSuspension,
  listReports,
  removeActivity,
  removeCommunity,
  resolveReport,
  suspendPerson,
} from './service';
import { adminStats } from './stats';

/** Moderators act on reports and see how Buddy is doing, from the app (Settings → Admin). */
export function moderationRoutes(deps: Deps) {
  const { db, urls, env, hub, logger } = deps;
  const announce = createAnnouncer(deps);
  const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
    if (!env.ADMIN_EMAILS.includes(currentUser(c).email.toLowerCase())) {
      throw forbidden('Only Buddy’s moderators can do that');
    }
    await next();
  });

  /** After a removal or suspension: tell people, clean up photos, update open chats. */
  const followUp = async (moderatorId: string, done: Awaited<ReturnType<typeof resolveReport>>) => {
    await forgetPhotos({ ...deps, publicUrl: env.R2_PUBLIC_URL }, [
      ...done.removedPhotos,
      done.removedMessage?.imageKey,
    ]);
    for (const a of done.cancelled) await announce(a.id, moderatorId, a.result);
    if (done.removedMessage) {
      hub.publish(roomOf(done.removedMessage).id, {
        type: 'removed',
        messageId: done.removedMessage.id,
      });
    }
  };

  return new Hono<AppEnv>()
    .use(requireUser, requireAdmin)
    .get('/stats', async (c) => c.json(await adminStats(db)))
    .get('/reports', validate('query', adminReportsQuery), async (c) =>
      c.json({ reports: await listReports(db, urls, c.req.valid('query').status) }),
    )
    .post('/reports/:id/resolve', idParam(), validate('json', resolveReportInput), async (c) => {
      const me = currentUser(c);
      const id = c.req.param('id');
      const input = c.req.valid('json');
      await followUp(me.id, await resolveReport(db, id, me.id, input));
      logger.info({ reportId: id, moderatorId: me.id, ...input }, 'Report resolved');
      return c.json({ ok: true });
    })
    .get('/people', validate('query', adminPeopleQuery), async (c) =>
      c.json({ people: await findPeople(db, urls, c.req.valid('query').q) }),
    )
    .post('/people/:id/suspend', idParam(), async (c) => {
      const me = currentUser(c);
      const id = c.req.param('id');
      if (id === me.id) throw badRequest('You can’t suspend yourself');
      await followUp(me.id, await suspendPerson(db, me.id, id));
      logger.info({ userId: id, moderatorId: me.id }, 'Person suspended');
      return c.json({ ok: true });
    })
    .delete('/activities/:id', idParam(), async (c) => {
      const me = currentUser(c);
      await followUp(me.id, await removeActivity(db, me.id, c.req.param('id')));
      logger.info({ activityId: c.req.param('id'), moderatorId: me.id }, 'Activity removed');
      return c.json({ ok: true });
    })
    .delete('/communities/:id', idParam(), async (c) => {
      const me = currentUser(c);
      await followUp(me.id, await removeCommunity(db, me.id, c.req.param('id')));
      logger.info({ communityId: c.req.param('id'), moderatorId: me.id }, 'Community removed');
      return c.json({ ok: true });
    })
    .delete('/suspensions/:id', idParam(), async (c) => {
      await liftSuspension(db, c.req.param('id'));
      logger.info(
        { userId: c.req.param('id'), moderatorId: currentUser(c).id },
        'Suspension lifted',
      );
      return c.json({ ok: true });
    });
}
