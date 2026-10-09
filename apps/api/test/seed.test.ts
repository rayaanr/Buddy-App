import type {
  ActivityDetail,
  ActivitySummary,
  CommunitySummary,
  MessagesPage,
  MyActivity,
  Pick,
} from '@buddy/shared';
import { describe, expect, it } from 'vitest';

import { seed } from '../scripts/seed/index';
import { useTestApp } from './harness';

const t = useTestApp();

/** The demo layer is what `npm run db:seed` loads for local testing. */
describe('demo seed', () => {
  it('gives the demo user something on every screen', async () => {
    const counts = await seed(t.deps.db, { demo: true });
    expect(counts).toEqual({ users: 16, communities: 6, activities: 21 });

    const { headers } = await t.signIn();
    const get = async <T>(path: string) => (await t.call<T>(path, { headers })).body;

    const feed = (await get<{ activities: ActivitySummary[] }>('/v1/activities')).activities;
    expect(feed).toHaveLength(18); // 21 minus three past ones
    expect(new Set(feed.map((a) => a.area)).size).toBeGreaterThanOrEqual(8);

    const hosting = (await get<{ activities: MyActivity[] }>('/v1/activities/mine?role=hosting'))
      .activities;
    expect(hosting.map((a) => a.title)).toEqual(['Wingspan and coffee']);
    expect(hosting[0]!.lastMessage).toMatchObject({ senderName: 'Ishara' });

    const joined = (await get<{ activities: MyActivity[] }>('/v1/activities/mine?role=joined'))
      .activities;
    expect(joined.map((a) => a.title).sort()).toEqual([
      'Crag day trip to Kandy',
      'Padel doubles, need one more',
    ]);

    const history = (await get<{ activities: ActivitySummary[] }>('/v1/activities/history'))
      .activities;
    expect(history.map((a) => a.title)).toEqual([
      'Sunset 5K at Galle Face',
      'Catan night',
      'Intro to bouldering',
    ]);

    const yoga = feed.find((a) => a.title.startsWith('Sunrise yoga'))!;
    expect(yoga).toMatchObject({ goingCount: 6, capacity: 6, viewer: { joined: false } });
    const full = await t.call(`/v1/activities/${yoga.id}/membership`, { method: 'POST', headers });
    expect(full.status).toBe(409);

    const picks = await get<{ picks: Pick[] }>('/v1/activities/picks');
    expect(picks.picks.length).toBeGreaterThan(0);

    const communities = (await get<{ communities: CommunitySummary[] }>('/v1/communities'))
      .communities;
    expect(communities.filter((c) => c.joined).map((c) => c.name)).toHaveLength(3);
  });

  it('shows your messages as seen once someone has read past them', async () => {
    await seed(t.deps.db, { demo: true });
    const { headers } = await t.signIn();
    const feed = await t.call<{ activities: MyActivity[] }>('/v1/activities/mine?role=joined', {
      headers,
    });
    const crag = feed.body.activities.find((a) => a.title.startsWith('Crag'))!;
    const detail = await t.call<ActivityDetail>(`/v1/activities/${crag.id}`, { headers });
    expect(detail.body.goingCount).toBe(6);

    const chat = await t.call<MessagesPage>(`/v1/activities/${crag.id}/chat/messages`, {
      headers,
    });
    expect(chat.status).toBe(200);
    const mine = chat.body.messages.filter((m) => m.sender?.name === 'Kavindu Perera');
    expect(mine).toHaveLength(1);
    // Others wrote after Kavindu, so they've read past his message.
    expect(chat.body.othersReadUpTo! >= mine[0]!.createdAt).toBe(true);
  });
});
