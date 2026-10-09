import type { Auth } from '../auth/auth';
import type { Db } from '../db/client';
import type { Env } from '../env';
import type { Mailer } from '../lib/mailer';
import type { PushSender } from '../lib/push';
import type { Storage } from '../lib/storage';
import type { Urls } from '../lib/urls';
import type { Logger } from '../logger';
import type { ChatHub } from '../realtime/hub';

/** Everything route modules need, created once at startup (or per test). */
export interface Deps {
  db: Db;
  env: Env;
  logger: Logger;
  auth: Auth;
  mailer: Mailer;
  /** Null until R2 is configured; upload endpoints then answer 503. */
  storage: Storage | null;
  urls: Urls;
  hub: ChatHub;
  push: PushSender;
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
