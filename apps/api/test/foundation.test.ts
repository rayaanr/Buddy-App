import type { ActivityDetail, ActivitySummary } from '@buddy/shared';
import { describe, expect, it } from 'vitest';

import { useTestApp } from './harness';

const t = useTestApp();

describe('health', () => {
  it('reports ok with a database round-trip', async () => {
    const res = await t.call<{ status: string }>('/health');
    expect(res).toEqual({ status: 200, body: { status: 'ok' } });
  });

  it('returns the standard error shape for unknown routes', async () => {
    const res = await t.call('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not_found', message: 'Route not found' } });
  });
});

describe('activities feed', () => {
  it('requires sign-in', async () => {
    const res = await t.call('/v1/activities');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'unauthorized' } });
  });

  it('lists seeded activities in start order with counts and viewer flags', async () => {
    const { headers } = await t.signIn();
    const res = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', { headers });
    expect(res.status).toBe(200);
    const list = res.body.activities;
    expect(list).toHaveLength(9);

    const starts = list.map((a) => a.startsAt);
    expect([...starts].sort()).toEqual(starts);

    const padel = list.find((a) => a.title.startsWith('Padel'))!;
    expect(padel).toMatchObject({
      goingCount: 4,
      capacity: 4,
      viewer: { joined: true, hosting: false },
    });

    const galleFace = list.find((a) => a.title.startsWith('Sunset 5K'))!;
    expect(galleFace.community?.name).toBe('Colombo Runners');
    expect(galleFace.distanceKm).toBeGreaterThan(0);
  });

  it('filters by group, treating Running as Sports', async () => {
    const { headers } = await t.signIn();
    const res = await t.call<{ activities: ActivitySummary[] }>('/v1/activities?filter=Sports', {
      headers,
    });
    const groups = new Set(res.body.activities.map((a) => a.group));
    expect([...groups].sort()).toEqual(['Running', 'Sports']);
  });

  it('measures from an explicit point and keeps the radius when there’s enough', async () => {
    const { headers } = await t.signIn();
    // Mount Lavinia beach: the cricket game is a few hundred metres away.
    const res = await t.call<{ activities: ActivitySummary[]; radiusKm: number }>(
      '/v1/activities?lat=6.838&lng=79.862&radiusKm=25',
      { headers },
    );
    expect(res.body.radiusKm).toBe(25);
    const cricket = res.body.activities.find((a) => a.title === 'Beach cricket, softball')!;
    expect(cricket.distanceKm).toBeLessThan(1);
  });

  it('looks further when too little is close, and says how far', async () => {
    const { headers } = await t.signIn();
    // At 2 km only the cricket game is close, so it widens to 50 km.
    const near = await t.call<{ activities: ActivitySummary[]; radiusKm: number }>(
      '/v1/activities?lat=6.838&lng=79.862&radiusKm=2',
      { headers },
    );
    expect(near.body.radiusKm).toBe(50);
    expect(near.body.activities.length).toBeGreaterThan(1);
    // Widened: nearest first, so the close one leads.
    const distances = near.body.activities.map((a) => a.distanceKm!);
    expect(near.body.activities[0]!.title).toBe('Beach cricket, softball');
    expect(distances).toEqual([...distances].sort((a, b) => a - b));

    // Browsing Jaffna (~300 km away) widens until it reaches Colombo's activities.
    const jaffna = await t.call<{ activities: ActivitySummary[]; radiusKm: number }>(
      '/v1/activities?placeId=654&radiusKm=10',
      { headers },
    );
    expect(jaffna.body.radiusKm).toBe(450);
    expect(jaffna.body.activities[0]!.distanceKm).toBeGreaterThan(250);

    const unknown = await t.call('/v1/activities?placeId=999999', { headers });
    expect(unknown.status).toBe(400);
  });

  it('rejects invalid query values with field details', async () => {
    const { headers } = await t.signIn();
    const res = await t.call('/v1/activities?filter=Nope', { headers });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: { code: 'validation_error', details: { issues: [{ path: 'filter' }] } },
    });
  });
});

describe('activity detail', () => {
  it('includes description, host stats and attendees with the host first', async () => {
    const { headers } = await t.signIn();
    const feed = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', { headers });
    const run = feed.body.activities.find((a) => a.title.startsWith('Saturday 10K'))!;

    const res = await t.call<ActivityDetail>(`/v1/activities/${run.id}`, { headers });
    expect(res.status).toBe(200);
    expect(res.body.description).toContain('Two loops');
    expect(res.body.host).toMatchObject({ name: 'Nethmi', hostedCount: 2 });
    expect(res.body.attendees).toHaveLength(5);
    expect(res.body.attendees[0]!.name).toBe('Nethmi');
  });

  it('rejects malformed ids with a validation error', async () => {
    const { headers } = await t.signIn();
    const res = await t.call('/v1/activities/not-a-uuid', { headers });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'validation_error' } });
  });

  it('returns 404 for an unknown activity', async () => {
    const { headers } = await t.signIn();
    const res = await t.call(`/v1/activities/00000000-0000-4000-8000-000000000000`, { headers });
    expect(res.status).toBe(404);
  });
});
