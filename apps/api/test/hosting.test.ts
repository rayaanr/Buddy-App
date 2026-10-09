import type { ActivityDetail, ActivitySummary, MyActivity } from '@buddy/shared';
import { atLocalTime } from '@buddy/shared';
import { and, desc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { messages } from '../src/db/schema';
import type { PushMessage } from '../src/lib/push';
import { useTestApp } from './harness';

const pushes: { activityId: string; message: PushMessage; except: string[] }[] = [];
const t = useTestApp({
  push: {
    notifyActivity: async (activityId, message, except) => {
      pushes.push({ activityId, message, except: [...except] });
    },
  },
});

type Headers = Record<string, string>;

/** Padel is hosted by Shehani; Kavindu is going. */
async function padel(headers: Headers) {
  const res = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', { headers });
  return res.body.activities.find((a) => a.title.startsWith('Padel'))!;
}
const lastLine = async (activityId: string) => {
  const [row] = await t.deps.db
    .select({ body: messages.body })
    .from(messages)
    .where(and(eq(messages.activityId, activityId), eq(messages.kind, 'system')))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return row?.body;
};

describe('editing an activity', () => {
  it('lets the host change details; a new time or place is posted and pushed', async () => {
    pushes.length = 0;
    const host = await t.signIn('shehani@buddy.test');
    const { id } = await padel(host.headers);
    const startsAt = atLocalTime(2, '17:45');

    const res = await t.call<ActivityDetail>(`/v1/activities/${id}`, {
      method: 'PATCH',
      headers: host.headers,
      body: { startsAt: startsAt.toISOString(), place: 'Court 2', title: 'Padel doubles' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'Padel doubles',
      place: 'Court 2',
      startsAt: startsAt.toISOString(),
    });
    expect(await lastLine(id)).toMatch(
      /^Shehani changed the time to \w{3} \d+ \w{3}, 17:45 and the place to Court 2$/,
    );
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({
      activityId: id,
      message: { title: 'Padel doubles', data: { activityId: id } },
      except: [host.userId],
    });
    expect(pushes[0]!.message.body).toMatch(/^Now .*17:45, at Court 2$/);
  });

  it('updates quietly when only the notes or spots change', async () => {
    pushes.length = 0;
    const host = await t.signIn('shehani@buddy.test');
    const { id } = await padel(host.headers);
    const before = await lastLine(id);
    const res = await t.call<ActivityDetail>(`/v1/activities/${id}`, {
      method: 'PATCH',
      headers: host.headers,
      body: { description: 'Rackets provided.', capacity: 6 },
    });
    expect(res.body).toMatchObject({ description: 'Rackets provided.', capacity: 6 });
    expect(await lastLine(id)).toBe(before);
    expect(pushes).toHaveLength(0);
  });

  it('keeps spots at or above the people going, and only the host can edit', async () => {
    const host = await t.signIn('shehani@buddy.test');
    const { id, goingCount } = await padel(host.headers);
    const tooFew = await t.call<{ error: { issues: { path: string }[] } }>(`/v1/activities/${id}`, {
      method: 'PATCH',
      headers: host.headers,
      body: { capacity: goingCount - 1 },
    });
    expect(tooFew.status).toBe(400);

    const guest = await t.signIn();
    const denied = await t.call(`/v1/activities/${id}`, {
      method: 'PATCH',
      headers: guest.headers,
      body: { title: 'Mine now' },
    });
    expect(denied.status).toBe(403);
  });
});

describe('cancelling an activity', () => {
  it('tells the people going, keeps it for them, and hides it from everyone else', async () => {
    pushes.length = 0;
    const host = await t.signIn('shehani@buddy.test');
    const { id } = await padel(host.headers);

    const res = await t.call<ActivityDetail>(`/v1/activities/${id}/cancel`, {
      method: 'POST',
      headers: host.headers,
    });
    expect(res.body.cancelled).toBe(true);
    expect(await lastLine(id)).toBe('Shehani cancelled this activity');
    expect(pushes[0]).toMatchObject({
      message: { title: expect.stringMatching(/^Cancelled: Padel/) },
    });

    // Kavindu was going: it stays on Your activities, marked cancelled.
    const guest = await t.signIn();
    const mine = await t.call<{ activities: MyActivity[] }>('/v1/activities/mine?role=joined', {
      headers: guest.headers,
    });
    expect(mine.body.activities.find((a) => a.id === id)).toMatchObject({ cancelled: true });
    expect(await padel(guest.headers)).toBeUndefined();

    // Someone new can't find or join it.
    const other = await t.signIn('new@buddy.test', 'Nimal');
    expect((await t.call(`/v1/activities/${id}`, { headers: other.headers })).status).toBe(404);
    const join = await t.call(`/v1/activities/${id}/membership`, {
      method: 'POST',
      headers: other.headers,
    });
    expect(join.status).toBe(409);

    // And it can't be edited or cancelled again.
    const again = await t.call(`/v1/activities/${id}/cancel`, {
      method: 'POST',
      headers: host.headers,
    });
    expect(again.status).toBe(409);
  });
});
