import { ERROR_CODES } from '@buddy/shared';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';

import type { AppEnv, Deps } from '../http/context';
import type { Cluster, RateResult } from './cluster';
import { HttpError } from './errors';

/**
 * Counts requests per key in fixed windows. The counts live in the cluster
 * (see lib/cluster.ts), so with several API instances a limit is shared by
 * all of them rather than applied by each.
 */
export class RateLimiter {
  constructor(private cluster: Pick<Cluster, 'hit' | 'resetCounts'>) {}

  /** Whether this request is within the limit (and counts it). */
  hit(key: string, limit: number, windowMs: number): Promise<RateResult> {
    return this.cluster.hit(key, limit, windowMs);
  }

  /** Forget all counts (tests start each case fresh). */
  reset() {
    return this.cluster.resetCounts();
  }
}

/**
 * The caller's IP. Behind a reverse proxy (Caddy, nginx) every request comes
 * from the proxy, so with TRUSTED_PROXY_HOPS = n the address n hops from the
 * right of X-Forwarded-For is used (entries further left can be forged).
 * Without proxies the header is ignored: anyone can send it.
 */
export function clientIp(c: Context, trustedHops: number) {
  if (trustedHops > 0) {
    const chain = (c.req.header('x-forwarded-for') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // A shorter chain than expected: the leftmost entry is the best we have
    // (the socket would be the proxy, putting everyone in one bucket).
    const ip = chain[chain.length - trustedHops] ?? chain[0];
    if (ip) return ip;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown'; // No socket (e.g. tests calling app.request).
  }
}

interface LimitOptions {
  /** Separate counters per use, e.g. "chat". */
  name: string;
  limit: number;
  windowMs: number;
  /** Count per signed-in user (after requireUser) or per IP (public routes). */
  by: 'user' | 'ip';
}

/** 429s once a user (or IP) goes over `limit` requests per `windowMs`. */
function rateLimit(limiter: RateLimiter, trustedHops: number, opts: LimitOptions) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const who = opts.by === 'user' ? c.get('user')?.id : clientIp(c, trustedHops);
    const { ok, retryAfterS } = await limiter.hit(
      `${opts.name}:${who ?? 'anon'}`,
      opts.limit,
      opts.windowMs,
    );
    if (!ok) {
      c.header('retry-after', String(retryAfterS));
      throw new HttpError(
        429,
        ERROR_CODES.rateLimited,
        'Slow down a little. Try again in a minute.',
      );
    }
    await next();
  });
}

/** `rateLimit` bound to the app's limiter and proxy setting. */
export const limits =
  ({ limiter, env }: Pick<Deps, 'limiter' | 'env'>) =>
  (opts: LimitOptions) =>
    rateLimit(limiter, env.TRUSTED_PROXY_HOPS, opts);

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
