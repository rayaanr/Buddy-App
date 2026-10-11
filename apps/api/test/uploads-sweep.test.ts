import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { activities, profiles } from '../src/db/schema';
import { sweepUploads } from '../src/jobs/uploads';
import { createStorage } from '../src/lib/storage';
import { memoryStorage, useTestApp } from './harness';

const r2 = memoryStorage();
const t = useTestApp({ storage: r2.storage });
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe('sweeping unused uploads', () => {
  it('deletes week-old uploads nothing uses, and keeps the rest', async () => {
    const me = await t.signIn();
    const key = (folder: string) => `${folder}/${me.userId}/${randomUUID()}.jpg`;
    const abandoned = key('covers');
    const recent = key('covers');
    const avatar = key('avatars');
    const cover = key('covers');
    r2.upload(abandoned, 'image/jpeg', daysAgo(8));
    r2.upload(recent, 'image/jpeg', daysAgo(2));
    r2.upload(avatar, 'image/jpeg', daysAgo(30));
    r2.upload(cover, 'image/jpeg', daysAgo(30));
    await t.deps.db
      .update(profiles)
      .set({ avatarKey: avatar })
      .where(eq(profiles.userId, me.userId));
    const [a] = await t.deps.db.select({ id: activities.id }).from(activities).limit(1);
    await t.deps.db.update(activities).set({ coverUrl: cover }).where(eq(activities.id, a!.id));

    expect(await sweepUploads({ db: t.deps.db, storage: r2.storage })).toBe(1);
    expect(r2.removed).toContain(abandoned);
    for (const kept of [recent, avatar, cover]) expect(r2.objects.has(kept)).toBe(true);
  });
});

describe('listing R2', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads every page of the bucket listing', async () => {
    const pages = [
      `<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>next&amp;1</NextContinuationToken>
        <Contents><Key>covers/a/1.jpg</Key><LastModified>2026-01-01T00:00:00.000Z</LastModified></Contents>
        <Contents><Key>covers/a/2&amp;x.jpg</Key><LastModified>2026-01-02T00:00:00.000Z</LastModified></Contents>
      </ListBucketResult>`,
      `<ListBucketResult><IsTruncated>false</IsTruncated>
        <Contents><Key>covers/b/3.jpg</Key><LastModified>2026-01-03T00:00:00.000Z</LastModified></Contents>
      </ListBucketResult>`,
    ];
    const urls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      urls.push(input instanceof Request ? input.url : String(input));
      return new Response(pages[urls.length - 1]);
    });
    const storage = createStorage({
      ...t.deps.env,
      R2_ACCOUNT_ID: 'acct',
      R2_ACCESS_KEY_ID: 'id',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'bucket',
      R2_PUBLIC_URL: 'https://img.example.com',
    })!;
    const seen = [];
    for await (const o of storage.list('covers/')) seen.push(o);
    expect(seen.map((o) => o.key)).toEqual([
      'covers/a/1.jpg',
      'covers/a/2&x.jpg',
      'covers/b/3.jpg',
    ]);
    expect(seen[2]!.uploadedAt.toISOString()).toBe('2026-01-03T00:00:00.000Z');
    expect(urls).toHaveLength(2);
    expect(new URL(urls[1]!).searchParams.get('continuation-token')).toBe('next&1');
  });
});
