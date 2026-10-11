import type { ActivityDetail, ActivitySummary, Me, MessagesPage } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  activities,
  activityFeedback,
  activityMembers,
  messages,
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

  it('names a new account from its email until the person picks a name', async () => {
    const { headers } = await t.signIn('nimal.perera42+buddy@buddy.test');
    const me = await t.call<Me>('/v1/me', { headers });
    expect(me.body).toMatchObject({ name: 'Nimal', onboarded: false });
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

  it('past the hourly limit, asking again keeps the code already sent working', async () => {
    const email = 'nethmi@buddy.test';
    for (let i = 0; i < 5; i++) await t.requestCode(email);
    await new Promise((r) => setTimeout(r, 10));
    const sent = t.mail.codeFor(email);
    const count = t.mail.sent.length;

    // Someone else keeps asking for codes for this address: no email, no new code…
    for (let i = 0; i < 3; i++) expect((await t.requestCode(email)).status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(t.mail.sent).toHaveLength(count);

    // …so the person's own code still signs them in.
    const res = await t.app.request('/api/auth/sign-in/email-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:7400' },
      body: JSON.stringify({ email, otp: sent }),
    });
    expect(res.status).toBe(200);
  });

  it('caps code guesses per address, whatever the IP', async () => {
    const email = 'amaya@buddy.test';
    const guess = (otp: string) =>
      t.app.request('/api/auth/sign-in/email-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:7400' },
        body: JSON.stringify({ email, otp }),
      });
    for (let i = 0; i < 20; i++) expect((await guess('000000')).status).not.toBe(429);
    expect((await guess('000000')).status).toBe(429);
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
  it('saves setup step by step and finishes it when asked', async () => {
    const { headers } = await t.signIn('new.person@buddy.test', 'Ruwani');
    const patch = (body: object) => t.call<Me>('/v1/me', { method: 'PATCH', headers, body });

    // Each step saves on its own; setup isn't finished until the last one.
    expect((await patch({ name: 'Ruwani Silva' })).body.onboarded).toBe(false);
    expect((await patch({ placeId: 863 })).body.onboarded).toBe(false); // Peradeniya
    const res = await patch({
      interests: ['Running', 'Yoga', 'Cricket'],
      availability: ['Weekend mornings'],
      onboarded: true,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Ruwani Silva',
      onboarded: true,
      area: 'Peradeniya, Kandy',
      place: { name: 'Peradeniya', district: 'Kandy', province: 'Central' },
      interests: ['Running', 'Yoga', 'Cricket'],
    });
  });

  it('lets every setup step be skipped', async () => {
    const { headers } = await t.signIn('skipper@buddy.test');
    const res = await t.call<Me>('/v1/me', {
      method: 'PATCH',
      headers,
      body: { onboarded: true },
    });
    expect(res.body).toMatchObject({
      name: 'Skipper',
      area: 'Colombo 7',
      interests: [],
      onboarded: true,
    });
    // No interests is a valid profile, not something to fix before saving.
    const later = await t.call<Me>('/v1/me', {
      method: 'PATCH',
      headers,
      body: { interests: [], bio: 'Just looking for now.' },
    });
    expect(later.status).toBe(200);
  });

  it('updates the name on the auth account', async () => {
    const { headers, userId } = await t.signIn();
    await t.call('/v1/me', { method: 'PATCH', headers, body: { name: 'Kavindu S. Perera' } });
    const [row] = await t.deps.db.select({ name: user.name }).from(user).where(eq(user.id, userId));
    expect(row?.name).toBe('Kavindu S. Perera');
  });

  it('rejects unknown interests and unknown towns', async () => {
    const { headers } = await t.signIn();
    const odd = await t.call('/v1/me', {
      method: 'PATCH',
      headers,
      body: { interests: ['Yoga', 'Juggling'] },
    });
    expect(odd.status).toBe(400);
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

  it('leaves nothing of theirs behind in chats, roll calls, searches or sign-in codes', async () => {
    const run = await nethmisRun();
    const db = t.deps.db;
    const nethmi = await t.signIn('nethmi@buddy.test');
    const guest = await t.signIn(run.guestEmail);
    const [{ id: photoMsg }] = (await db
      .insert(messages)
      .values({
        id: randomUUID(),
        activityId: run.id,
        senderId: nethmi.userId,
        body: 'Route map',
        imageKey: `chat/${nethmi.userId}/map.jpg`,
        imageWidth: 800,
        imageHeight: 600,
      })
      .returning({ id: messages.id })) as [{ id: string }];
    const [{ id: mentionMsg }] = (await db
      .insert(messages)
      .values({
        id: randomUUID(),
        activityId: run.id,
        senderId: guest.userId,
        body: 'See you @Nethmi',
        mentions: [nethmi.userId],
      })
      .returning({ id: messages.id })) as [{ id: string }];
    await db
      .update(activityMembers)
      .set({ attended: true })
      .where(eq(activityMembers.userId, nethmi.userId));
    await db
      .update(profiles)
      .set({ hiddenInterests: ['Yoga'] })
      .where(eq(profiles.userId, nethmi.userId));
    await db.insert(activityFeedback).values({
      activityId: run.id,
      userId: nethmi.userId,
      hostId: guest.userId,
      wouldGoAgain: true,
    });
    await db.insert(verification).values({
      identifier: 'sign-in-otp-nethmi@buddy.test',
      value: '123456:0',
      expiresAt: new Date(Date.now() + 300_000),
    });

    await t.call('/v1/me', { method: 'DELETE', headers: nethmi.headers });

    const [photo] = await db.select().from(messages).where(eq(messages.id, photoMsg));
    // The message stays (as "Deleted account"); the photo doesn't.
    expect(photo).toMatchObject({ senderId: null, imageKey: null, body: 'Route map' });
    const [mention] = await db.select().from(messages).where(eq(messages.id, mentionMsg));
    expect(mention!.mentions).toEqual([]);
    expect(
      await db.select().from(activityMembers).where(eq(activityMembers.userId, nethmi.userId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(activityFeedback).where(eq(activityFeedback.userId, nethmi.userId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(verification)
        .where(eq(verification.identifier, 'sign-in-otp-nethmi@buddy.test')),
    ).toHaveLength(0);
    const found = await t.call<{ people: { id: string }[] }>('/v1/users/search?q=Nethmi', {
      headers: guest.headers,
    });
    expect(found.body.people.some((p) => p.id === nethmi.userId)).toBe(false);
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
