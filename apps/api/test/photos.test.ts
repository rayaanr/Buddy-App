import type { ActivityDetail, CommunityDetail } from '@buddy/shared';
import { atLocalTime } from '@buddy/shared';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { activities } from '../src/db/schema';
import { memoryStorage, useTestApp } from './harness';

const r2 = memoryStorage();
const PUBLIC = 'https://img.example.com';
const t = useTestApp({ storage: r2.storage, env: { R2_PUBLIC_URL: PUBLIC } });

/** A file this person "uploaded". */
const uploaded = (folder: 'avatars' | 'covers' | 'logos', userId: string) => {
  const key = `${folder}/${userId}/${randomUUID()}.jpg`;
  r2.upload(key);
  return key;
};

describe('old photos', () => {
  it('a replaced profile photo is deleted', async () => {
    const me = await t.signIn('pics@buddy.test', 'Pics');
    const first = uploaded('avatars', me.userId);
    const second = uploaded('avatars', me.userId);
    await t.call('/v1/me', { method: 'PATCH', headers: me.headers, body: { avatarKey: first } });
    await t.call('/v1/me', { method: 'PATCH', headers: me.headers, body: { avatarKey: second } });
    expect(r2.removed).toContain(first);
    expect(r2.removed).not.toContain(second);
  });

  it('a replaced cover is deleted, unless another week of the activity still shows it', async () => {
    const host = await t.signIn('host@buddy.test', 'Host');
    const cover = uploaded('covers', host.userId);
    const created = await t.call<ActivityDetail>('/v1/activities', {
      method: 'POST',
      headers: host.headers,
      body: {
        title: 'Sunday swim',
        group: 'Sports',
        startsAt: atLocalTime(2, '07:00').toISOString(),
        place: 'Mount Lavinia beach',
        capacity: 8,
        coverKey: cover,
      },
    });
    // Pretend next week's copy already exists with the same cover.
    const [row] = await t.deps.db
      .select()
      .from(activities)
      .where(eq(activities.id, created.body.id));
    await t.deps.db.insert(activities).values({
      ...row!,
      id: randomUUID(),
      startsAt: new Date(row!.startsAt.getTime() + 7 * 86_400_000),
    });

    await t.call(`/v1/activities/${created.body.id}`, {
      method: 'PATCH',
      headers: host.headers,
      body: { coverKey: null },
    });
    expect(r2.removed).not.toContain(cover);

    // Once nothing shows it, it goes.
    await t.deps.db
      .update(activities)
      .set({ coverUrl: null })
      .where(eq(activities.coverUrl, `${PUBLIC}/${cover}`));
    const other = await t.call<ActivityDetail>('/v1/activities', {
      method: 'POST',
      headers: host.headers,
      body: {
        title: 'Sunset swim',
        group: 'Sports',
        startsAt: atLocalTime(3, '17:30').toISOString(),
        place: 'Mount Lavinia beach',
        capacity: 8,
        coverKey: uploaded('covers', host.userId),
      },
    });
    const replaced = other.body.coverUrl!.slice(PUBLIC.length + 1);
    await t.call(`/v1/activities/${other.body.id}`, {
      method: 'PATCH',
      headers: host.headers,
      body: { coverKey: uploaded('covers', host.userId) },
    });
    expect(r2.removed).toContain(replaced);
  });

  it('a deleted community takes its cover and logo with it', async () => {
    const maker = await t.signIn('maker@buddy.test', 'Maker');
    const cover = uploaded('covers', maker.userId);
    const logo = uploaded('logos', maker.userId);
    const { body } = await t.call<CommunityDetail>('/v1/communities', {
      method: 'POST',
      headers: maker.headers,
      body: { name: `Photo Walkers ${Date.now()}`, coverKey: cover, logoKey: logo },
    });
    await t.call(`/v1/communities/${body.id}`, { method: 'DELETE', headers: maker.headers });
    expect(r2.removed).toEqual(expect.arrayContaining([cover, logo]));
  });
});
