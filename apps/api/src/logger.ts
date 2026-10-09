import pino from 'pino';

import type { Env } from './env';

export type Logger = pino.Logger;

/** JSON logs in production; one line per entry is easy to ship and search. */
export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  return pino({
    level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    base: undefined,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  });
}
