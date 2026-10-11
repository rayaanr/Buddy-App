import type { Me } from '@buddy/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { account } from '../src/db/schema';
import { loadEnv } from '../src/env';
import { useTestApp } from './harness';

const t = useTestApp({
  env: { GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'x' },
});

const origin = { origin: 'http://localhost:7400' };
const cookiesOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

/** An unsigned ID token: the code exchange happens server to server, so it isn't re-verified. */
const idToken = (claims: Record<string, unknown>) =>
  ['{"alg":"none","typ":"JWT"}', JSON.stringify(claims)]
    .map((part) => Buffer.from(part).toString('base64url'))
    .join('.') + '.';

/**
 * Runs the whole browser round trip: start sign-in, "come back" from Google
 * with a code, and have Google's token endpoint answer for this person.
 */
async function signInWithGoogle(person: { sub: string; email: string; name: string }) {
  const start = await t.app.request('/api/auth/sign-in/social', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...origin },
    body: JSON.stringify({ provider: 'google', callbackURL: 'buddy://' }),
  });
  expect(start.status).toBe(200);
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get('state')!;

  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith('https://oauth2.googleapis.com/token')) {
      return Response.json({
        access_token: 'access',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: idToken({
          iss: 'https://accounts.google.com',
          aud: 'test-client.apps.googleusercontent.com',
          email_verified: true,
          picture: 'https://lh3.googleusercontent.com/a/photo',
          ...person,
        }),
      });
    }
    return realFetch(input, init);
  });

  const back = await t.app.request(`/api/auth/callback/google?code=abc&state=${state}`, {
    headers: { cookie: cookiesOf(start) },
  });
  return { status: back.status, location: back.headers.get('location'), cookie: cookiesOf(back) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Google sign-in', () => {
  it('sends the browser to Google with our callback', async () => {
    const res = await t.app.request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...origin },
      body: JSON.stringify({ provider: 'google', callbackURL: 'buddy://' }),
    });
    const { url } = (await res.json()) as { url: string };
    const google = new URL(url);
    expect(google.host).toBe('accounts.google.com');
    expect(google.searchParams.get('client_id')).toBe('test-client.apps.googleusercontent.com');
    expect(google.searchParams.get('redirect_uri')).toBe(
      'http://localhost:7400/api/auth/callback/google',
    );
    expect(google.searchParams.get('prompt')).toBe('select_account');
  });

  it('creates an account with the Google name and photo, then onboarding', async () => {
    const back = await signInWithGoogle({
      sub: 'g-new',
      email: 'ruwani@gmail.com',
      name: 'Ruwani Silva',
    });
    expect(back.status).toBe(302);
    // Back into the app, carrying the session.
    expect(back.location).toMatch(/^buddy:\/\//);

    const me = await t.call<Me>('/v1/me', { headers: { cookie: back.cookie, ...origin } });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      email: 'ruwani@gmail.com',
      name: 'Ruwani Silva',
      avatarUrl: 'https://lh3.googleusercontent.com/a/photo',
      onboarded: false,
    });
  });

  it('drops the Google photo once they remove their picture', async () => {
    const back = await signInWithGoogle({ sub: 'g-2', email: 'amal@gmail.com', name: 'Amal' });
    const headers = { cookie: back.cookie, ...origin };
    await t.call('/v1/me', { method: 'PATCH', headers, body: { avatarKey: null } });
    const me = await t.call<Me>('/v1/me', { headers });
    // One of the avatars for people who haven't said their gender, instead.
    expect(me.body.avatarUrl).toMatch(/\/fallbacks\/other-0\d\.svg$/);
  });

  it('signs an existing email-code user into their own account', async () => {
    const before = await t.signIn('kavindu@buddy.test');
    const back = await signInWithGoogle({
      sub: 'g-kavindu',
      email: 'kavindu@buddy.test',
      name: 'Someone Else',
    });
    expect(back.status).toBe(302);

    const me = await t.call<Me>('/v1/me', { headers: { cookie: back.cookie, ...origin } });
    expect(me.body).toMatchObject({ id: before.userId, name: 'Kavindu Perera', onboarded: true });
    const linked = await t.deps.db.select().from(account).where(eq(account.userId, before.userId));
    expect(linked.map((a) => a.providerId)).toContain('google');
  });
});

describe('Google settings', () => {
  it('tells the app to offer Google sign-in', async () => {
    const res = await t.call<{ signIn: { google: boolean } }>('/v1/config');
    expect(res.body.signIn.google).toBe(true);
  });

  const base = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://x@localhost/x',
    BETTER_AUTH_URL: 'http://localhost:7400',
    BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
  };

  it('needs both the client ID and secret', () => {
    expect(() => loadEnv({ ...base, GOOGLE_CLIENT_ID: 'id' })).toThrow(/GOOGLE_CLIENT_SECRET/);
    expect(() => loadEnv(base)).not.toThrow();
  });
});
