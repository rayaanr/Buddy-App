import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { activities, activityMembers, user } from '../src/db/schema';
import { sendReminders } from '../src/jobs/reminders';
import type { PushMessage } from '../src/lib/push';
import { areaCentre } from '../src/modules/profiles/service';
import { useTestApp } from './harness';

const sent: { activityId: string; message: PushMessage }[] = [];
const push = {
  notifyActivity: async (activityId: string, message: PushMessage) => {
    sent.push({ activityId, message });
  },
  notifyUsers: async () => {},
};
const t = useTestApp({ push });
const run = () => sendReminders({ db: t.deps.db, push });

/** An activity starting `startsIn` from now (SQL interval), created an hour ago. */
async function activity(title: string, startsIn: string, guests = 1) {
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
      area: 'Colombo 03',
      location: areaCentre('Colombo 03'),
      capacity: 6,
      createdAt: sql`now() - interval '1 hour'`,
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
  it('sends "coming up" once, two hours ahead, and not for cancelled activities', async () => {
    sent.length = 0;
    const soon = await activity('Sunset swim', '90 minutes');
    const later = await activity('Late swim', '5 hours');
    const cancelled = await activity('Called off', '1 hour');
    await t.deps.db
      .update(activities)
      .set({ cancelledAt: new Date() })
      .where(eq(activities.id, cancelled));

    await run();
    await run();
    expect(forActivity(soon)).toHaveLength(1);
    expect(forActivity(soon)[0]!.message).toMatchObject({
      title: 'Coming up: Sunset swim',
      body: expect.stringMatching(/^\d\d:\d\d at Barefoot Café\./),
      data: { activityId: soon, screen: 'chat' },
    });
    expect(forActivity(later)).toHaveLength(0);
    expect(forActivity(cancelled)).toHaveLength(0);
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
    expect(forActivity(done).map((s) => s.message.title)).toEqual(['How was Morning run?']);
    expect(forActivity(alone)).toHaveLength(0);
    expect(forActivity(stale)).toHaveLength(0);
  });

  it('reminds again when the host moves the time', async () => {
    sent.length = 0;
    const id = await activity('Padel', '1 hour');
    await run();
    const [{ hostId }] = (await t.deps.db
      .select({ hostId: activities.hostId })
      .from(activities)
      .where(eq(activities.id, id))) as [{ hostId: string }];
    const [host] = await t.deps.db.select().from(user).where(eq(user.id, hostId));
    const { headers } = await t.signIn(host!.email);
    const res = await t.call(`/v1/activities/${id}`, {
      method: 'PATCH',
      headers,
      body: { startsAt: new Date(Date.now() + 100 * 60_000).toISOString() },
    });
    expect(res.status).toBe(200);
    await run();
    expect(forActivity(id).filter((s) => s.message.title.startsWith('Coming up'))).toHaveLength(2);
  });
});
