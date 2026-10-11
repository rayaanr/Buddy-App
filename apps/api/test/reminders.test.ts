import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { activities, activityMembers, user } from '../src/db/schema';
import { sendReminders } from '../src/jobs/reminders';
import type { PushMessage } from '../src/lib/push';
import { useTestApp } from './harness';

const sent: { activityId: string; message: PushMessage; except?: string[]; to?: string[] }[] = [];
const push = {
  notifyActivity: async (activityId: string, message: PushMessage, except: string[]) => {
    sent.push({ activityId, message, except });
  },
  notifyUsers: async (to: string[], message: PushMessage) => {
    sent.push({ activityId: String(message.data?.activityId), message, to });
  },
};
const t = useTestApp({ push });
const run = () => sendReminders({ db: t.deps.db, push });

/** An activity starting `startsIn` from now (SQL interval), created `createdAgo` ago. */
async function activity(title: string, startsIn: string, guests = 1, createdAgo = '1 hour') {
  const { db } = t.deps;
  const people = await db
    .select({ id: user.id })
    .from(user)
    .limit(guests + 1);
  const [row] = await db
    .insert(activities)
    .values({
      hostId: people[0]!.id,
      title,
      category: 'SOCIAL',
      group: 'Social',
      startsAt: sql`now() + ${sql.raw(`interval '${startsIn}'`)}`,
      place: 'Barefoot Café',
      area: 'Colombo 3',
      placeId: 1838, // Colombo 3
      location: { lat: 6.8985, lng: 79.8555 },
      capacity: 6,
      createdAt: sql`now() - ${sql.raw(`interval '${createdAgo}'`)}`,
    })
    .returning({ id: activities.id });
  await db.insert(activityMembers).values(
    people.map((p, i) => ({
      activityId: row!.id,
      userId: p.id,
      role: i === 0 ? ('host' as const) : ('guest' as const),
    })),
  );
  return row!.id;
}
const forActivity = (id: string) => sent.filter((s) => s.activityId === id);

describe('reminders', () => {
  it('sends "starting in an hour" once, and not for cancelled activities', async () => {
    sent.length = 0;
    const soon = await activity('Sunset swim', '50 minutes');
    const later = await activity('Late swim', '90 minutes');
    const cancelled = await activity('Called off', '30 minutes');
    await t.deps.db
      .update(activities)
      .set({ cancelledAt: new Date() })
      .where(eq(activities.id, cancelled));

    await run();
    await run();
    expect(forActivity(soon)).toHaveLength(1);
    expect(forActivity(soon)[0]!.message).toMatchObject({
      title: 'Starting in an hour: Sunset swim',
      body: expect.stringMatching(/^\d\d:\d\d at Barefoot Café\./),
      data: { activityId: soon, screen: 'chat' },
    });
    expect(forActivity(later)).toHaveLength(0);
    expect(forActivity(cancelled)).toHaveLength(0);
  });

  it('reminds the day before, only for activities posted a day or more ahead', async () => {
    sent.length = 0;
    const planned = await activity('Hike', '23 hours', 1, '3 days');
    const lastMinute = await activity('Pickup game', '20 hours', 1, '2 hours');
    const farOff = await activity('Next week', '3 days', 1, '3 days');
    await run();
    await run();
    expect(forActivity(planned)).toHaveLength(1);
    expect(forActivity(planned)[0]!.message).toMatchObject({
      title: 'Tomorrow: Hike',
      body: expect.stringMatching(/^\d\d:\d\d at Barefoot Café\. Still coming\?/),
      data: { activityId: planned },
    });
    expect(forActivity(lastMinute)).toHaveLength(0);
    expect(forActivity(farOff)).toHaveLength(0);
  });

  it('waits until an activity has been up for 15 minutes', async () => {
    sent.length = 0;
    const id = await activity('Quick coffee', '30 minutes');
    await t.deps.db
      .update(activities)
      .set({ createdAt: sql`now() - interval '5 minutes'` })
      .where(eq(activities.id, id));
    await run();
    expect(forActivity(id)).toHaveLength(0);
  });

  it('asks "how was it?" three hours after, only when someone joined the host', async () => {
    sent.length = 0;
    const done = await activity('Morning run', '-4 hours');
    const alone = await activity('Solo sketch', '-4 hours', 0);
    const stale = await activity('Last week', '-3 days');
    await run();
    // Guests are asked how it was; the host is asked to take roll call.
    const [guests, host] = forActivity(done);
    expect(guests!.message.title).toBe('How was Morning run?');
    expect(guests!.except).toHaveLength(1);
    expect(host!.message).toMatchObject({
      title: 'Who came to Morning run?',
      data: { activityId: done, screen: 'roll-call' },
    });
    expect(host!.to).toEqual(guests!.except);
    expect(forActivity(alone)).toHaveLength(0);
    expect(forActivity(stale)).toHaveLength(0);
  });

  it('reminds again for a new time, but nudging the time doesn’t repeat it', async () => {
    sent.length = 0;
    const id = await activity('Padel', '45 minutes');
    await run();
    const [{ hostId }] = (await t.deps.db
      .select({ hostId: activities.hostId })
      .from(activities)
      .where(eq(activities.id, id))) as [{ hostId: string }];
    const [host] = await t.deps.db.select().from(user).where(eq(user.id, hostId));
    const { headers } = await t.signIn(host!.email);
    const moveTo = (minutes: number) =>
      t.call(`/v1/activities/${id}`, {
        method: 'PATCH',
        headers,
        body: { startsAt: new Date(Date.now() + minutes * 60_000).toISOString() },
      });
    const reminders = () =>
      forActivity(id).filter((s) => s.message.title.startsWith('Starting in an hour'));

    // Five minutes later: still within the hour, so no second reminder.
    expect((await moveTo(50)).status).toBe(200);
    await run();
    expect(reminders()).toHaveLength(1);

    // Moved to this evening: reminded again once it's an hour away.
    expect((await moveTo(240)).status).toBe(200);
    await t.deps.db
      .update(activities)
      .set({ startsAt: new Date(Date.now() + 40 * 60_000) })
      .where(eq(activities.id, id));
    await run();
    expect(reminders()).toHaveLength(2);
  });
});
