import type { ActivitySummary, PublicProfile } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { activities } from '../src/db/schema';
import { clientIp } from '../src/lib/rate-limit';
import { useTestApp } from './harness';

const t = useTestApp();
type Headers = Record<string, string>;

async function padel(headers: Headers) {
  const res = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', { headers });
  return res.body.activities.find((a) => a.title.startsWith('Padel'))!;
}

describe('rate limits', () => {
  it('slows down a flood of chat messages (each can push to everyone)', async () => {
    const { headers } = await t.signIn(); // Kavindu is going to Padel
    const { id } = await padel(headers);
    const send = () =>
      t.call(`/v1/activities/${id}/chat/messages`, {
        method: 'POST',
        headers,
        body: { id: randomUUID(), body: 'hi' },
      });
    for (let i = 0; i < 30; i++) expect((await send()).status).toBe(201);
    const over = await send();
    expect(over.status).toBe(429);
    expect(over.body).toMatchObject({ error: { code: 'rate_limited' } });
  });

  it('caps sign-in codes per email address, whatever the IP', async () => {
    for (let i = 0; i < 7; i++) await t.requestCode('target@buddy.test');
    await new Promise((r) => setTimeout(r, 20));
    expect(t.mail.sent.filter((m) => m.to === 'target@buddy.test')).toHaveLength(5);
  });
});

describe('client addresses', () => {
  const at = (xff?: string) =>
    ({ req: { header: () => xff }, env: {} }) as unknown as Parameters<typeof clientIp>[0];

  it('ignores X-Forwarded-For without proxies (anyone can send it)', () => {
    expect(clientIp(at('203.0.113.9'), 0)).toBe('unknown');
  });

  it('takes the address the trusted proxy saw, not the forgeable left end', () => {
    expect(clientIp(at('6.6.6.6, 203.0.113.9'), 1)).toBe('203.0.113.9');
    expect(clientIp(at('6.6.6.6, 203.0.113.9, 10.0.0.2'), 2)).toBe('203.0.113.9');
  });

  it('uses the leftmost address when the chain is shorter than the proxies configured', () => {
    expect(clientIp(at('203.0.113.9'), 2)).toBe('203.0.113.9');
  });
});

describe('hardening', () => {
  it('refuses oversized request bodies before parsing them', async () => {
    const { headers } = await t.signIn();
    const res = await t.app.request('/v1/me', {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ bio: 'x'.repeat(100 * 1024) }),
    });
    expect(res.status).toBe(413);
  });

  it('serves the share page with a no-script CSP', async () => {
    const { headers } = await t.signIn();
    const { id } = await padel(headers);
    const res = await t.app.request(`/a/${id}`);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('turns off Better Auth’s update-user (it skips /v1/me’s name rules)', async () => {
    const { headers } = await t.signIn();
    const res = await t.app.request('/api/auth/update-user', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Buddy Support' }),
    });
    expect(res.status).toBe(404);
  });

  it('shows only name and photo for someone you blocked', async () => {
    const { headers } = await t.signIn();
    const other = await t.signIn('nethmi@buddy.test');
    await t.call(`/v1/users/${other.userId}/block`, { method: 'POST', headers });
    const res = await t.call<PublicProfile>(`/v1/users/${other.userId}`, { headers });
    expect(res.body).toMatchObject({
      name: 'Nethmi',
      blockedByYou: true,
      bio: '',
      area: '',
      interests: [],
      hosting: [],
    });
  });

  it('keeps past activities off the public share page', async () => {
    const { headers } = await t.signIn();
    const { id } = await padel(headers);
    expect((await t.app.request(`/a/${id}`)).status).toBe(200);
    await t.deps.db
      .update(activities)
      .set({ startsAt: sql`now() - interval '2 days'` })
      .where(eq(activities.id, id));
    expect((await t.app.request(`/a/${id}`)).status).toBe(404);
  });

  it('won’t take a report about an activity you can’t see', async () => {
    const host = await t.signIn('shehani@buddy.test');
    const guest = await t.signIn();
    const { id } = await padel(host.headers);
    await t.call(`/v1/activities/${id}/members/${guest.userId}/remove`, {
      method: 'POST',
      headers: host.headers,
      body: { reason: 'other' },
    });
    const res = await t.call('/v1/reports', {
      method: 'POST',
      headers: guest.headers,
      body: { activityId: id, reason: 'spam' },
    });
    expect(res.status).toBe(404);
  });

  it('refuses chat sockets from other sites’ pages', async () => {
    const { headers } = await t.signIn();
    const { id } = await padel(headers);
    const res = await t.app.request(`/v1/activities/${id}/chat/ws`, {
      headers: { ...headers, origin: 'https://evil.example', host: 'localhost:7400' },
    });
    expect(res.status).toBe(403);
  });
});
