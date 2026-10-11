import type { ActivityDetail, RollCallGuest } from '@buddy/shared';
import { atLocalTime } from '@buddy/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { activities } from '../src/db/schema';
import { useTestApp } from './harness';

const t = useTestApp();

describe('roll call', () => {
  it('lets the host mark who came once it has started; no-shows aren’t asked about it', async () => {
    const host = await t.signIn('host@buddy.test', 'Kavindu');
    const came = await t.signIn('came@buddy.test', 'Nethmi');
    const absent = await t.signIn('absent@buddy.test', 'Dilan');
    const { body: a } = await t.call<ActivityDetail>('/v1/activities', {
      method: 'POST',
      headers: host.headers,
      body: {
        title: 'Evening chess',
        group: 'Social',
        startsAt: atLocalTime(1, '18:30').toISOString(),
        place: 'Barefoot Café',
        location: { lat: 6.8985, lng: 79.8555 },
        capacity: 6,
      },
    });
    for (const g of [came, absent]) {
      await t.call(`/v1/activities/${a.id}/membership`, { method: 'POST', headers: g.headers });
    }
    const roll = (headers: Record<string, string>) =>
      t.call<{ guests: RollCallGuest[] }>(`/v1/activities/${a.id}/roll-call`, { headers });
    const mark = (headers: Record<string, string>, marks: object[]) =>
      t.call<ActivityDetail>(`/v1/activities/${a.id}/roll-call`, {
        method: 'PUT',
        headers,
        body: { marks },
      });

    // Not before it starts.
    expect((await roll(host.headers)).status).toBe(403);
    const before = await t.call<ActivityDetail>(`/v1/activities/${a.id}`, {
      headers: host.headers,
    });
    expect(before.body.rollCall).toBeNull();

    await t.deps.db
      .update(activities)
      .set({ startsAt: new Date(Date.now() - 3 * 3_600_000) })
      .where(eq(activities.id, a.id));

    const open = await roll(host.headers);
    expect(open.body.guests.map((g) => [g.name, g.attended])).toEqual([
      ['Nethmi', null],
      ['Dilan', null],
    ]);
    // Only the host.
    expect((await roll(came.headers)).status).toBe(403);
    expect((await mark(came.headers, [{ userId: came.userId, attended: true }])).status).toBe(403);

    const done = await mark(host.headers, [
      { userId: came.userId, attended: true },
      { userId: absent.userId, attended: false },
      // The host isn't a guest: ignored.
      { userId: host.userId, attended: true },
    ]);
    expect(done.status).toBe(200);
    expect(done.body.rollCall).toEqual({ guests: 2, marked: 2, came: 1 });

    // Someone marked as not there isn't asked "would you go again?", and can't answer.
    const absentView = await t.call<ActivityDetail>(`/v1/activities/${a.id}`, {
      headers: absent.headers,
    });
    expect(absentView.body.feedback).toBeNull();
    expect(absentView.body.rollCall).toBeNull();
    const answer = await t.call(`/v1/activities/${a.id}/feedback`, {
      method: 'POST',
      headers: absent.headers,
      body: { wouldGoAgain: false },
    });
    expect(answer.status).toBe(403);
    const cameView = await t.call<ActivityDetail>(`/v1/activities/${a.id}`, {
      headers: came.headers,
    });
    expect(cameView.body.feedback).toEqual({ mine: null });
  });
});
