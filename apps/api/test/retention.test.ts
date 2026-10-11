import { RETENTION } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { pruneChats } from '../src/jobs/retention';
import { activities, communities, messages, pollVotes, reports, user } from '../src/db/schema';
import { memoryStorage, useTestApp } from './harness';

const r2 = memoryStorage();
const t = useTestApp({ storage: r2.storage, env: { R2_PUBLIC_URL: 'https://img.example.com' } });
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

async function someone() {
  const [row] = await t.deps.db.select({ id: user.id }).from(user).limit(1);
  return row!.id;
}

const ids = async (where: ReturnType<typeof eq>) =>
  (await t.deps.db.select({ id: messages.id }).from(messages).where(where)).map((r) => r.id);

describe('chat retention', () => {
  it('deletes an activity’s chat a month after it, unless a message is reported', async () => {
    const { db } = t.deps;
    const senderId = await someone();
    const [old] = await db.select().from(activities).limit(1);
    await db
      .update(activities)
      .set({ startsAt: daysAgo(RETENTION.activityChatDays + 1) })
      .where(eq(activities.id, old!.id));
    const photo = `chat/${senderId}/${randomUUID()}.jpg`;
    r2.upload(photo);
    const [plain, withPhoto, reported] = [randomUUID(), randomUUID(), randomUUID()];
    await db.insert(messages).values([
      { id: plain, activityId: old!.id, senderId, body: 'Thanks all' },
      {
        id: withPhoto,
        activityId: old!.id,
        senderId,
        body: '',
        imageKey: photo,
        imageWidth: 4,
        imageHeight: 3,
      },
      { id: reported, activityId: old!.id, senderId, body: 'Rude' },
    ]);
    await db
      .insert(reports)
      .values({ messageId: reported, reason: 'harassment', targetUserId: senderId });

    const done = await pruneChats(t.deps);
    expect(done.activityMessages).toBeGreaterThanOrEqual(2);
    expect(await ids(eq(messages.activityId, old!.id))).toEqual([reported]);
    expect(r2.removed).toContain(photo);
  });

  it('keeps a community’s last 90 days, or its last 1,000 messages', async () => {
    const { db } = t.deps;
    const senderId = await someone();
    const [c] = await db.select({ id: communities.id }).from(communities).limit(1);
    const old = (k: number) => ({
      id: randomUUID(),
      communityId: c!.id,
      senderId,
      body: `old ${k}`,
      createdAt: new Date(daysAgo(RETENTION.communityChatDays + 1).getTime() - k * 1000),
    });
    // Few messages: even old ones stay.
    await db.insert(messages).values([old(1), old(2)]);
    await pruneChats(t.deps);
    expect(await ids(eq(messages.communityId, c!.id))).toHaveLength(2);

    // Over the cap: the oldest beyond it go; recent ones always stay.
    const many = Array.from({ length: RETENTION.communityChatKeep }, (_, k) => old(k + 3));
    await db.insert(messages).values(many);
    await db
      .insert(messages)
      .values({ id: randomUUID(), communityId: c!.id, senderId, body: 'new' });
    await pruneChats(t.deps);
    const left = await db
      .select({ body: messages.body })
      .from(messages)
      .where(eq(messages.communityId, c!.id));
    expect(left).toHaveLength(RETENTION.communityChatKeep);
    expect(left.some((m) => m.body === 'new')).toBe(true);
    expect(left.some((m) => m.body === `old ${RETENTION.communityChatKeep + 2}`)).toBe(false);
  });

  it('expires old chat photos but keeps the message', async () => {
    const { db } = t.deps;
    const senderId = await someone();
    const [c] = await db.select({ id: communities.id }).from(communities).limit(1);
    const [oldPhoto, newPhoto] = [
      `chat/${senderId}/${randomUUID()}.jpg`,
      `chat/${senderId}/${randomUUID()}.jpg`,
    ];
    const [a, b] = [randomUUID(), randomUUID()];
    await db.insert(messages).values([
      {
        id: a,
        communityId: c!.id,
        senderId,
        body: 'Last month',
        imageKey: oldPhoto,
        imageWidth: 4,
        imageHeight: 3,
        createdAt: daysAgo(RETENTION.chatPhotoDays + 1),
      },
      {
        id: b,
        communityId: c!.id,
        senderId,
        body: 'Today',
        imageKey: newPhoto,
        imageWidth: 4,
        imageHeight: 3,
      },
    ]);
    await pruneChats(t.deps);
    const rows = await db
      .select({ id: messages.id, imageKey: messages.imageKey })
      .from(messages)
      .where(inArray(messages.id, [a, b]));
    expect(new Map(rows.map((r) => [r.id, r.imageKey]))).toEqual(
      new Map([
        [a, null],
        [b, newPhoto],
      ]),
    );
    expect(r2.removed).toContain(oldPhoto);
    expect(r2.removed).not.toContain(newPhoto);
    // Poll votes and the rest are untouched by photo expiry.
    expect((await db.select({ n: sql<number>`count(*)::int` }).from(pollVotes))[0]!.n).toBe(0);
  });
});
