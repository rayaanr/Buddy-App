import type {
  ActivityDetail,
  AdminPerson,
  AdminReport,
  AdminStats,
  CommunityDetail,
  Me,
} from '@buddy/shared';
import { atLocalTime } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { messages } from '../src/db/schema';
import { useTestApp } from './harness';

const t = useTestApp({ env: { ADMIN_EMAILS: 'Mod@Buddy.test' } });
type Headers = Record<string, string>;

const moderator = () => t.signIn('mod@buddy.test', 'Moderator');
const openReports = async (headers: Headers) =>
  (await t.call<{ reports: AdminReport[] }>('/v1/admin/reports', { headers })).body.reports;
const resolve = (headers: Headers, id: string, body: object) =>
  t.call(`/v1/admin/reports/${id}/resolve`, { method: 'POST', headers, body });

async function hostActivity(headers: Headers, title: string) {
  const res = await t.call<ActivityDetail>('/v1/activities', {
    method: 'POST',
    headers,
    body: {
      title,
      group: 'Social',
      startsAt: atLocalTime(2, '18:00').toISOString(),
      place: 'Barefoot Café',
      capacity: 6,
    },
  });
  return res.body.id;
}

describe('who can moderate', () => {
  it('is only the emails in ADMIN_EMAILS, whatever the capitals', async () => {
    const mod = await moderator();
    const me = await t.call<Me>('/v1/me', { headers: mod.headers });
    expect(me.body.isAdmin).toBe(true);

    const someone = await t.signIn();
    expect((await t.call<Me>('/v1/me', { headers: someone.headers })).body.isAdmin).toBe(false);
    expect((await t.call('/v1/admin/reports', { headers: someone.headers })).status).toBe(403);
  });
});

describe('acting on reports', () => {
  it('removes a reported message from the chat and closes the report', async () => {
    const host = await t.signIn('troll@buddy.test', 'Troll');
    const activityId = await hostActivity(host.headers, 'Trivia night');
    const messageId = randomUUID();
    await t.deps.db
      .insert(messages)
      .values({ id: messageId, activityId, senderId: host.userId, body: 'Something nasty' });
    const guest = await t.signIn();
    await t.call(`/v1/activities/${activityId}/membership`, {
      method: 'POST',
      headers: guest.headers,
    });
    await t.call('/v1/reports', {
      method: 'POST',
      headers: guest.headers,
      body: { reason: 'harassment', messageId },
    });

    const mod = await moderator();
    const report = (await openReports(mod.headers)).find((r) => r.message?.id === messageId)!;
    expect(report).toMatchObject({
      reason: 'harassment',
      person: { id: host.userId, suspended: false },
      message: { body: 'Something nasty' },
    });

    expect((await resolve(mod.headers, report.id, { removeContent: true })).status).toBe(200);
    const left = await t.deps.db.select().from(messages).where(eq(messages.id, messageId));
    expect(left).toHaveLength(0);
    expect((await openReports(mod.headers)).some((r) => r.id === report.id)).toBe(false);
    const resolved = await t.call<{ reports: AdminReport[] }>('/v1/admin/reports?status=resolved', {
      headers: mod.headers,
    });
    expect(resolved.body.reports.find((r) => r.id === report.id)?.resolution).toBe('removed');
  });

  it('suspends a person: signed out, can’t sign back in, their activities cancelled', async () => {
    const bad = await t.signIn('spammer@buddy.test', 'Spammer');
    const activityId = await hostActivity(bad.headers, 'Free crypto meetup');
    const guest = await t.signIn();
    await t.call('/v1/reports', {
      method: 'POST',
      headers: guest.headers,
      body: { reason: 'spam', userId: bad.userId },
    });
    // A second report about them is settled by the same suspension.
    await t.call('/v1/reports', {
      method: 'POST',
      headers: guest.headers,
      body: { reason: 'spam', activityId },
    });

    const mod = await moderator();
    const report = (await openReports(mod.headers)).find(
      (r) => r.person?.id === bad.userId && !r.activity,
    )!;
    expect((await resolve(mod.headers, report.id, { suspend: true })).status).toBe(200);

    expect((await t.call('/v1/me', { headers: bad.headers })).status).toBe(401);
    await expect(t.signIn('spammer@buddy.test')).rejects.toThrow(/403/);
    const activity = await t.call<ActivityDetail>(`/v1/activities/${activityId}`, {
      headers: mod.headers,
    });
    expect(activity.status).toBe(404); // cancelled, so hidden from people who weren't going
    expect((await openReports(mod.headers)).some((r) => r.person?.id === bad.userId)).toBe(false);

    // A mistake can be undone.
    const lift = await t.call(`/v1/admin/suspensions/${bad.userId}`, {
      method: 'DELETE',
      headers: mod.headers,
    });
    expect(lift.status).toBe(200);
    await expect(t.signIn('spammer@buddy.test')).resolves.toBeTruthy();
  });

  it('dismisses a report without touching anything', async () => {
    const host = await t.signIn('fine@buddy.test', 'Fine');
    const activityId = await hostActivity(host.headers, 'Book swap');
    const guest = await t.signIn();
    await t.call('/v1/reports', {
      method: 'POST',
      headers: guest.headers,
      body: { reason: 'other', activityId },
    });
    const mod = await moderator();
    const report = (await openReports(mod.headers)).find((r) => r.activity?.id === activityId)!;
    await resolve(mod.headers, report.id, {});
    const activity = await t.call<ActivityDetail>(`/v1/activities/${activityId}`, {
      headers: host.headers,
    });
    expect(activity.body.cancelled).toBe(false);
  });

  it('won’t "remove" a person-only report', async () => {
    const someone = await t.signIn('rude@buddy.test', 'Rude');
    const guest = await t.signIn();
    await t.call('/v1/reports', {
      method: 'POST',
      headers: guest.headers,
      body: { reason: 'harassment', userId: someone.userId },
    });
    const mod = await moderator();
    const report = (await openReports(mod.headers)).find((r) => r.person?.id === someone.userId)!;
    expect((await resolve(mod.headers, report.id, { removeContent: true })).status).toBe(400);
  });
});

describe('admin dashboard', () => {
  it('gives moderators the numbers, and nobody else', async () => {
    const mod = await t.signIn('mod@buddy.test');
    const someone = await t.signIn('someone@buddy.test');
    expect((await t.call('/v1/admin/stats', { headers: someone.headers })).status).toBe(403);

    const res = await t.call<AdminStats>('/v1/admin/stats', { headers: mod.headers });
    expect(res.status).toBe(200);
    const s = res.body;
    // The seed has people, activities and communities; both of us signed up just now.
    expect(s.people.total).toBeGreaterThan(5);
    expect(s.people.new7).toBeGreaterThanOrEqual(2);
    expect(s.activities.upcoming).toBeGreaterThan(0);
    expect(s.communities.total).toBeGreaterThan(0);
    expect(s.daily).toHaveLength(14);
    expect(s.daily.at(-1)!.signups).toBeGreaterThanOrEqual(2);
    expect(s.daily[0]!.day < s.daily.at(-1)!.day).toBe(true);
  });
});

describe('acting without a report', () => {
  it('finds anyone by name or email, and only for moderators', async () => {
    const someone = await t.signIn('finder@buddy.test', 'Finder');
    expect((await t.call('/v1/admin/people?q=fin', { headers: someone.headers })).status).toBe(403);

    const mod = await moderator();
    const byEmail = await t.call<{ people: AdminPerson[] }>('/v1/admin/people?q=finder@', {
      headers: mod.headers,
    });
    expect(byEmail.body.people).toEqual([
      expect.objectContaining({ id: someone.userId, email: 'finder@buddy.test', suspended: false }),
    ]);
    const byName = await t.call<{ people: AdminPerson[] }>('/v1/admin/people?q=FIND', {
      headers: mod.headers,
    });
    expect(byName.body.people.map((p) => p.id)).toContain(someone.userId);
    // "%" is a letter here, not a wildcard.
    const wild = await t.call<{ people: AdminPerson[] }>('/v1/admin/people?q=%25%25', {
      headers: mod.headers,
    });
    expect(wild.body.people).toEqual([]);
  });

  it('suspends someone straight away and closes reports about them', async () => {
    const bad = await t.signIn('rude@buddy.test', 'Rude');
    const activityId = await hostActivity(bad.headers, 'Shouting club');
    const guest = await t.signIn();
    await t.call('/v1/reports', {
      method: 'POST',
      headers: guest.headers,
      body: { reason: 'harassment', userId: bad.userId },
    });

    const mod = await moderator();
    const res = await t.call(`/v1/admin/people/${bad.userId}/suspend`, {
      method: 'POST',
      headers: mod.headers,
    });
    expect(res.status).toBe(200);
    expect((await t.call('/v1/me', { headers: bad.headers })).status).toBe(401);
    expect((await t.call(`/v1/activities/${activityId}`, { headers: mod.headers })).status).toBe(
      404,
    );
    expect((await openReports(mod.headers)).some((r) => r.person?.id === bad.userId)).toBe(false);
    const found = await t.call<{ people: AdminPerson[] }>('/v1/admin/people?q=rude@', {
      headers: mod.headers,
    });
    expect(found.body.people[0]?.suspended).toBe(true);

    // Not yourself, and not someone who doesn't exist.
    expect(
      (
        await t.call(`/v1/admin/people/${mod.userId}/suspend`, {
          method: 'POST',
          headers: mod.headers,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await t.call(`/v1/admin/people/${randomUUID()}/suspend`, {
          method: 'POST',
          headers: mod.headers,
        })
      ).status,
    ).toBe(404);
  });

  it('removes any activity, telling the people going', async () => {
    const host = await t.signIn();
    const activityId = await hostActivity(host.headers, 'Not allowed here');
    const mod = await moderator();
    const res = await t.call(`/v1/admin/activities/${activityId}`, {
      method: 'DELETE',
      headers: mod.headers,
    });
    expect(res.status).toBe(200);
    const after = await t.call<ActivityDetail>(`/v1/activities/${activityId}`, {
      headers: host.headers,
    });
    expect(after.body.cancelled).toBe(true);
    expect(
      (
        await t.call(`/v1/admin/activities/${randomUUID()}`, {
          method: 'DELETE',
          headers: mod.headers,
        })
      ).status,
    ).toBe(404);
  });

  it('removes any community, and the reports about it close', async () => {
    const owner = await t.signIn('badvibes@buddy.test', 'Owner');
    const created = await t.call<CommunityDetail>('/v1/communities', {
      method: 'POST',
      headers: owner.headers,
      body: { name: 'Bad Vibes Only', about: 'Against the rules.' },
    });
    expect(created.status).toBe(201);
    const communityId = created.body.id;
    const guest = await t.signIn('reporter@buddy.test', 'Reporter');
    const rep = await t.call('/v1/reports', {
      method: 'POST',
      headers: guest.headers,
      body: { reason: 'spam', communityId },
    });
    expect(rep.status).toBe(201);

    const mod = await moderator();
    const res = await t.call(`/v1/admin/communities/${communityId}`, {
      method: 'DELETE',
      headers: mod.headers,
    });
    expect(res.status).toBe(200);
    expect(
      (await t.call(`/v1/communities/${communityId}`, { headers: owner.headers })).status,
    ).toBe(404);
    const resolved = await t.call<{ reports: AdminReport[] }>('/v1/admin/reports?status=resolved', {
      headers: mod.headers,
    });
    expect(resolved.body.reports.some((r) => r.reporter?.id === guest.userId)).toBe(true);
    expect((await openReports(mod.headers)).some((r) => r.reporter?.id === guest.userId)).toBe(
      false,
    );
  });
});
