import type { ActivityDetail, PublicProfile } from '@buddy/shared';
import { atLocalTime } from '@buddy/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { activities } from '../src/db/schema';
import { useTestApp } from './harness';

const t = useTestApp();

const create = (headers: Record<string, string>, extra: object = {}) =>
  t.call<ActivityDetail>('/v1/activities', {
    method: 'POST',
    headers,
    body: {
      title: 'Evening chess',
      group: 'Social',
      startsAt: atLocalTime(1, '18:30').toISOString(),
      place: 'Barefoot Café',
      location: { lat: 6.8985, lng: 79.8555 },
      capacity: 6,
      ...extra,
    },
  });

describe('cost and what to bring', () => {
  it('saves them, shows them, and lets the host change them', async () => {
    const host = await t.signIn('host@buddy.test', 'Kavindu');
    const res = await create(host.headers, { costLkr: 2500, bring: 'A board if you have one' });
    expect(res.body).toMatchObject({ costLkr: 2500, bring: 'A board if you have one' });

    const free = await t.call<ActivityDetail>(`/v1/activities/${res.body.id}`, {
      method: 'PATCH',
      headers: host.headers,
      body: { costLkr: 0, bring: '' },
    });
    expect(free.body).toMatchObject({ costLkr: 0, bring: '' });
    // Not said: null.
    expect((await create(host.headers)).body.costLkr).toBeNull();
    expect((await create(host.headers, { costLkr: -5 })).status).toBe(400);
  });
});

describe('would go again', () => {
  it('asks guests once it has started, and the host sees a total', async () => {
    const host = await t.signIn('host@buddy.test', 'Kavindu');
    const guest = await t.signIn('guest@buddy.test', 'Nethmi');
    const { body: a } = await create(host.headers);
    await t.call(`/v1/activities/${a.id}/membership`, { method: 'POST', headers: guest.headers });

    const answer = (headers: Record<string, string>, wouldGoAgain: boolean) =>
      t.call<ActivityDetail>(`/v1/activities/${a.id}/feedback`, {
        method: 'POST',
        headers,
        body: { wouldGoAgain },
      });
    // Not yet: it hasn't happened.
    expect((await answer(guest.headers, true)).status).toBe(403);

    await t.deps.db
      .update(activities)
      .set({ startsAt: new Date(Date.now() - 3 * 3_600_000) })
      .where(eq(activities.id, a.id));
    const before = await t.call<ActivityDetail>(`/v1/activities/${a.id}`, {
      headers: guest.headers,
    });
    expect(before.body.feedback).toEqual({ mine: null });

    const yes = await answer(guest.headers, true);
    expect(yes.body.feedback).toEqual({ mine: true });
    expect(yes.body.host.wouldGoAgain).toBe(1);
    // The host isn't asked about their own activity.
    expect((await answer(host.headers, true)).status).toBe(403);

    const profile = await t.call<PublicProfile>(`/v1/users/${host.userId}`, {
      headers: guest.headers,
    });
    expect(profile.body.wouldGoAgain).toBe(1);

    // Changing your mind takes it off the total.
    expect((await answer(guest.headers, false)).body.host.wouldGoAgain).toBe(0);
  });
});
