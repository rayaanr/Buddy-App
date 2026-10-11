import type { ActivityDetail } from '@buddy/shared';
import { atLocalTime } from '@buddy/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { activities, activityMembers, activityRemovals } from '../src/db/schema';
import { extendSeries } from '../src/jobs/series';
import type { PushMessage } from '../src/lib/push';
import { useTestApp } from './harness';

const pushed: { activityId: string; message: PushMessage }[] = [];
const push = {
  async notifyActivity(activityId: string, message: PushMessage) {
    pushed.push({ activityId, message });
  },
  async notifyUsers() {},
};
const t = useTestApp({ push });
const run = () => extendSeries({ db: t.deps.db, push });

async function weekly(headers: Record<string, string>, repeatsWeekly = true) {
  const res = await t.call<ActivityDetail>('/v1/activities', {
    method: 'POST',
    headers,
    body: {
      title: 'Saturday run',
      group: 'Running',
      startsAt: atLocalTime(1, '06:00').toISOString(),
      place: 'Galle Face Green',
      area: 'Colombo 03',
      capacity: 10,
      repeatsWeekly,
    },
  });
  return res.body;
}
/** Pretend it started `ago` ago (SQL interval). */
const startedAgo = (id: string, ago: string) =>
  t.deps.db
    .update(activities)
    .set({ startsAt: sql`now() - ${sql.raw(`interval '${ago}'`)}` })
    .where(eq(activities.id, id));
const series = async (id: string) => {
  const [row] = await t.deps.db
    .select({ seriesId: activities.seriesId })
    .from(activities)
    .where(eq(activities.id, id));
  return t.deps.db
    .select()
    .from(activities)
    .where(eq(activities.seriesId, row!.seriesId!))
    .orderBy(asc(activities.startsAt));
};

describe('weekly activities', () => {
  it('posts next week’s once this one starts, once, with the host and a heads-up', async () => {
    pushed.length = 0;
    const host = await t.signIn();
    const first = await weekly(host.headers);
    expect(first.repeatsWeekly).toBe(true);

    expect((await run()).posted).toBe(0); // not started yet
    await startedAgo(first.id, '10 minutes');
    await run();
    await run();

    const all = await series(first.id);
    expect(all).toHaveLength(2);
    const [, next] = all;
    expect(next!.startsAt.getTime() - all[0]!.startsAt.getTime()).toBe(7 * 86_400_000);
    expect(next).toMatchObject({ title: 'Saturday run', capacity: 10, repeatsWeekly: true });
    const members = await t.deps.db
      .select({ userId: activityMembers.userId, role: activityMembers.role })
      .from(activityMembers)
      .where(eq(activityMembers.activityId, next!.id));
    expect(members).toEqual([{ userId: host.userId, role: 'host' }]);
    expect(pushed).toEqual([
      {
        activityId: first.id,
        message: expect.objectContaining({
          title: 'Saturday run is on again',
          data: { activityId: next!.id },
        }),
      },
    ]);
  });

  it('carries the host’s edits and removals forward, and skips weeks it missed', async () => {
    const host = await t.signIn();
    const guest = await t.signIn('nethmi@buddy.test');
    const first = await weekly(host.headers);
    await t.call(`/v1/activities/${first.id}`, {
      method: 'PATCH',
      headers: host.headers,
      body: { title: 'Saturday 5K', capacity: 12 },
    });
    await t.call(`/v1/activities/${first.id}/membership`, {
      method: 'POST',
      headers: guest.headers,
    });
    await t.call(`/v1/activities/${first.id}/members/${guest.userId}/remove`, {
      method: 'POST',
      headers: host.headers,
      body: { reason: 'behaviour' },
    });
    await startedAgo(first.id, '20 days');
    await run();

    const [, next] = await series(first.id);
    expect(next).toMatchObject({ title: 'Saturday 5K', capacity: 12 });
    expect(next!.startsAt.getTime()).toBeGreaterThan(Date.now());
    expect(next!.startsAt.getTime()).toBeLessThan(Date.now() + 7 * 86_400_000);
    const removed = await t.deps.db
      .select()
      .from(activityRemovals)
      .where(
        and(eq(activityRemovals.activityId, next!.id), eq(activityRemovals.userId, guest.userId)),
      );
    expect(removed).toHaveLength(1);
  });

  it('stops when the host turns repeating off, and can be turned on later', async () => {
    const host = await t.signIn();
    const once = await weekly(host.headers, false);
    expect(once.repeatsWeekly).toBe(false);
    const on = await t.call<ActivityDetail>(`/v1/activities/${once.id}`, {
      method: 'PATCH',
      headers: host.headers,
      body: { repeatsWeekly: true },
    });
    expect(on.body).toMatchObject({ repeatsWeekly: true });
    const off = await t.call<ActivityDetail>(`/v1/activities/${once.id}`, {
      method: 'PATCH',
      headers: host.headers,
      body: { repeatsWeekly: false },
    });
    expect(off.body.repeatsWeekly).toBe(false);
    await startedAgo(once.id, '10 minutes');
    await run();
    expect(await series(once.id)).toHaveLength(1);
  });

  it('cancelling one week keeps the series; cancelling with stop ends it', async () => {
    const host = await t.signIn();
    const cancel = (id: string, stopRepeating: boolean) =>
      t.call<ActivityDetail>(`/v1/activities/${id}/cancel`, {
        method: 'POST',
        headers: host.headers,
        body: { stopRepeating },
      });

    const thisWeekOnly = await weekly(host.headers);
    await cancel(thisWeekOnly.id, false);
    await startedAgo(thisWeekOnly.id, '10 minutes');
    await run();
    const kept = await series(thisWeekOnly.id);
    expect(kept).toHaveLength(2);
    expect(kept[1]!.cancelledAt).toBeNull();

    const stopped = await weekly(host.headers);
    const res = await cancel(stopped.id, true);
    expect(res.body).toMatchObject({ cancelled: true, repeatsWeekly: false });
    await startedAgo(stopped.id, '10 minutes');
    await run();
    expect(await series(stopped.id)).toHaveLength(1);
  });

  it('a guest removed on the day stays out of next week’s too', async () => {
    const host = await t.signIn();
    const guest = await t.signIn('trouble@buddy.test', 'Trouble');
    const first = await weekly(host.headers);
    await t.call(`/v1/activities/${first.id}/membership`, {
      method: 'POST',
      headers: guest.headers,
    });
    await startedAgo(first.id, '10 minutes');
    await run();
    const [, next] = await series(first.id);
    // They'd already signed up for next week as well.
    await t.call(`/v1/activities/${next!.id}/membership`, {
      method: 'POST',
      headers: guest.headers,
    });

    const res = await t.call(`/v1/activities/${first.id}/members/${guest.userId}/remove`, {
      method: 'POST',
      headers: host.headers,
      body: { reason: 'behaviour' },
    });
    expect(res.status).toBe(200);
    const going = await t.deps.db
      .select()
      .from(activityMembers)
      .where(
        and(eq(activityMembers.activityId, next!.id), eq(activityMembers.userId, guest.userId)),
      );
    expect(going).toEqual([]);
    const join = await t.call(`/v1/activities/${next!.id}/membership`, {
      method: 'POST',
      headers: guest.headers,
    });
    expect(join.status).not.toBe(200);
  });
});
