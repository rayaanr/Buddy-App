import type { ActivityDetail, ActivitySummary, Me, MessagesPage } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  activities,
  activityMembers,
  profiles,
  reports,
  user,
  verification,
} from '../src/db/schema';
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
      // New profiles start in Colombo 7 until the person picks their town.
      area: 'Colombo 7',
      place: { id: 1841, name: 'Colombo 7', aka: 'Cinnamon Gardens', district: 'Colombo' },
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
        placeId: 863, // Peradeniya
      },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      onboarded: true,
      area: 'Peradeniya, Kandy',
      place: { name: 'Peradeniya', district: 'Kandy', province: 'Central' },
      interests: ['Running', 'Yoga', 'Cricket'],
    });
  });

  it('updates the name on the auth account', async () => {
    const { headers, userId } = await t.signIn();
    await t.call('/v1/me', { method: 'PATCH', headers, body: { name: 'Kavindu S. Perera' } });
    const [row] = await t.deps.db.select({ name: user.name }).from(user).where(eq(user.id, userId));
    expect(row?.name).toBe('Kavindu S. Perera');
  });

  it('rejects fewer than three interests and unknown towns', async () => {
    const { headers } = await t.signIn();
    const few = await t.call('/v1/me', { method: 'PATCH', headers, body: { interests: ['Yoga'] } });
    expect(few.status).toBe(400);
    const town = await t.call('/v1/me', { method: 'PATCH', headers, body: { placeId: 999999 } });
    expect(town.status).toBe(400);
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
  /** Nethmi hosts the Sunset 5K and the Saturday 10K, and has chatted in both. */
  async function nethmisRun() {
    const db = t.deps.db;
    const [run] = await db
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.title, 'Sunset 5K at Galle Face'));
    const [guest] = await db
      .select({ email: user.email })
      .from(activityMembers)
      .innerJoin(user, eq(user.id, activityMembers.userId))
      .where(and(eq(activityMembers.activityId, run!.id), eq(activityMembers.role, 'guest')))
      .limit(1);
    return { id: run!.id, guestEmail: guest!.email };
  }

  it('removes the account and its private data; the old session stops working', async () => {
    const { headers, userId } = await t.signIn('nethmi@buddy.test');
    const res = await t.call('/v1/me', { method: 'DELETE', headers });
    expect(res.status).toBe(204);

    const db = t.deps.db;
    expect(await db.select().from(user).where(eq(user.id, userId))).toHaveLength(0);
    expect(await db.select().from(profiles).where(eq(profiles.userId, userId))).toHaveLength(0);
    expect(
      await db.select().from(activityMembers).where(eq(activityMembers.userId, userId)),
    ).toHaveLength(0);
    expect((await t.call('/v1/me', { headers })).status).toBe(401);
  });

  it('cancels upcoming activities they host, so guests are told instead of losing them', async () => {
    const run = await nethmisRun();
    const { headers } = await t.signIn('nethmi@buddy.test');
    await t.call('/v1/me', { method: 'DELETE', headers });

    const guest = await t.signIn(run.guestEmail);
    const detail = await t.call<ActivityDetail>(`/v1/activities/${run.id}`, {
      headers: guest.headers,
    });
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      cancelled: true,
      host: { id: '', name: 'Deleted account' },
    });

    const chat = await t.call<MessagesPage>(`/v1/activities/${run.id}/chat/messages`, {
      headers: guest.headers,
    });
    const bodies = chat.body.messages.map((m) => m.body);
    expect(bodies.at(-1)).toBe('Nethmi deleted their account, so this activity is off');
    // Her own message stays, attributed to a deleted account.
    const hers = chat.body.messages.find((m) => m.body.startsWith('Hi all, meeting by'));
    expect(hers?.sender).toMatchObject({ id: '', name: 'Deleted account' });

    // Other people's Discover no longer shows it.
    const other = await t.signIn('kavindu@buddy.test');
    const feed = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', {
      headers: other.headers,
    });
    expect(feed.body.activities.some((a) => a.id === run.id)).toBe(false);
  });

  it('keeps reports about them for moderation', async () => {
    const reporter = await t.signIn();
    const nethmi = await t.signIn('nethmi@buddy.test');
    const filed = await t.call<{ id: string; targetUserId: string }>('/v1/reports', {
      method: 'POST',
      headers: reporter.headers,
      body: { userId: nethmi.userId, reason: 'spam' },
    });
    expect(filed.body.targetUserId).toBe(nethmi.userId);

    await t.call('/v1/me', { method: 'DELETE', headers: nethmi.headers });
    const [row] = await t.deps.db.select().from(reports).where(eq(reports.id, filed.body.id));
    expect(row).toMatchObject({ reason: 'spam', targetUserId: null });
  });

  it('stops their weekly series', async () => {
    const run = await nethmisRun();
    await t.deps.db
      .update(activities)
      .set({ repeatsWeekly: true, seriesId: randomUUID() })
      .where(eq(activities.id, run.id));
    const { headers } = await t.signIn('nethmi@buddy.test');
    await t.call('/v1/me', { method: 'DELETE', headers });
    const [row] = await t.deps.db
      .select({ repeatsWeekly: activities.repeatsWeekly })
      .from(activities)
      .where(eq(activities.id, run.id));
    expect(row?.repeatsWeekly).toBe(false);
  });
});
