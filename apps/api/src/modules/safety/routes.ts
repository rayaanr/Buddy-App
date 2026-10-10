import { createReportInput } from '@buddy/shared';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { HOUR, limits } from '../../lib/rate-limit';
import { validate } from '../../lib/validate';
import { createReport, notifyModerators } from './service';

/** POST /v1/reports: report a person, a chat message or an activity. */
export function reportRoutes(deps: Deps) {
  const { db } = deps;
  return (
    new Hono<AppEnv>()
      .use(requireUser)
      // Each report emails the moderators (same mail account as sign-in codes).
      .post(
        '/',
        limits(deps)({ name: 'reports', limit: 10, windowMs: HOUR, by: 'user' }),
        validate('json', createReportInput),
        async (c) => {
          const { report, repeat } = await createReport(db, currentUser(c).id, c.req.valid('json'));
          if (!repeat) void notifyModerators(deps, report);
          // The app blocks whoever this turned out to be about (not what its link claimed).
          return c.json({ id: report.id, targetUserId: report.targetUserId }, 201);
        },
      )
  );
}
