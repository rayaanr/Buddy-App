import { ERROR_CODES } from '@buddy/shared';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

import { loadSession } from './auth/middleware';
import type { AppEnv, Deps } from './http/context';
import { HttpError } from './lib/errors';
import { clientIp } from './lib/rate-limit';
import { activityRoutes } from './modules/activities/routes';
import { chatRoutes } from './modules/chat/routes';
import { communityRoutes } from './modules/communities/routes';
import { legalRoutes } from './modules/legal/routes';
import { meRoutes } from './modules/me/routes';
import { placeRoutes, venueRoutes } from './modules/places/routes';
import { reportRoutes } from './modules/safety/routes';
import { shareRoutes } from './modules/share/routes';
import { uploadRoutes } from './modules/uploads/routes';
import { userRoutes } from './modules/users/routes';

/** Builds the HTTP app. Kept free of I/O setup so tests can pass their own deps. */
export function createApp(deps: Deps) {
  const { auth, db, env, logger } = deps;

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

  // Native apps don't need CORS; browsers (Expo web) do, with cookies.
  if (env.WEB_ORIGINS.length) {
    app.use(
      '*',
      cors({
        origin: env.WEB_ORIGINS,
        credentials: true,
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['content-type'],
      }),
    );
  }

  // nosniff, no framing, no referrer leaks; the share page adds its own CSP.
  app.use(secureHeaders());

  // Every request body is small JSON (the largest is a 2,000-character
  // message); photos go straight to R2. Refuse anything bigger before parsing.
  app.use(
    bodyLimit({
      maxSize: 64 * 1024,
      onError: (c) =>
        c.json(
          { error: { code: ERROR_CODES.validation, message: 'That request is too large' } },
          413,
        ),
    }),
  );

  app.notFound((c) =>
    c.json({ error: { code: ERROR_CODES.notFound, message: 'Route not found' } }, 404),
  );

  // Liveness plus a database round-trip, for uptime monitoring.
  app.get('/health', async (c) => {
    await db.execute(sql`select 1`);
    return c.json({ status: 'ok' });
  });

  // Public pages: shared links, privacy policy and terms.
  app.route('/', shareRoutes(deps));
  app.route('/', legalRoutes(deps));

  // Better Auth owns everything under /api/auth (send code, sign in, sign out, session).
  // Its rate limits key on X-Forwarded-For, which clients can forge. Replace
  // it with the address we trust (see clientIp) so limits can't be dodged.
  app.on(['GET', 'POST'], '/api/auth/*', (c) => {
    const headers = new Headers(c.req.raw.headers);
    headers.set('x-forwarded-for', clientIp(c, env.TRUSTED_PROXY_HOPS));
    return auth.handler(new Request(c.req.raw, { headers }));
  });

  const v1 = new Hono<AppEnv>()
    .use(loadSession(deps))
    .route('/me', meRoutes(deps))
    .route('/activities/:id/chat', chatRoutes(deps))
    .route('/activities', activityRoutes(deps))
    .route('/communities', communityRoutes(deps))
    .route('/users', userRoutes(deps))
    .route('/uploads', uploadRoutes(deps))
    .route('/places', placeRoutes(deps))
    .route('/venues', venueRoutes(deps))
    .route('/reports', reportRoutes(deps));

  return app.route('/v1', v1);
}

/** Route types for the app's typed client (`hono/client`). */
export type AppType = ReturnType<typeof createApp>;
