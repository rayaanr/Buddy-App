import type { ActivitySummary, Me } from '@buddy/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { activities, activityMembers, profiles, user, verification } from '../src/db/schema';
import { useTestApp } from './harness';

const t = useTestApp();

describe('email code sign-in', () => {
  it('creates an account and an empty profile on first sign-in', async () => {
    const { headers } = await t.signIn('new.person@buddy.test', 'Ruwani Silva');
    const me = await t.call<Me>('/v1/me', { headers });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      email: 'new.person@buddy.test',
      name: 'Ruwani Silva',
      area: 'Colombo 07',
      interests: [],
      onboarded: false,
      stats: { joined: 0, hosted: 0, communities: 0 },
    });
  });

  it('signs existing users into their own account', async () => {
    const { headers } = await t.signIn('kavindu@buddy.test');
    const me = await t.call<Me>('/v1/me', { headers });
    expect(me.body).toMatchObject({ name: 'Kavindu Perera', onboarded: true });
    expect(me.body.stats).toEqual({ joined: 1, hosted: 0, communities: 1 });
  });

  it('rejects a wrong code without creating a session', async () => {
    await t.requestCode('kavindu@buddy.test');
    await new Promise((r) => setTimeout(r, 10));
    const real = t.mail.codeFor('kavindu@buddy.test');
    const wrong = real === '000000' ? '111111' : '000000';
    const res = await t.app.request('/api/auth/sign-in/email-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:7400' },
      body: JSON.stringify({ email: 'kavindu@buddy.test', otp: wrong }),
    });
    expect(res.status).not.toBe(200);
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it('stores codes hashed, never in plain text', async () => {
    await t.requestCode('kavindu@buddy.test');
    await new Promise((r) => setTimeout(r, 10));
    const code = t.mail.codeFor('kavindu@buddy.test');
    const rows = await t.deps.db.select({ value: verification.value }).from(verification);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.value).not.toContain(code);
  });

  it('ends the session on sign-out', async () => {
    const { headers } = await t.signIn();
    const out = await t.app.request('/api/auth/sign-out', { method: 'POST', headers });
    expect(out.status).toBe(200);
    expect((await t.call('/v1/me', { headers })).status).toBe(401);
  });
});

describe('PATCH /v1/me', () => {
  it('completes onboarding once three interests are saved', async () => {
    const { headers } = await t.signIn('new.person@buddy.test', 'Ruwani');
    const res = await t.call<Me>('/v1/me', {
      method: 'PATCH',
      headers,
      body: {
        interests: ['Running', 'Yoga', 'Cricket'],
        availability: ['Weekend mornings'],
        area: 'Dehiwala',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      onboarded: true,
      area: 'Dehiwala',
      interests: ['Running', 'Yoga', 'Cricket'],
    });
  });

  it('updates the name on the auth account', async () => {
    const { headers, userId } = await t.signIn();
    await t.call('/v1/me', { method: 'PATCH', headers, body: { name: 'Kavindu S. Perera' } });
    const [row] = await t.deps.db.select({ name: user.name }).from(user).where(eq(user.id, userId));
    expect(row?.name).toBe('Kavindu S. Perera');
  });

  it('rejects fewer than three interests and unknown areas', async () => {
    const { headers } = await t.signIn();
    const few = await t.call('/v1/me', { method: 'PATCH', headers, body: { interests: ['Yoga'] } });
    expect(few.status).toBe(400);
    const area = await t.call('/v1/me', { method: 'PATCH', headers, body: { area: 'Kandy' } });
    expect(area.status).toBe(400);
  });

  it("refuses an avatar key that belongs to someone else's upload", async () => {
    const { headers } = await t.signIn();
    const res = await t.call('/v1/me', {
      method: 'PATCH',
      headers,
      body: { avatarKey: 'avatars/someone-else/photo.jpg' },
    });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /v1/me', () => {
  it("removes the account, its data and its spots in others' activities", async () => {
    // Nethmi hosts two activities and is a guest in others.
    const { headers, userId } = await t.signIn('nethmi@buddy.test');
    const before = await t.deps.db
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.hostId, userId));
    expect(before).toHaveLength(2);

    const res = await t.call('/v1/me', { method: 'DELETE', headers });
    expect(res.status).toBe(204);

    const db = t.deps.db;
    expect(await db.select().from(user).where(eq(user.id, userId))).toHaveLength(0);
    expect(await db.select().from(profiles).where(eq(profiles.userId, userId))).toHaveLength(0);
    expect(await db.select().from(activities).where(eq(activities.hostId, userId))).toHaveLength(0);
    expect(
      await db.select().from(activityMembers).where(eq(activityMembers.userId, userId)),
    ).toHaveLength(0);

    // The old session no longer works.
    expect((await t.call('/v1/me', { headers })).status).toBe(401);

    // Someone else's feed no longer shows her runs.
    const other = await t.signIn('kavindu@buddy.test');
    const feed = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', {
      headers: other.headers,
    });
    expect(feed.body.activities.some((a) => a.host.name === 'Nethmi')).toBe(false);
  });
});
