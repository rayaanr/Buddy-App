import { adminReportsQuery, resolveReportInput } from '@buddy/shared';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { forbidden } from '../../lib/errors';
import { idParam, validate } from '../../lib/validate';
import { createAnnouncer } from '../activities/announce';
import { liftSuspension, listReports, resolveReport } from './service';

/** Moderators act on reports from the app (Settings → Moderation). */
export function moderationRoutes(deps: Deps) {
  const { db, urls, env, hub, logger } = deps;
  const announce = createAnnouncer(deps);
  const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
    if (!env.ADMIN_EMAILS.includes(currentUser(c).email.toLowerCase())) {
      throw forbidden('Only Buddy’s moderators can do that');
    }
    await next();
  });

  return new Hono<AppEnv>()
    .use(requireUser, requireAdmin)
    .get('/reports', validate('query', adminReportsQuery), async (c) =>
      c.json({ reports: await listReports(db, urls, c.req.valid('query').status) }),
    )
    .post('/reports/:id/resolve', idParam(), validate('json', resolveReportInput), async (c) => {
      const me = currentUser(c);
      const id = c.req.param('id');
      const input = c.req.valid('json');
      const { cancelled, removedMessage } = await resolveReport(db, id, me.id, input);
      for (const a of cancelled) await announce(a.id, me.id, a.result);
      if (removedMessage) {
        hub.publish(removedMessage.activityId, { type: 'removed', messageId: removedMessage.id });
      }
      logger.info({ reportId: id, moderatorId: me.id, ...input }, 'Report resolved');
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
