import { createReportInput } from '@buddy/shared';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { validate } from '../../lib/validate';
import { createReport, notifyModerators } from './service';

/** POST /v1/reports: report a person, a chat message or an activity. */
export function reportRoutes(deps: Deps) {
  const { db } = deps;
  return new Hono<AppEnv>()
    .use(requireUser)
    .post('/', validate('json', createReportInput), async (c) => {
      const report = await createReport(db, currentUser(c).id, c.req.valid('json'));
      void notifyModerators(deps, report);
      return c.json({ id: report.id }, 201);
    });
}
