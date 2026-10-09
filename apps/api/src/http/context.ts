import type { Auth } from '../auth/auth';
import type { Db } from '../db/client';
import type { Env } from '../env';
import type { Mailer } from '../lib/mailer';
import type { Urls } from '../lib/urls';
import type { Logger } from '../logger';

/** Everything route modules need, created once at startup (or per test). */
export interface Deps {
  db: Db;
  env: Env;
  logger: Logger;
  auth: Auth;
  mailer: Mailer;
  urls: Urls;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/** Hono context variables set by middleware. */
export interface AppEnv {
  Variables: {
    user: SessionUser | null;
    requestId: string;
  };
}
