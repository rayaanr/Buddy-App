import { createAuth } from './auth/auth';
import { SessionCache } from './auth/sessions';
import { createDb } from './db/client';
import type { Env } from './env';
import type { Deps } from './http/context';
import { createCluster } from './lib/cluster';
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
  const { db, sql, close } = createDb(env.DATABASE_URL);
  const mailer = overrides.mailer ?? createMailer(env, logger);
  const cluster = createCluster(env.REDIS_URL, logger);
  const limiter = new RateLimiter(cluster);
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
    sessions: new SessionCache(cluster),
    cluster,
    mailer,
    storage,
    urls: createUrls(env),
    hub: new ChatHub(cluster),
    push,
    venues: overrides.venues ?? createVenueSearch(env, db, logger),
    limiter,
  };
  const closeAll = async () => {
    deps.hub.stop();
    await Promise.allSettled([close(), cluster.close()]);
  };
  return { deps, sql, close: closeAll };
}
