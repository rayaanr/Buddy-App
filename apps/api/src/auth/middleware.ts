import { createMiddleware } from 'hono/factory';

import type { AppEnv, Deps, SessionUser } from '../http/context';
import { unauthorized } from '../lib/errors';

/**
 * Resolves the session cookie (or Expo's forwarded cookie) to a user, if any.
 * Recently checked sessions come from the cache (see sessions.ts).
 */
export const loadSession = ({ auth, sessions }: Pick<Deps, 'auth' | 'sessions'>) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const token = sessions.tokenOf(c.req.raw.headers);
    const cached = token ? sessions.get(token) : undefined;
    if (cached) {
      c.set('user', cached);
    } else {
      const session = token ? await auth.api.getSession({ headers: c.req.raw.headers }) : null;
      const user = session
        ? { id: session.user.id, email: session.user.email, name: session.user.name }
        : null;
      if (token && session && user) sessions.set(token, user, session.session.expiresAt);
      c.set('user', user);
    }
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
