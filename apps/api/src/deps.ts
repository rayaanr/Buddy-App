import { createAuth } from './auth/auth';
import { createDb } from './db/client';
import type { Env } from './env';
import type { Deps } from './http/context';
import { createMailer, type Mailer } from './lib/mailer';
import { withInbox } from './lib/inbox';
import { createPushSender, type PushSender } from './lib/push';
import { createStorage, type Storage } from './lib/storage';
import { RateLimiter } from './lib/rate-limit';
import { createUrls } from './lib/urls';
import { createVenueSearch, type VenueSearch } from './lib/venues';
import { createLogger } from './logger';
import { ChatHub } from './realtime/hub';

/** Wires real dependencies from the environment. Tests override pieces (e.g. the mailer). */
export function createDeps(
  env: Env,
  overrides: {
    mailer?: Mailer;
    storage?: Storage | null;
    push?: PushSender;
    venues?: VenueSearch;
  } = {},
) {
  const logger = createLogger(env);
  const { db, close } = createDb(env.DATABASE_URL);
  const mailer = overrides.mailer ?? createMailer(env, logger);
  const limiter = new RateLimiter();
  const auth = createAuth({ db, env, mailer, logger, limiter });
  const storage = overrides.storage !== undefined ? overrides.storage : createStorage(env);
  // Everything sent also lands in the in-app inbox (tests' fake senders too).
  const push = withInbox(
    db,
    logger,
    overrides.push ?? createPushSender(db, logger, env.EXPO_ACCESS_TOKEN),
  );
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
    venues: overrides.venues ?? createVenueSearch(env, db, logger),
    limiter,
  };
  return { deps, close };
}
