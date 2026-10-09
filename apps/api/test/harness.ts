import { afterAll, beforeEach } from 'vitest';

import { createApp } from '../src/app';
import { createDeps } from '../src/deps';
import { loadEnv } from '../src/env';
import type { Mail, Mailer } from '../src/lib/mailer';
import type { Storage } from '../src/lib/storage';
import { seed } from '../scripts/seed';
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
  options: { env?: Record<string, string>; storage?: Storage | null } = {},
) {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    BETTER_AUTH_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
    ...options.env,
  });
  const mail = captureMailer();
  const { deps, close } = createDeps(env, {
    mailer: mail.mailer,
    storage: options.storage === undefined ? null : options.storage,
  });
  const app = createApp(deps);

  beforeEach(async () => {
    mail.sent.length = 0;
    await seed(deps.db, new Date());
  });
  afterAll(() => close());

  const origin = { origin: 'http://localhost:3000' };

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
      headers: { 'content-type': 'application/json', ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
  }

  return { app, deps, mail, requestCode, signIn, call };
}
