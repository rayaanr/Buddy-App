import type { ActivitySummary, AppNotification } from '@buddy/shared';
import { atLocalTime } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { useTestApp } from './harness';

const t = useTestApp();
type Inbox = { notifications: AppNotification[]; unread: number };
const inbox = async (headers: Record<string, string>) =>
  (await t.call<Inbox>('/v1/notifications', { headers })).body;

describe('the notifications list', () => {
  it('keeps what was pushed (not chat), newest first, until it’s opened', async () => {
    const host = await t.signIn('shehani@buddy.test');
    const guest = await t.signIn(); // Kavindu is going to Shehani's padel
    await t.call('/v1/notifications/read', { method: 'POST', headers: guest.headers });

    const feed = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', {
      headers: guest.headers,
    });
    const padel = feed.body.activities.find((a) => a.title.startsWith('Padel'))!;

    // A chat message: pushed, but not kept here.
    await t.call(`/v1/activities/${padel.id}/chat/messages`, {
      method: 'POST',
      headers: host.headers,
      body: { id: randomUUID(), body: 'See you there!' },
    });
    // A new time: kept.
    await t.call(`/v1/activities/${padel.id}`, {
      method: 'PATCH',
      headers: host.headers,
      body: { startsAt: atLocalTime(3, '19:15').toISOString() },
    });
    await new Promise((r) => setTimeout(r, 50));

    const before = await inbox(guest.headers);
    expect(before.unread).toBe(1);
    expect(before.notifications[0]).toMatchObject({
      kind: 'reminders',
      title: padel.title,
      body: expect.stringMatching(/^Now .*19:15$/),
      data: { activityId: padel.id },
      read: false,
    });
    // The host doesn't get their own change.
    expect((await inbox(host.headers)).notifications.some((n) => n.title === padel.title)).toBe(
      false,
    );

    await t.call('/v1/notifications/read', { method: 'POST', headers: guest.headers });
    const after = await inbox(guest.headers);
    expect(after.unread).toBe(0);
    expect(after.notifications[0]?.read).toBe(true);
    const unread = await t.call<{ unread: number }>('/v1/notifications/unread', {
      headers: guest.headers,
    });
    expect(unread.body.unread).toBe(0);
  });

  it('is private to each person', async () => {
    const someone = await t.signIn('new@buddy.test', 'Nimal');
    expect(await inbox(someone.headers)).toEqual({ notifications: [], unread: 0 });
    expect((await t.call('/v1/notifications')).status).toBe(401);
  });
});
