import type { ActivityDetail, ActivitySummary } from '@buddy/shared';
import { and, desc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { activities, activityRemovals, messages } from '../src/db/schema';
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

/** Padel: hosted by Shehani, Kavindu going. */
async function setup() {
  const host = await t.signIn('shehani@buddy.test');
  const guest = await t.signIn();
  const res = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', {
    headers: host.headers,
  });
  const padel = res.body.activities.find((a) => a.title.startsWith('Padel'))!;
  const remove = (userId: string, headers = host.headers, reason = 'behaviour') =>
    t.call<ActivityDetail>(`/v1/activities/${padel.id}/members/${userId}/remove`, {
      method: 'POST',
      headers,
      body: { reason },
    });
  return { host, guest, padel, remove };
}

describe('removing a guest', () => {
  it('removes them, tells them gently, keeps the reason private, and fills the spot', async () => {
    toUsers.length = 0;
    const { guest, padel, remove } = await setup();
    // Make it full with someone waiting.
    await t.deps.db
      .update(activities)
      .set({ capacity: padel.goingCount })
      .where(eq(activities.id, padel.id));
    const waiting = await t.signIn('waiter@buddy.test', 'Waiter Test');
    await t.call(`/v1/activities/${padel.id}/waitlist`, {
      method: 'POST',
      headers: waiting.headers,
    });

    const res = await remove(guest.userId);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ goingCount: padel.goingCount, waitingCount: 0 });

    const lines = await t.deps.db
      .select({ body: messages.body })
      .from(messages)
      .where(eq(messages.activityId, padel.id))
      .orderBy(desc(messages.createdAt))
      .limit(2);
    expect(lines.map((l) => l.body)).toEqual([
      'Waiter joined from the waitlist',
      'Kavindu is no longer going',
    ]);
    const [stored] = await t.deps.db
      .select({ reason: activityRemovals.reason })
      .from(activityRemovals)
      .where(
        and(eq(activityRemovals.activityId, padel.id), eq(activityRemovals.userId, guest.userId)),
      );
    expect(stored?.reason).toBe('behaviour');
    expect(toUsers.map((p) => [p.userIds[0], p.message.title])).toEqual(
      expect.arrayContaining([
        [guest.userId, expect.stringMatching(/^You’re no longer going to Padel/)],
        [waiting.userId, expect.stringMatching(/^You’re in: Padel/)],
      ]),
    );
  });

  it('hides the activity from them and refuses rejoining', async () => {
    const { guest, padel, remove } = await setup();
    await remove(guest.userId);
    expect((await t.call(`/v1/activities/${padel.id}`, { headers: guest.headers })).status).toBe(
      404,
    );
    for (const path of ['membership', 'waitlist']) {
      const res = await t.call(`/v1/activities/${padel.id}/${path}`, {
        method: 'POST',
        headers: guest.headers,
      });
      expect(res.status).toBe(404);
    }
    const chat = await t.call(`/v1/activities/${padel.id}/chat/messages`, {
      headers: guest.headers,
    });
    expect(chat.status).not.toBe(200);
  });

  it('is for the host only, and only for people going or waiting', async () => {
    const { host, guest, remove } = await setup();
    expect((await remove(host.userId, guest.headers)).status).toBe(403);
    expect((await remove(host.userId)).status).toBe(403);
    const stranger = await t.signIn('new@buddy.test', 'Nimal');
    expect((await remove(stranger.userId)).status).toBe(404);
    expect((await remove(guest.userId, host.headers, 'rude')).status).toBe(400);
  });
});

describe('blocking a guest', () => {
  it('takes them out of the upcoming activities you host, and keeps them out', async () => {
    const { host, guest, padel } = await setup();
    toUsers.length = 0;
    const res = await t.call(`/v1/users/${guest.userId}/block`, {
      method: 'POST',
      headers: host.headers,
    });
    expect(res.status).toBe(204);

    // Gone from the padel game, and told so.
    const seen = await t.call(`/v1/activities/${padel.id}`, { headers: guest.headers });
    expect(seen.status).toBe(404);
    const [removal] = await t.deps.db
      .select()
      .from(activityRemovals)
      .where(
        and(eq(activityRemovals.activityId, padel.id), eq(activityRemovals.userId, guest.userId)),
      );
    expect(removal).toBeTruthy();
    expect(toUsers).toContainEqual(
      expect.objectContaining({
        userIds: [guest.userId],
        message: expect.objectContaining({ title: `You’re no longer going to ${padel.title}` }),
      }),
    );

    // Unblocking doesn't put them back.
    await t.call(`/v1/users/${guest.userId}/block`, { method: 'DELETE', headers: host.headers });
    const rejoin = await t.call(`/v1/activities/${padel.id}/membership`, {
      method: 'POST',
      headers: guest.headers,
    });
    expect(rejoin.status).toBe(404);
  });

  it('leaves activities someone else hosts alone', async () => {
    const { host, guest, padel } = await setup();
    // The guest blocks the host: they're the one leaving, by not going, if they want.
    await t.call(`/v1/users/${host.userId}/block`, { method: 'POST', headers: guest.headers });
    const [member] = await t.deps.db
      .select({ id: activities.id })
      .from(activities)
      .where(eq(activities.id, padel.id));
    expect(member).toBeTruthy();
    const removals = await t.deps.db
      .select()
      .from(activityRemovals)
      .where(eq(activityRemovals.activityId, padel.id));
    expect(removals).toEqual([]);
  });
});
