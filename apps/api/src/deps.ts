import { createAuth } from './auth/auth';
import { createDb } from './db/client';
import type { Env } from './env';
import type { Deps } from './http/context';
import { createMailer, type Mailer } from './lib/mailer';
import { createUrls } from './lib/urls';
import { createLogger } from './logger';

/** Wires real dependencies from the environment. Tests override pieces (e.g. the mailer). */
export function createDeps(env: Env, overrides: { mailer?: Mailer } = {}) {
  const logger = createLogger(env);
  const { db, close } = createDb(env.DATABASE_URL);
  const mailer = overrides.mailer ?? createMailer(env, logger);
  const auth = createAuth({ db, env, mailer, logger });
  const deps: Deps = { db, env, logger, auth, mailer, urls: createUrls(env) };
  return { deps, close };
}
