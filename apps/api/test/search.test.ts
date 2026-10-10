import type { ActivitySummary } from '@buddy/shared';
import { atLocalTime } from '@buddy/shared';
import { describe, expect, it } from 'vitest';

import { useTestApp } from './harness';

const t = useTestApp();
type Feed = { activities: ActivitySummary[]; radiusKm: number };

const search = async (headers: Record<string, string>, query: string) =>
  (await t.call<Feed>(`/v1/activities?${query}`, { headers })).body.activities.map((a) => a.title);

describe('search on Discover', () => {
  it('matches titles, places and interests, ignoring case', async () => {
    const { headers } = await t.signIn();
    expect(await search(headers, 'q=PADEL')).toContain('Padel doubles, need one more');
    const byPlace = await t.call<Feed>('/v1/activities?q=galle%20face', { headers });
    expect(byPlace.body.activities.length).toBeGreaterThan(0);
    for (const a of byPlace.body.activities) {
      expect(`${a.title} ${a.place}`.toLowerCase()).toContain('galle face');
    }
  });

  it('looks across the island, nearest first', async () => {
    const host = await t.signIn('far@buddy.test', 'Far');
    await t.call('/v1/activities', {
      method: 'POST',
      headers: host.headers,
      body: {
        title: 'Jaffna kayak paddle',
        group: 'Sports',
        startsAt: atLocalTime(2, '07:00').toISOString(),
        place: 'Jaffna lagoon',
        location: { lat: 9.66, lng: 80.02 },
        capacity: 6,
      },
    });
    const { headers } = await t.signIn();
    // From Colombo, 300 km away, and well outside the 10 km radius.
    expect(await search(headers, 'q=kayak&radiusKm=10')).toEqual(['Jaffna kayak paddle']);
  });

  it('treats % and _ as plain characters, and needs two letters', async () => {
    const { headers } = await t.signIn();
    expect(await search(headers, 'q=%25%25')).toEqual([]);
    expect((await t.call(`/v1/activities?q=a`, { headers })).status).toBe(400);
  });
});
