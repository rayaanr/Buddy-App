import type { ReservedSql, Sql } from 'postgres';

import type { Logger } from '../logger';

/** Any fixed number; the instances agree on it. */
const JOBS_LOCK = 4_242_001;
const RETRY_MS = 30_000;

/**
 * Runs `start` on one API instance only: whichever holds a Postgres advisory
 * lock. Reminders, weekly repeats and clean-ups must not run twice when
 * several instances are up. The lock lives on a connection of its own, so if
 * that instance dies, Postgres releases it and another takes over within
 * RETRY_MS. Returns a function that stops the jobs and releases the lock.
 */
export function whileLeader(
  sql: Sql,
  logger: Logger,
  start: () => () => void,
  { retryMs = RETRY_MS } = {},
) {
  let conn: ReservedSql | null = null;
  let stopJobs: (() => void) | null = null;
  let stopped = false;

  const lose = (err?: unknown) => {
    stopJobs?.();
    stopJobs = null;
    conn?.release();
    conn = null;
    if (err) logger.warn({ err }, 'Lost the background jobs lock; will try again');
  };

  const tick = async () => {
    if (stopped) return;
    if (conn) {
      // Still connected means still holding the lock.
      await conn`select 1`.catch(lose);
      return;
    }
    let candidate: ReservedSql | null = null;
    try {
      candidate = await sql.reserve();
      const [row] = await candidate<
        { ok: boolean }[]
      >`select pg_try_advisory_lock(${JOBS_LOCK}) as ok`;
      if (!row?.ok || stopped) {
        candidate.release();
        return;
      }
      conn = candidate;
      stopJobs = start();
      logger.info('Running background jobs on this instance');
    } catch (err) {
      candidate?.release();
      logger.error({ err }, 'Could not check the background jobs lock');
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), retryMs);
  timer.unref();

  return async () => {
    stopped = true;
    clearInterval(timer);
    stopJobs?.();
    stopJobs = null;
    if (conn) {
      await conn`select pg_advisory_unlock(${JOBS_LOCK})`.catch(() => {});
      conn.release();
      conn = null;
    }
  };
}
