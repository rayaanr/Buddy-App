import { createMiddleware } from 'hono/factory';

import type { AppEnv, Deps, SessionUser } from '../http/context';
import { unauthorized } from '../lib/errors';

/** Resolves the session cookie (or Expo's forwarded cookie) to a user, if any. */
export const loadSession = ({ auth }: Pick<Deps, 'auth'>) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    c.set(
      'user',
      session ? { id: session.user.id, email: session.user.email, name: session.user.name } : null,
    );
    await next();
  });

/** Rejects the request with 401 unless someone is signed in. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user')) throw unauthorized();
  await next();
});

/** The signed-in user; only call after `requireUser`. */
export function currentUser(c: { get: (key: 'user') => SessionUser | null }): SessionUser {
  const user = c.get('user');
  if (!user) throw unauthorized();
  return user;
}
