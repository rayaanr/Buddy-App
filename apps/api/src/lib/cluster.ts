import { Redis } from 'ioredis';

import type { Logger } from '../logger';

/**
 * What the API instances share, so more than one can run behind a load
 * balancer: messages to every instance (chat events, sign-outs), rate-limit
 * counters, and who has which chat open.
 *
 * With REDIS_URL it's Redis (Valkey in production); without, it's this
 * process's memory, which is right for development, tests and a single
 * instance.
 */
export interface Cluster {
  /** Sends to every instance, this one included. */
  broadcast(channel: string, message: unknown): void;
  /** Handles what any instance broadcast on this channel. */
  on(channel: string, handler: (message: unknown) => void): void;
  /** Counts a request against `limit` per `windowMs`, across all instances. */
  hit(key: string, limit: number, windowMs: number): Promise<RateResult>;
  /** Forget all counts (tests start each case fresh). */
  resetCounts(): Promise<void>;
  /**
   * Who has a chat open on other instances. Each instance reports its own
   * connections every PRESENCE_EVERY_MS; reports lapse after PRESENCE_TTL_MS,
   * so an instance that died stops counting.
   */
  presence: {
    report(pairs: { room: string; userId: string }[]): Promise<void>;
    left(room: string, userId: string): Promise<void>;
    list(room: string): Promise<string[]>;
  };
  close(): Promise<void>;
}

export interface RateResult {
  ok: boolean;
  retryAfterS: number;
}

export const PRESENCE_EVERY_MS = 20_000;
const PRESENCE_TTL_MS = 60_000;

export function createCluster(redisUrl: string | undefined, logger: Logger): Cluster {
  return redisUrl ? redisCluster(redisUrl, logger) : memoryCluster();
}

/** One instance: everything in this process. */
function memoryCluster(): Cluster {
  const handlers = new Map<string, ((message: unknown) => void)[]>();
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    broadcast(channel, message) {
      for (const handler of handlers.get(channel) ?? []) handler(message);
    },
    on(channel, handler) {
      handlers.set(channel, [...(handlers.get(channel) ?? []), handler]);
    },
    async hit(key, limit, windowMs) {
      const now = Date.now();
      if (windows.size > 50_000) {
        for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      }
      const w = windows.get(key);
      if (!w || w.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, retryAfterS: 0 };
      }
      w.count++;
      return { ok: w.count <= limit, retryAfterS: Math.ceil((w.resetAt - now) / 1000) };
    },
    async resetCounts() {
      windows.clear();
    },
    // Only this instance, and the chat hub knows its own connections.
    presence: { report: async () => {}, left: async () => {}, list: async () => [] },
    async close() {},
  };
}

const PREFIX = 'buddy:';

/** Several instances, sharing through Redis. */
function redisCluster(url: string, logger: Logger): Cluster {
  // Commands and subscriptions need separate connections.
  const redis = new Redis(url, { maxRetriesPerRequest: 2 });
  const subscriber = new Redis(url);
  for (const [name, client] of [
    ['redis', redis],
    ['redis subscriber', subscriber],
  ] as const) {
    client.on('error', (err) => logger.error({ err }, `${name} error`));
  }

  // Counts a hit and reports the count and how long the window has left, in one round trip.
  redis.defineCommand('hitWindow', {
    numberOfKeys: 1,
    lua: `local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {n, redis.call('PTTL', KEYS[1])}`,
  });
  const hitWindow = (key: string, windowMs: number) =>
    (redis as unknown as { hitWindow(k: string, ms: number): Promise<[number, number]> }).hitWindow(
      key,
      windowMs,
    );

  const handlers = new Map<string, ((message: unknown) => void)[]>();
  subscriber.on('message', (channel: string, raw: string) => {
    let message: unknown;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    for (const handler of handlers.get(channel.slice(PREFIX.length)) ?? []) {
      try {
        handler(message);
      } catch (err) {
        logger.error({ err, channel }, 'Cluster message handler failed');
      }
    }
  });

  const presenceKey = (room: string) => `${PREFIX}presence:${room}`;

  return {
    broadcast(channel, message) {
      redis.publish(PREFIX + channel, JSON.stringify(message)).catch((err: unknown) => {
        logger.error({ err, channel }, 'Could not broadcast to other instances');
      });
    },
    on(channel, handler) {
      if (!handlers.has(channel)) void subscriber.subscribe(PREFIX + channel);
      handlers.set(channel, [...(handlers.get(channel) ?? []), handler]);
    },
    async hit(key, limit, windowMs) {
      try {
        const [n, ttl] = await hitWindow(`${PREFIX}rate:${key}`, windowMs);
        return { ok: n <= limit, retryAfterS: n <= limit ? 0 : Math.ceil(Math.max(ttl, 0) / 1000) };
      } catch (err) {
        // Redis down: let the request through rather than take the app down with it.
        logger.error({ err }, 'Rate limit check failed; allowing');
        return { ok: true, retryAfterS: 0 };
      }
    },
    async resetCounts() {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', `${PREFIX}rate:*`, 'COUNT', 500);
        if (keys.length) await redis.del(...keys);
        cursor = next;
      } while (cursor !== '0');
    },
    presence: {
      async report(pairs) {
        if (!pairs.length) return;
        const until = Date.now() + PRESENCE_TTL_MS;
        const batch = redis.multi();
        for (const { room, userId } of pairs) {
          batch.zadd(presenceKey(room), until, userId);
          batch.pexpire(presenceKey(room), PRESENCE_TTL_MS);
        }
        await batch.exec();
      },
      async left(room, userId) {
        // If they're also connected through another instance, its next
        // report puts them back.
        await redis.zrem(presenceKey(room), userId);
      },
      async list(room) {
        try {
          return await redis.zrangebyscore(presenceKey(room), Date.now(), '+inf');
        } catch (err) {
          logger.error({ err }, 'Could not read chat presence');
          return [];
        }
      },
    },
    async close() {
      await Promise.allSettled([redis.quit(), subscriber.quit()]);
    },
  };
}
