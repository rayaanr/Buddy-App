import { createAuth } from './auth/auth';
import { createDb } from './db/client';
import type { Env } from './env';
import type { Deps } from './http/context';
import { createMailer, type Mailer } from './lib/mailer';
import { createPushSender, type PushSender } from './lib/push';
import { createStorage, type Storage } from './lib/storage';
import { createUrls } from './lib/urls';
import { createLogger } from './logger';
import { ChatHub } from './realtime/hub';

/** Wires real dependencies from the environment. Tests override pieces (e.g. the mailer). */
export function createDeps(
  env: Env,
  overrides: { mailer?: Mailer; storage?: Storage | null; push?: PushSender } = {},
) {
  const logger = createLogger(env);
  const { db, close } = createDb(env.DATABASE_URL);
  const mailer = overrides.mailer ?? createMailer(env, logger);
  const auth = createAuth({ db, env, mailer, logger });
  const storage = overrides.storage !== undefined ? overrides.storage : createStorage(env);
  const push = overrides.push ?? createPushSender(db, logger, env.EXPO_ACCESS_TOKEN);
  const deps: Deps = {
    db,
    env,
    logger,
    auth,
    mailer,
    storage,
    urls: createUrls(env),
    hub: new ChatHub(),
    push,
  };
  return { deps, close };
}
