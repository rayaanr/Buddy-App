import type { ActivityDetail, ChatPreview, CommunityDetail, Me } from '@buddy/shared';
import { atLocalTime, FALLBACK_ART } from '@buddy/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { activities } from '../src/db/schema';
import { fillMissingPictures } from '../src/jobs/pictures';
import { useTestApp } from './harness';

const t = useTestApp();
type Headers = Record<string, string>;
const art = (url: string | null | undefined) =>
  /\/fallbacks\/([a-z0-9-]+)\.svg$/.exec(url ?? '')?.[1];

const host = (headers: Headers, body: object) =>
  t.call<ActivityDetail>('/v1/activities', {
    method: 'POST',
    headers,
    body: {
      title: 'Evening meetup',
      group: 'Social',
      startsAt: atLocalTime(2, '18:30').toISOString(),
      place: 'Barefoot Café',
      location: { lat: 6.8985, lng: 79.8555 },
      capacity: 6,
      ...body,
    },
  });

describe('the pictures themselves', () => {
  it('serves each as SVG, and nothing else', async () => {
    const res = await t.app.request('/fallbacks/man-01.svg');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(await res.text()).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    for (const path of ['/fallbacks/nope.svg', '/fallbacks/man-01.png', '/fallbacks/../x.svg']) {
      expect((await t.app.request(path)).status).toBe(404);
    }
  });
});

describe('avatars', () => {
  it('come from the set for your gender, picked by you or by us', async () => {
    const me = await t.signIn('newcomer@buddy.test', 'Newcomer');
    const get = async () => (await t.call<Me>('/v1/me', { headers: me.headers })).body;
    // Before saying a gender: one of the animals.
    expect(art((await get()).avatarUrl)).toMatch(/^other-/);

    const patch = (body: object) =>
      t.call<Me>('/v1/me', { method: 'PATCH', headers: me.headers, body });
    expect(art((await patch({ gender: 'man' })).body.avatarUrl)).toMatch(/^man-/);
    expect(art((await patch({ avatarKey: 'art:man-03' })).body.avatarUrl)).toBe('man-03');
    // Only from your own set.
    expect((await patch({ avatarKey: 'art:woman-01' })).status).toBe(400);
    // A new gender swaps it for one of the new set.
    expect(art((await patch({ gender: 'woman' })).body.avatarUrl)).toMatch(/^woman-/);
  });
});

describe('activity covers', () => {
  it('match words in the title, across types; otherwise one of its type', async () => {
    const me = await t.signIn();
    const padel = await host(me.headers, { title: 'Padel doubles after work' });
    expect(art(padel.body.coverUrl)).toBe('activity-sports-03');
    const plain = await host(me.headers, { title: 'Evening meetup', group: 'Creative' });
    expect(FALLBACK_ART.activityCover.Creative).toContain(art(plain.body.coverUrl));
    // The same activity always gets the same one.
    const again = await t.call<ActivityDetail>(`/v1/activities/${plain.body.id}`, {
      headers: me.headers,
    });
    expect(again.body.coverUrl).toBe(plain.body.coverUrl);
  });

  it('can be picked from any type, but only ours', async () => {
    const me = await t.signIn();
    const picked = await host(me.headers, { coverKey: 'art:activity-food-06' });
    expect(art(picked.body.coverUrl)).toBe('activity-food-06');
    expect((await host(me.headers, { coverKey: 'art:man-01' })).status).toBe(400);
  });
});

describe('community pictures', () => {
  it('match words in its name and about, or can be picked', async () => {
    const me = await t.signIn('surfer@buddy.test', 'Surfer');
    const res = await t.call<CommunityDetail>('/v1/communities', {
      method: 'POST',
      headers: me.headers,
      body: { name: 'Arugam Bay Surfers', about: 'Dawn sessions at the point.' },
    });
    expect(res.status).toBe(201);
    expect(art(res.body.coverUrl)).toBe('cover-11');
    expect(art(res.body.logoUrl)).toBe('community-10');

    const picked = await t.call<CommunityDetail>(`/v1/communities/${res.body.id}`, {
      method: 'PATCH',
      headers: me.headers,
      body: { logoKey: 'art:community-05' },
    });
    expect(art(picked.body.logoUrl)).toBe('community-05');
    const wrong = await t.call(`/v1/communities/${res.body.id}`, {
      method: 'PATCH',
      headers: me.headers,
      body: { logoKey: 'art:cover-01' },
    });
    expect(wrong.status).toBe(400);
  });
});

describe('group chats', () => {
  it('show a group picture when the activity has no photo of its own', async () => {
    const me = await t.signIn();
    const { body: a } = await host(me.headers, { title: 'Quiz night' });
    const chats = await t.call<{ chats: ChatPreview[] }>('/v1/chats', { headers: me.headers });
    const chat = chats.body.chats.find((c) => c.id === a.id)!;
    expect(art(chat.imageUrl)).toMatch(/^group-0\d$/);
  });
});

describe('what the database holds', () => {
  it('is a path for our pictures, never a host', async () => {
    const me = await t.signIn();
    const { body: a } = await host(me.headers, { title: 'Padel doubles' });
    // The app gets a full URL…
    expect(a.coverUrl).toBe(`${t.deps.env.BETTER_AUTH_URL}/fallbacks/activity-sports-03.svg`);
    // …built from what's stored, so moving the API changes nothing in the database.
    const [row] = await t.deps.db
      .select({ coverUrl: activities.coverUrl })
      .from(activities)
      .where(eq(activities.id, a.id));
    expect(row!.coverUrl).toBe('/fallbacks/activity-sports-03.svg');
  });
});

describe('rows from before', () => {
  it('get a picture when the server starts', async () => {
    const me = await t.signIn();
    const { body: a } = await host(me.headers, { title: 'Movie night' });
    await t.deps.db.update(activities).set({ coverUrl: null }).where(eq(activities.id, a.id));
    expect(await fillMissingPictures(t.deps.db, t.deps.urls)).toBeGreaterThan(0);
    const [row] = await t.deps.db
      .select({ coverUrl: activities.coverUrl })
      .from(activities)
      .where(eq(activities.id, a.id));
    expect(art(row!.coverUrl)).toBe('activity-social-06');
  });
});
