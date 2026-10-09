import { ERROR_CODES } from '@buddy/shared';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';

import { loadSession } from './auth/middleware';
import type { AppEnv, Deps } from './http/context';
import { HttpError } from './lib/errors';
import { activityRoutes } from './modules/activities/routes';
import { communityRoutes } from './modules/communities/routes';
import { meRoutes } from './modules/me/routes';
import { uploadRoutes } from './modules/uploads/routes';
import { userRoutes } from './modules/users/routes';

/** Builds the HTTP app. Kept free of I/O setup so tests can pass their own deps. */
export function createApp(deps: Deps) {
  const { auth, db, logger } = deps;

  const app = new Hono<AppEnv>().use(requestId()).use(async (c, next) => {
    const start = performance.now();
    await next();
    logger.info(
      {
        reqId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - start),
      },
      'request',
    );
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json(err.toBody(), err.status);
    logger.error({ err, reqId: c.get('requestId') }, 'Unhandled error');
    return c.json({ error: { code: ERROR_CODES.internal, message: 'Something went wrong' } }, 500);
  });

  app.notFound((c) =>
    c.json({ error: { code: ERROR_CODES.notFound, message: 'Route not found' } }, 404),
  );

  // Liveness plus a database round-trip, for uptime monitoring.
  app.get('/health', async (c) => {
    await db.execute(sql`select 1`);
    return c.json({ status: 'ok' });
  });

  // Better Auth owns everything under /api/auth (send code, sign in, sign out, session).
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

  const v1 = new Hono<AppEnv>()
    .use(loadSession(deps))
    .route('/me', meRoutes(deps))
    .route('/activities', activityRoutes(deps))
    .route('/communities', communityRoutes(deps))
    .route('/users', userRoutes(deps))
    .route('/uploads', uploadRoutes(deps));

  return app.route('/v1', v1);
}

/** Route types for the app's typed client (`hono/client`). */
export type AppType = ReturnType<typeof createApp>;
