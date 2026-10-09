import type {
  ActivityDetail,
  ActivitySummary,
  CommunityDetail,
  CommunitySummary,
  MyActivity,
  Pick,
  PublicProfile,
} from '@buddy/shared';
import { atLocalTime } from '@buddy/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { messages } from '../src/db/schema';
import type { HttpError } from '../src/lib/errors';
import { joinActivity } from '../src/modules/activities/service';
import { useTestApp } from './harness';

const t = useTestApp();

type Headers = Record<string, string>;

async function feed(headers: Headers) {
  const res = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', { headers });
  return res.body.activities;
}
const byTitle = (list: ActivitySummary[], prefix: string) =>
  list.find((a) => a.title.startsWith(prefix))!;

const newActivity = {
  title: 'Evening chess',
  group: 'Social',
  startsAt: atLocalTime(1, '18:30').toISOString(),
  place: 'Barefoot Café',
  area: 'Colombo 03',
  capacity: 6,
  description: 'Bring a board if you have one.',
};

describe('creating activities', () => {
  it('creates the activity with the host as first member and a system line', async () => {
    const { headers, userId } = await t.signIn();
    const res = await t.call<ActivityDetail>('/v1/activities', {
      method: 'POST',
      headers,
      body: newActivity,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Evening chess',
      category: 'SOCIAL',
      goingCount: 1,
      viewer: { hosting: true, joined: false },
      host: { id: userId, hostedCount: 1 },
      // Area centre stands in for the exact spot.
      location: { lat: 6.911, lng: 79.851 },
    });
    expect(res.body.coverUrl).toContain('unsplash');

    const lines = await t.deps.db
      .select()
      .from(messages)
      .where(eq(messages.activityId, res.body.id));
    expect(lines.map((m) => m.body)).toEqual(['Kavindu created this activity']);
  });

  it('uses the interest as the category when given', async () => {
    const { headers } = await t.signIn();
    const res = await t.call<ActivityDetail>('/v1/activities', {
      method: 'POST',
      headers,
      body: { ...newActivity, group: 'Sports', interest: 'Padel' },
    });
    expect(res.body.category).toBe('PADEL');
  });

  it('rejects start times in the past', async () => {
    const { headers } = await t.signIn();
    const res = await t.call('/v1/activities', {
      method: 'POST',
      headers,
      body: { ...newActivity, startsAt: new Date(Date.now() - 60_000).toISOString() },
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { details: { issues: [{ path: 'startsAt' }] } } });
  });

  it('shows up under hosting, with no chat preview until someone writes', async () => {
    const { headers } = await t.signIn();
    await t.call('/v1/activities', { method: 'POST', headers, body: newActivity });
    const res = await t.call<{ activities: MyActivity[] }>('/v1/activities/mine?role=hosting', {
      headers,
    });
    expect(res.body.activities.map((a) => a.title)).toEqual(['Evening chess']);
    expect(res.body.activities[0]!.lastMessage).toBeNull();
  });
});

describe('joining and leaving', () => {
  it('joins, updates the count and posts a system line; joining again is a no-op', async () => {
    const { headers } = await t.signIn();
    const run = byTitle(await feed(headers), 'Sunset 5K');

    const first = await t.call<ActivityDetail>(`/v1/activities/${run.id}/membership`, {
      method: 'POST',
      headers,
    });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ goingCount: run.goingCount + 1, viewer: { joined: true } });

    const again = await t.call<ActivityDetail>(`/v1/activities/${run.id}/membership`, {
      method: 'POST',
      headers,
    });
    expect(again.body.goingCount).toBe(run.goingCount + 1);

    const lines = await t.deps.db.select().from(messages).where(eq(messages.activityId, run.id));
    expect(lines.filter((m) => m.body === 'Kavindu joined')).toHaveLength(1);
  });

  it('refuses to join a full activity', async () => {
    const { headers } = await t.signIn('outsider@buddy.test', 'Outsider');
    const padel = byTitle(await feed(headers), 'Padel'); // 4 of 4, and not a member
    const res = await t.call(`/v1/activities/${padel.id}/membership`, { method: 'POST', headers });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: { code: 'activity_full' } });
  });

  it('lets exactly one of many simultaneous joins take the last spot', async () => {
    const { headers } = await t.signIn();
    const games = byTitle(await feed(headers), 'Board games'); // 6 of 8
    await t.call(`/v1/activities/${games.id}/membership`, { method: 'POST', headers }); // 7 of 8

    // Call the service directly so the joins overlap inside the database,
    // rather than being spread out by HTTP and session handling.
    const racers = await Promise.all(
      Array.from({ length: 8 }, (_, i) => t.signIn(`racer${i}@buddy.test`, `Racer ${i}`)),
    );
    const results = await Promise.allSettled(
      racers.map((r) => joinActivity(t.deps.db, { id: r.userId, name: 'Racer' }, games.id)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      results.every(
        (r) => r.status === 'fulfilled' || (r.reason as HttpError).code === 'activity_full',
      ),
    ).toBe(true);

    const detail = await t.call<ActivityDetail>(`/v1/activities/${games.id}`, { headers });
    expect(detail.body.goingCount).toBe(8);
  });

  it('leaves with a system line; hosts cannot leave their own activity', async () => {
    const { headers } = await t.signIn();
    const padel = byTitle(await feed(headers), 'Padel');
    const res = await t.call<ActivityDetail>(`/v1/activities/${padel.id}/membership`, {
      method: 'DELETE',
      headers,
    });
    expect(res.body).toMatchObject({ goingCount: 3, viewer: { joined: false } });

    const host = await t.signIn('shehani@buddy.test');
    const denied = await t.call(`/v1/activities/${padel.id}/membership`, {
      method: 'DELETE',
      headers: host.headers,
    });
    expect(denied.status).toBe(403);
  });

  it('lists joined activities with the latest chat line', async () => {
    const { headers } = await t.signIn();
    const res = await t.call<{ activities: MyActivity[] }>('/v1/activities/mine?role=joined', {
      headers,
    });
    expect(res.body.activities).toHaveLength(1);
    expect(res.body.activities[0]!.lastMessage).toMatchObject({
      senderName: 'Shehani',
      body: 'Perfect. Meet at reception at 06:20.',
      mine: false,
    });
  });
});

describe('communities', () => {
  it('lists communities with counts and the viewer’s membership', async () => {
    const { headers } = await t.signIn();
    const res = await t.call<{ communities: CommunitySummary[] }>('/v1/communities', { headers });
    const gamers = res.body.communities.find((c) => c.name === 'Colombo Board Gamers')!;
    expect(gamers).toMatchObject({ joined: true, memberCount: 7 });
    expect(res.body.communities.filter((c) => c.joined)).toHaveLength(1);
  });

  it('shows details with members and upcoming activities', async () => {
    const { headers } = await t.signIn();
    const list = await t.call<{ communities: CommunitySummary[] }>('/v1/communities', { headers });
    const runners = list.body.communities.find((c) => c.name === 'Colombo Runners')!;
    const res = await t.call<CommunityDetail>(`/v1/communities/${runners.id}`, { headers });
    expect(res.body.rules).toHaveLength(3);
    expect(res.body.members).toHaveLength(6);
    expect(res.body.upcoming.map((a) => a.title).sort()).toEqual([
      'Saturday 10K, Viharamahadevi Park',
      'Sunset 5K at Galle Face',
    ]);
  });

  it('joins and leaves idempotently, and joining surfaces its activities', async () => {
    const { headers } = await t.signIn();
    const list = await t.call<{ communities: CommunitySummary[] }>('/v1/communities', { headers });
    const climb = list.body.communities.find((c) => c.name === 'Climb Lanka')!;

    const joined = await t.call<CommunitySummary>(`/v1/communities/${climb.id}/membership`, {
      method: 'POST',
      headers,
    });
    expect(joined.body).toMatchObject({ joined: true, memberCount: climb.memberCount + 1 });
    await t.call(`/v1/communities/${climb.id}/membership`, { method: 'POST', headers });

    const fromComms = await t.call<{ activities: ActivitySummary[] }>(
      '/v1/activities/from-communities',
      { headers },
    );
    expect(fromComms.body.activities.map((a) => a.title)).toContain('Bouldering social');

    const left = await t.call<CommunitySummary>(`/v1/communities/${climb.id}/membership`, {
      method: 'DELETE',
      headers,
    });
    expect(left.body).toMatchObject({ joined: false, memberCount: climb.memberCount });
  });
});

describe('profiles', () => {
  it('shows another person with shared interests and what they host', async () => {
    const { headers } = await t.signIn();
    const run = byTitle(await feed(headers), 'Saturday 10K');
    const res = await t.call<PublicProfile>(`/v1/users/${run.host.id}`, { headers });
    expect(res.body).toMatchObject({
      name: 'Nethmi',
      area: 'Colombo 03',
      hostedCount: 2,
      commonInterests: ['Running'],
    });
    expect(res.body.hosting).toHaveLength(2);
  });
});

describe('picks', () => {
  it('ranks joined-community activities first, then interests, excluding full or joined ones', async () => {
    const { headers } = await t.signIn();
    const res = await t.call<{ picks: Pick[] }>('/v1/activities/picks', { headers });
    const picks = res.body.picks;
    expect(picks).toHaveLength(5);
    expect(picks[0]).toMatchObject({
      activity: { title: 'Board games night' },
      reason: 'From Colombo Board Gamers',
    });
    expect(picks.slice(1, 4).every((p) => p.reason.startsWith('Because you’re into'))).toBe(true);
    expect(picks.some((p) => p.activity.title.startsWith('Padel'))).toBe(false);
  });
});
