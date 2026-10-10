import pino from 'pino';

import type { Env } from './env';

export type Logger = pino.Logger;

/**
 * JSON logs in production; one line per entry is easy to ship and search.
 * LOG_PRETTY=true prints readable, coloured lines for local development.
 */
export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'LOG_PRETTY' | 'NODE_ENV'>): Logger {
  return pino({
    level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    base: undefined,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    transport: env.LOG_PRETTY
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
  });
}
