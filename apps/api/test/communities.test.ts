import type { ActivityDetail, CommunityDetail, CommunitySummary } from '@buddy/shared';
import { atLocalTime } from '@buddy/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { reports } from '../src/db/schema';
import { memoryStorage, useTestApp } from './harness';

const r2 = memoryStorage();
const t = useTestApp({ storage: r2.storage, env: { R2_PUBLIC_URL: 'https://img.example.com' } });

const start = (headers: Record<string, string>, body: object) =>
  t.call<CommunityDetail>('/v1/communities', { method: 'POST', headers, body });

describe('starting a community', () => {
  it('creates it with the creator as its first member, able to edit it', async () => {
    const me = await t.signIn('new@buddy.test', 'Nimal');
    const cover = `covers/${me.userId}/0b6c1c44-6a1e-4e2b-9c43-2a3b4c5d6e7f.jpg`;
    r2.upload(cover);
    const res = await start(me.headers, {
      name: '  Galle Fort Sketchers ',
      about: 'Drawing the fort on Sunday mornings.',
      rules: ['Bring your own paper'],
      coverKey: cover,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Galle Fort Sketchers',
      about: 'Drawing the fort on Sunday mornings.',
      rules: ['Bring your own paper'],
      coverUrl: `https://img.example.com/${cover}`,
      memberCount: 1,
      joined: true,
      isCreator: true,
    });

    // Everyone else sees it, but can't edit it.
    const other = await t.signIn();
    const seen = await t.call<CommunityDetail>(`/v1/communities/${res.body.id}`, {
      headers: other.headers,
    });
    expect(seen.body).toMatchObject({ joined: false, isCreator: false });
    const edit = await t.call(`/v1/communities/${res.body.id}`, {
      method: 'PATCH',
      headers: other.headers,
      body: { name: 'Mine now' },
    });
    expect(edit.status).toBe(403);
  });

  it('refuses a name that is already taken, whatever the capitals', async () => {
    const me = await t.signIn();
    const res = await start(me.headers, { name: 'colombo RUNNERS' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: { message: 'There’s already a community with that name.' },
    });
  });

  it('checks the name, the rules and the cover', async () => {
    const me = await t.signIn();
    expect((await start(me.headers, { name: 'ab' })).status).toBe(400);
    expect(
      (await start(me.headers, { name: 'Too many rules', rules: ['a', 'b', 'c', 'd', 'e', 'f'] }))
        .status,
    ).toBe(400);
    const theirs = await start(me.headers, { name: 'Not my photo', coverKey: 'covers/x/y.jpg' });
    expect(theirs.status).toBe(403);
  });

  it('lets the creator rename it, change the details and remove the cover', async () => {
    const me = await t.signIn('maker@buddy.test', 'Dilan');
    const { body } = await start(me.headers, { name: 'Kandy Lake Walkers' });
    const res = await t.call<CommunityDetail>(`/v1/communities/${body.id}`, {
      method: 'PATCH',
      headers: me.headers,
      body: { name: 'Kandy Lake Walks', about: 'Evening loops of the lake.', coverKey: null },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Kandy Lake Walks',
      about: 'Evening loops of the lake.',
      coverUrl: null,
    });
    const clash = await t.call(`/v1/communities/${body.id}`, {
      method: 'PATCH',
      headers: me.headers,
      body: { name: 'Colombo Runners' },
    });
    expect(clash.status).toBe(409);
  });
});

describe('activities in a community', () => {
  const activity = (communityId: string) => ({
    title: 'Morning loop',
    group: 'Sports',
    startsAt: atLocalTime(2, '06:30').toISOString(),
    place: 'Viharamahadevi Park',
    capacity: 8,
    communityId,
  });

  it('can be posted by members and shows up on the community', async () => {
    const me = await t.signIn();
    const list = await t.call<{ communities: CommunitySummary[] }>('/v1/communities', {
      headers: me.headers,
    });
    const notMine = list.body.communities.find((c) => !c.joined)!;
    const refused = await t.call('/v1/activities', {
      method: 'POST',
      headers: me.headers,
      body: activity(notMine.id),
    });
    expect(refused.status).toBe(403);

    const mine = list.body.communities.find((c) => c.joined)!;
    const res = await t.call<ActivityDetail>('/v1/activities', {
      method: 'POST',
      headers: me.headers,
      body: activity(mine.id),
    });
    expect(res.status).toBe(201);
    expect(res.body.community).toEqual({ id: mine.id, name: mine.name });
    const detail = await t.call<CommunityDetail>(`/v1/communities/${mine.id}`, {
      headers: me.headers,
    });
    expect(detail.body.upcoming.map((a) => a.id)).toContain(res.body.id);
    expect(detail.body.weeklyActivityCount).toBe(mine.weeklyActivityCount + 1);
  });
});

describe('reporting a community', () => {
  it('files a report against whoever started it', async () => {
    const maker = await t.signIn('reported@buddy.test', 'Saman');
    const { body } = await start(maker.headers, { name: 'Totally Real Giveaways' });
    const reporter = await t.signIn();
    const res = await t.call('/v1/reports', {
      method: 'POST',
      headers: reporter.headers,
      body: { reason: 'spam', communityId: body.id },
    });
    expect(res.status).toBe(201);
    const [row] = await t.deps.db.select().from(reports).where(eq(reports.communityId, body.id));
    expect(row).toMatchObject({ targetUserId: maker.userId, reason: 'spam' });
  });
});
