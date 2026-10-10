import { ERROR_CODES } from '@buddy/shared';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';

import type { AppEnv, Deps } from '../http/context';
import { HttpError } from './errors';

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Counts requests per key in fixed windows, in memory. Fine for one API
 * server (the VPS); with several, each counts on its own, so the effective
 * limit is per instance.
 */
export class RateLimiter {
  private windows = new Map<string, Window>();

  /** True if this request is within the limit (and counts it). */
  hit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    if (this.windows.size > 50_000) this.sweep(now);
    const w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, retryAfterS: 0 };
    }
    w.count++;
    return { ok: w.count <= limit, retryAfterS: Math.ceil((w.resetAt - now) / 1000) };
  }

  /** Forget all counts (tests start each case fresh). */
  reset() {
    this.windows.clear();
  }

  private sweep(now: number) {
    for (const [key, w] of this.windows) if (w.resetAt <= now) this.windows.delete(key);
  }
}

/**
 * The caller's IP. Behind a reverse proxy (Caddy, nginx) every request comes
 * from the proxy, so with TRUSTED_PROXY_HOPS = n the address n hops from the
 * right of X-Forwarded-For is used (entries further left can be forged).
 */
export function clientIp(c: Context, trustedHops: number) {
  if (trustedHops > 0) {
    const chain = (c.req.header('x-forwarded-for') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const ip = chain[chain.length - trustedHops];
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
export function rateLimit(limiter: RateLimiter, trustedHops: number, opts: LimitOptions) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const who = opts.by === 'user' ? c.get('user')?.id : clientIp(c, trustedHops);
    const { ok, retryAfterS } = limiter.hit(
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
