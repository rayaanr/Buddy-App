import type { ActivityDetail, ActivityMember, ActivitySummary, UserSummary } from '@buddy/shared';
import { and, desc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { activities, activityMembers, messages, user } from '../src/db/schema';
import type { PushMessage } from '../src/lib/push';
import { useTestApp } from './harness';

const toUsers: { userIds: string[]; message: PushMessage }[] = [];
const t = useTestApp({
  push: {
    async notifyActivity() {},
    async notifyUsers(userIds, message) {
      toUsers.push({ userIds, message });
    },
  },
});

type Headers = Record<string, string>;

/** Padel (hosted by Shehani, Kavindu going), made full. */
async function full(headers: Headers) {
  const res = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', { headers });
  const padel = res.body.activities.find((a) => a.title.startsWith('Padel'))!;
  await t.deps.db
    .update(activities)
    .set({ capacity: padel.goingCount })
    .where(eq(activities.id, padel.id));
  return { ...padel, capacity: padel.goingCount };
}
const detail = (id: string, headers: Headers) =>
  t.call<ActivityDetail>(`/v1/activities/${id}`, { headers }).then((r) => r.body);
const wait = (id: string, headers: Headers) =>
  t.call<ActivityDetail>(`/v1/activities/${id}/waitlist`, { method: 'POST', headers });
const person = (n: number) => t.signIn(`waiter${n}@buddy.test`, `Waiter${n} Test`);

/** Signs in as one of the activity's guests. */
async function aGuest(activityId: string) {
  const [row] = await t.deps.db
    .select({ email: user.email })
    .from(activityMembers)
    .innerJoin(user, eq(user.id, activityMembers.userId))
    .where(and(eq(activityMembers.activityId, activityId), eq(activityMembers.role, 'guest')))
    .limit(1);
  return t.signIn(row!.email);
}

describe('waitlist', () => {
  it('queues people in order on a full activity; joining outright stays refused', async () => {
    const first = await person(1);
    const second = await person(2);
    const { id, goingCount, capacity } = await full(first.headers);
    expect(goingCount).toBe(capacity);

    const res = await wait(id, first.headers);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      waitingCount: 1,
      goingCount,
      viewer: { joined: false, waitlistPosition: 1 },
    });
    await wait(id, first.headers); // repeat: no-op
    expect((await wait(id, second.headers)).body).toMatchObject({
      waitingCount: 2,
      viewer: { waitlistPosition: 2 },
    });

    const join = await t.call<{ error: { code: string } }>(`/v1/activities/${id}/membership`, {
      method: 'POST',
      headers: second.headers,
    });
    expect(join.body.error.code).toBe('activity_full');

    const members = await t.call<{ members: ActivityMember[]; waitlist: UserSummary[] }>(
      `/v1/activities/${id}/members`,
      { headers: first.headers },
    );
    expect(members.body.waitlist.map((w) => w.id)).toEqual([first.userId, second.userId]);
    expect(members.body.members).toHaveLength(goingCount);
  });

  it('moves the first in line in when someone leaves, and tells them', async () => {
    toUsers.length = 0;
    const first = await person(1);
    const second = await person(2);
    const { id } = await full(first.headers);
    await wait(id, first.headers);
    await wait(id, second.headers);

    const leaver = await aGuest(id);
    await t.call(`/v1/activities/${id}/membership`, { method: 'DELETE', headers: leaver.headers });

    expect(await detail(id, first.headers)).toMatchObject({
      viewer: { joined: true, waitlistPosition: null },
      waitingCount: 1,
    });
    expect((await detail(id, second.headers)).viewer.waitlistPosition).toBe(1);
    // Same transaction, still in order.
    const lines = await t.deps.db
      .select({ body: messages.body })
      .from(messages)
      .where(eq(messages.activityId, id))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(2);
    expect(lines.map((l) => l.body)).toEqual([
      'Waiter1 joined from the waitlist',
      expect.stringMatching(/ left$/),
    ]);
    expect(toUsers).toEqual([
      {
        userIds: [first.userId],
        message: expect.objectContaining({
          title: expect.stringMatching(/^You’re in: Padel/),
          data: { activityId: id, screen: 'chat' },
        }),
      },
    ]);
  });

  it('moves people in when the host adds spots', async () => {
    const a = await person(1);
    const b = await person(2);
    const c = await person(3);
    const { id, capacity, host } = await full(a.headers);
    for (const p of [a, b, c]) await wait(id, p.headers);

    const [row] = await t.deps.db.select().from(user).where(eq(user.id, host.id));
    const hosting = await t.signIn(row!.email);
    const res = await t.call<ActivityDetail>(`/v1/activities/${id}`, {
      method: 'PATCH',
      headers: hosting.headers,
      body: { capacity: capacity + 2 },
    });
    expect(res.body).toMatchObject({ goingCount: capacity + 2, waitingCount: 1 });
    expect((await detail(id, c.headers)).viewer.waitlistPosition).toBe(1);
  });

  it('caps the waitlist, joins directly when a spot is free, and lets people leave it', async () => {
    const { id } = await full((await t.signIn()).headers);
    for (let n = 1; n <= 10; n++) await wait(id, (await person(n)).headers);
    const eleventh = await wait(id, (await person(11)).headers);
    expect(eleventh.status).toBe(409);
    expect((eleventh.body as unknown as { error: { code: string } }).error.code).toBe(
      'waitlist_full',
    );

    const tenth = await person(10);
    const left = await t.call<ActivityDetail>(`/v1/activities/${id}/waitlist`, {
      method: 'DELETE',
      headers: tenth.headers,
    });
    expect(left.body).toMatchObject({ waitingCount: 9, viewer: { waitlistPosition: null } });

    // Not full: "joining the waitlist" just joins.
    const open = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', {
      headers: tenth.headers,
    });
    const roomy = open.body.activities.find((a) => a.goingCount < a.capacity && !a.viewer.joined)!;
    expect((await wait(roomy.id, tenth.headers)).body.viewer).toMatchObject({
      joined: true,
      waitlistPosition: null,
    });
  });

  it('clears the waitlist and tells those people when the host cancels', async () => {
    toUsers.length = 0;
    const waiting = await person(1);
    const { id, host } = await full(waiting.headers);
    await wait(id, waiting.headers);
    const [row] = await t.deps.db.select().from(user).where(eq(user.id, host.id));
    const hosting = await t.signIn(row!.email);
    const res = await t.call<ActivityDetail>(`/v1/activities/${id}/cancel`, {
      method: 'POST',
      headers: hosting.headers,
    });
    expect(res.body.waitingCount).toBe(0);
    expect(toUsers).toEqual([
      {
        userIds: [waiting.userId],
        message: expect.objectContaining({ title: expect.stringMatching(/^Cancelled: Padel/) }),
      },
    ]);
  });
});
