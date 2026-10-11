import type { ActivityDetail, Invitee } from '@buddy/shared';
import { atLocalTime } from '@buddy/shared';
import { describe, expect, it } from 'vitest';

import { activities, activityMembers } from '../src/db/schema';
import type { PushMessage } from '../src/lib/push';
import { useTestApp } from './harness';

const pushed: { userIds: string[]; message: PushMessage }[] = [];
const t = useTestApp({
  push: {
    async notifyActivity() {},
    notifyUsers: async (userIds, message) => {
      pushed.push({ userIds, message });
    },
  },
});

/** A run that already happened, with these people at it. */
async function pastRun(title: string, userIds: string[]) {
  const [row] = await t.deps.db
    .insert(activities)
    .values({
      hostId: userIds[0]!,
      title,
      category: 'RUNNING',
      group: 'Running',
      startsAt: new Date(Date.now() - 3 * 86_400_000),
      place: 'Galle Face Green',
      area: 'Colombo 3',
      placeId: 1838,
      location: { lat: 6.9271, lng: 79.845 },
      capacity: 10,
    })
    .returning({ id: activities.id });
  await t.deps.db.insert(activityMembers).values(
    userIds.map((userId, i) => ({
      activityId: row!.id,
      userId,
      role: i ? 'guest' : 'host',
      // Signed up a week before it happened.
      joinedAt: new Date(Date.now() - 10 * 86_400_000),
    })),
  );
  return row!.id;
}

async function upcoming(headers: Record<string, string>) {
  const res = await t.call<ActivityDetail>('/v1/activities', {
    method: 'POST',
    headers,
    body: {
      title: 'Evening chess',
      group: 'Social',
      startsAt: atLocalTime(1, '18:30').toISOString(),
      place: 'Barefoot Café',
      location: { lat: 6.8985, lng: 79.8555 },
      capacity: 6,
    },
  });
  return res.body.id;
}

const invitees = (id: string, headers: Record<string, string>) =>
  t.call<{ people: Invitee[] }>(`/v1/activities/${id}/invitees`, { headers });

describe('inviting people', () => {
  it('lists people you’ve been at an activity with, and invites them once', async () => {
    const host = await t.signIn('host@buddy.test', 'Kavindu Perera');
    const friend = await t.signIn('friend@buddy.test', 'Nethmi Silva');
    const stranger = await t.signIn('stranger@buddy.test', 'Ashan Fernando');
    await pastRun('Sunday long run', [host.userId, friend.userId]);
    const id = await upcoming(host.headers);

    const list = await invitees(id, host.headers);
    expect(list.status).toBe(200);
    expect(list.body.people).toEqual([
      expect.objectContaining({ id: friend.userId, met: 'Sunday long run', invited: false }),
    ]);

    pushed.length = 0;
    const sent = await t.call<{ invited: number }>(`/v1/activities/${id}/invites`, {
      method: 'POST',
      headers: host.headers,
      body: { userIds: [friend.userId, stranger.userId], note: 'Easy pace, promise!' },
    });
    expect(sent.body.invited).toBe(1);
    await (t.deps.push as { settled?: () => Promise<void> }).settled?.();
    // Only the friend: invites can't reach people you haven't met.
    expect(pushed).toEqual([
      {
        userIds: [friend.userId],
        message: expect.objectContaining({
          title: 'Kavindu invited you to Evening chess',
          body: expect.stringContaining('“Easy pace, promise!”'),
          data: { activityId: id },
        }),
      },
    ]);

    const again = await t.call<{ invited: number }>(`/v1/activities/${id}/invites`, {
      method: 'POST',
      headers: host.headers,
      body: { userIds: [friend.userId] },
    });
    expect(again.body.invited).toBe(0);
    expect((await invitees(id, host.headers)).body.people[0]!.invited).toBe(true);

    // The activity page says who invited them.
    const seen = await t.call<ActivityDetail>(`/v1/activities/${id}`, { headers: friend.headers });
    expect(seen.body.invitedBy).toMatchObject({ id: host.userId, name: 'Kavindu Perera' });
    const own = await t.call<ActivityDetail>(`/v1/activities/${id}`, { headers: host.headers });
    expect(own.body.invitedBy).toBeNull();

    // Once they join, they're not on the list any more.
    await t.call(`/v1/activities/${id}/membership`, { method: 'POST', headers: friend.headers });
    expect((await invitees(id, host.headers)).body.people).toEqual([]);
  });

  it('leaves out people who only joined once it had started', async () => {
    const host = await t.signIn('host@buddy.test', 'Kavindu Perera');
    const crasher = await t.signIn('crasher@buddy.test', 'Gate Crasher');
    const runId = await pastRun('Sunday long run', [host.userId]);
    await t.deps.db
      .insert(activityMembers)
      .values({ activityId: runId, userId: crasher.userId, role: 'guest' });
    const id = await upcoming(host.headers);
    expect((await invitees(id, host.headers)).body.people).toEqual([]);
  });

  it('leaves out people on either side of a block', async () => {
    const host = await t.signIn('host@buddy.test', 'Kavindu');
    const friend = await t.signIn('friend@buddy.test', 'Nethmi');
    await pastRun('Sunday long run', [host.userId, friend.userId]);
    const id = await upcoming(host.headers);
    await t.call(`/v1/users/${host.userId}/block`, { method: 'POST', headers: friend.headers });
    expect((await invitees(id, host.headers)).body.people).toEqual([]);
  });

  it('is only for people going', async () => {
    const host = await t.signIn('host@buddy.test', 'Kavindu');
    const other = await t.signIn('other@buddy.test', 'Nimal');
    const id = await upcoming(host.headers);
    expect((await invitees(id, other.headers)).status).toBe(403);
    const sent = await t.call(`/v1/activities/${id}/invites`, {
      method: 'POST',
      headers: other.headers,
      body: { userIds: [host.userId] },
    });
    expect(sent.status).toBe(403);
  });
});
