import type { ActivitySummary, ServerEvent } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { connect } from 'node:net';
import { describe, expect, it } from 'vitest';

import { createDb } from '../src/db/client';
import { whileLeader } from '../src/lib/leader';
import { TEST_DATABASE_URL } from './global-setup';
import { useTestApp } from './harness';

/**
 * Two API instances sharing Redis, as behind the production load balancer.
 * Needs Redis: `docker compose up -d redis` locally; CI provides it.
 */
const REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:7479/1';

const reachable = await new Promise<boolean>((resolve) => {
  const { hostname, port } = new URL(REDIS_URL);
  const socket = connect({ host: hostname, port: Number(port) || 6379 });
  socket.setTimeout(500);
  socket.once('connect', () => (socket.end(), resolve(true)));
  socket.once('timeout', () => (socket.destroy(), resolve(false)));
  socket.once('error', () => resolve(false));
});
if (!reachable && process.env.CI) throw new Error(`CI needs Redis at ${REDIS_URL}`);

const t = useTestApp({ env: { REDIS_URL } });
const b = t.startInstance();

/** Retries until `check` passes (cluster messages take a moment). */
async function eventually(check: () => Promise<void> | void, ms = 2000) {
  const start = Date.now();
  for (;;) {
    try {
      return await check();
    } catch (err) {
      if (Date.now() - start > ms) throw err;
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}

async function padelId(headers: Record<string, string>) {
  const res = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', { headers });
  return res.body.activities.find((a) => a.title.startsWith('Padel'))!.id;
}

describe.skipIf(!reachable)('several API instances', () => {
  it('delivers a message sent through one instance to a phone on another', async () => {
    const server = await b.listen();
    try {
      const kavindu = await t.signIn();
      const shehani = await t.signIn('shehani@buddy.test');
      const id = await padelId(kavindu.headers);
      const phone = server.connect(`/v1/activities/${id}/chat/ws`, shehani.headers);
      await phone.opened;

      const sent = await t.call(`/v1/activities/${id}/chat/messages`, {
        method: 'POST',
        headers: kavindu.headers,
        body: { id: randomUUID(), body: 'Hello from the other server' },
      });
      expect(sent.status).toBe(201);
      await eventually(() => {
        const events = phone.events as ServerEvent[];
        expect(events.some((e) => e.type === 'message' && e.message.body.includes('other'))).toBe(
          true,
        );
      });
      // And the first instance knows she has the chat open (so no push for her).
      expect(await t.deps.hub.connectedUsers(id)).toContain(shehani.userId);
    } finally {
      await server.close();
    }
  });

  it('signs someone out on every instance at once', async () => {
    const kavindu = await t.signIn();
    // Instance b checks the session and remembers it.
    expect((await b.app.request('/v1/me', { headers: kavindu.headers })).status).toBe(200);
    const out = await t.app.request('/api/auth/sign-out', {
      method: 'POST',
      headers: kavindu.headers,
    });
    expect(out.status).toBe(200);
    await eventually(async () => {
      expect((await b.app.request('/v1/me', { headers: kavindu.headers })).status).toBe(401);
    });
  });

  it('shares rate limits', async () => {
    const key = `test:${randomUUID()}`;
    expect((await t.deps.limiter.hit(key, 2, 60_000)).ok).toBe(true);
    expect((await b.deps.limiter.hit(key, 2, 60_000)).ok).toBe(true);
    const third = await t.deps.limiter.hit(key, 2, 60_000);
    expect(third.ok).toBe(false);
    expect(third.retryAfterS).toBeGreaterThan(0);
  });
});

describe('background jobs', () => {
  it('run on one instance, and move to another when it stops', async () => {
    const one = createDb(TEST_DATABASE_URL, { max: 2 });
    const two = createDb(TEST_DATABASE_URL, { max: 2 });
    const running: string[] = [];
    const jobs = (name: string) => () => {
      running.push(name);
      return () => running.splice(running.indexOf(name), 1);
    };
    try {
      const stopOne = whileLeader(one.sql, t.deps.logger, jobs('one'), { retryMs: 50 });
      await eventually(() => expect(running).toEqual(['one']));
      const stopTwo = whileLeader(two.sql, t.deps.logger, jobs('two'), { retryMs: 50 });
      await new Promise((r) => setTimeout(r, 200));
      expect(running).toEqual(['one']);

      await stopOne();
      await eventually(() => expect(running).toEqual(['two']));
      await stopTwo();
      expect(running).toEqual([]);
    } finally {
      await Promise.all([one.close(), two.close()]);
    }
  });
});
