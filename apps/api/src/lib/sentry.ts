import * as Sentry from '@sentry/bun';

import type { Env } from '../env';

/** Crash reports, only when SENTRY_DSN is set. Without it nothing is sent. */
export function startSentry(env: Env) {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Errors only, no performance tracing. Request bodies, cookies and IPs
    // aren't sent (sendDefaultPii is off by default).
    tracesSampleRate: 0,
  });
}

/** Reports an unexpected error (a no-op until startSentry has run with a DSN). */
export function reportError(err: unknown, requestId?: string) {
  Sentry.captureException(err, requestId ? { tags: { requestId } } : undefined);
}

/** Sends reports still queued (on shutdown), waiting at most two seconds. */
export const flushSentry = () => Sentry.close(2000);
