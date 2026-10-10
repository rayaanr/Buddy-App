import { serve } from '@hono/node-server';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeEach } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';

import { createApp } from '../src/app';
import { createDeps } from '../src/deps';
import { loadEnv } from '../src/env';
import type { Mail, Mailer } from '../src/lib/mailer';
import type { PushSender } from '../src/lib/push';
import type { VenueSearch } from '../src/lib/venues';
import type { Storage } from '../src/lib/storage';
import { seed } from '../scripts/seed/index';
import { TEST_DATABASE_URL } from './global-setup';

/** Captures outgoing email so tests can read sign-in codes. */
export function captureMailer() {
  const sent: Mail[] = [];
  const mailer: Mailer = {
    async send(mail) {
      sent.push(mail);
    },
  };
  const codeFor = (email: string) => {
    const mail = [...sent].reverse().find((m) => m.to === email);
    const code = mail?.subject.match(/^(\d+)/)?.[1];
    if (!code) throw new Error(`No sign-in code was emailed to ${email}`);
    return code;
  };
  return { mailer, sent, codeFor };
}

/**
 * Builds the real app against the test database, re-seeded before each test.
 * `signIn` goes through the actual email-code flow and returns request headers.
 */
export function useTestApp(
  options: {
    env?: Record<string, string>;
    storage?: Storage | null;
    push?: PushSender;
    venues?: VenueSearch;
  } = {},
) {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    BETTER_AUTH_URL: 'http://localhost:7400',
    BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
    ...options.env,
  });
  const mail = captureMailer();
  const { deps, close } = createDeps(env, {
    mailer: mail.mailer,
    storage: options.storage === undefined ? null : options.storage,
    push: options.push ?? { notifyActivity: async () => {}, notifyUsers: async () => {} },
    // Tests never reach out to OpenStreetMap or Google.
    venues: options.venues ?? { search: async () => ({ venues: [], attribution: null }) },
  });
  const app = createApp(deps);

  beforeEach(async () => {
    mail.sent.length = 0;
    deps.limiter.reset();
    await seed(deps.db);
  });
  afterAll(() => close());

  const origin = { origin: 'http://localhost:7400' };

  async function requestCode(email: string) {
    return app.request('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...origin },
      body: JSON.stringify({ email, type: 'sign-in' }),
    });
  }

  async function signIn(email = 'kavindu@buddy.test', name?: string) {
    await requestCode(email);
    // The mailer runs asynchronously; give it a tick.
    await new Promise((r) => setTimeout(r, 10));
    const res = await app.request('/api/auth/sign-in/email-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...origin },
      body: JSON.stringify({ email, otp: mail.codeFor(email), ...(name ? { name } : {}) }),
    });
    if (res.status !== 200) throw new Error(`Sign-in failed: ${res.status} ${await res.text()}`);
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const body = (await res.json()) as { user: { id: string } };
    return { headers: { cookie, ...origin }, userId: body.user.id };
  }

  /** JSON request helper. */
  async function call<T = unknown>(
    path: string,
    init: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
  ) {
    const res = await app.request(path, {
      method: init.method ?? 'GET',
      // Like real clients: a JSON content-type only when there's a body.
      headers: {
        ...(init.body !== undefined && { 'content-type': 'application/json' }),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
  }

  /** Starts a real HTTP + WebSocket server on a random port (for socket tests). */
  async function listen() {
    const wss = new WebSocketServer({ noServer: true });
    const server = await new Promise<ReturnType<typeof serve>>((resolve) => {
      const s = serve({ fetch: app.fetch, port: 0, websocket: { server: wss } }, () => resolve(s));
    });
    const { port } = server.address() as AddressInfo;
    return {
      base: `http://127.0.0.1:${port}`,
      /** Opens a socket as the signed-in user; resolves once open (or rejects with the HTTP status). */
      connect(path: string, headers: Record<string, string>) {
        const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, { headers });
        const events: unknown[] = [];
        ws.on('message', (data) => events.push(JSON.parse(String(data))));
        const opened = new Promise<void>((resolve, reject) => {
          ws.once('open', () => resolve());
          ws.once('unexpected-response', (_req, res) =>
            reject(new Error(`HTTP ${res.statusCode}`)),
          );
          ws.once('error', reject);
        });
        return { ws, events, opened };
      },
      close: () =>
        new Promise<void>((resolve) => {
          for (const client of wss.clients) client.terminate();
          wss.close();
          server.close(() => resolve());
        }),
    };
  }

  return { app, deps, mail, requestCode, signIn, call, listen };
}
