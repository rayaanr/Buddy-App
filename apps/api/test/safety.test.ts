import type {
  ActivityDetail,
  ActivitySummary,
  BlockedPeople,
  ChatMessage,
  MessagesPage,
  MyActivity,
  PublicProfile,
  ServerEvent,
} from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { messages, reports } from '../src/db/schema';
import { useTestApp } from './harness';

const pushes: { except: string[] }[] = [];
const t = useTestApp({
  env: { MODERATION_EMAIL: 'mod@buddy.test' },
  push: {
    async notifyActivity(_activityId, _message, except) {
      pushes.push({ except: [...except] });
    },
  },
});

afterEach(() => {
  pushes.length = 0;
});

type Headers = Record<string, string>;

const feed = async (headers: Headers) =>
  (await t.call<{ activities: ActivitySummary[] }>('/v1/activities', { headers })).body.activities;
const titles = (list: { title: string }[]) => list.map((a) => a.title);
const block = (headers: Headers, userId: string) =>
  t.call(`/v1/users/${userId}/block`, { method: 'POST', headers });

/** Padel: Shehani hosts; Nethmi, Dilan and Kavindu are going. */
async function padel(headers: Headers) {
  return (await feed(headers)).find((a) => a.title.startsWith('Padel'))!;
}

describe('blocking', () => {
  it('blocks, lists and unblocks; blocking twice is a no-op', async () => {
    const kavindu = await t.signIn();
    const nethmi = await t.signIn('nethmi@buddy.test');

    expect((await block(kavindu.headers, nethmi.userId)).status).toBe(204);
    expect((await block(kavindu.headers, nethmi.userId)).status).toBe(204);
    const list = await t.call<BlockedPeople>('/v1/me/blocks', { headers: kavindu.headers });
    expect(list.body.people).toEqual([
      expect.objectContaining({ id: nethmi.userId, name: 'Nethmi' }),
    ]);

    const unblocked = await t.call(`/v1/users/${nethmi.userId}/block`, {
      method: 'DELETE',
      headers: kavindu.headers,
    });
    expect(unblocked.status).toBe(204);
    const after = await t.call<BlockedPeople>('/v1/me/blocks', { headers: kavindu.headers });
    expect(after.body.people).toEqual([]);
  });

  it('rejects blocking yourself or someone who doesn’t exist', async () => {
    const kavindu = await t.signIn();
    expect((await block(kavindu.headers, kavindu.userId)).status).toBe(400);
    expect((await block(kavindu.headers, randomUUID())).status).toBe(404);
  });

  it('hides each side’s activities and profile from the other', async () => {
    const kavindu = await t.signIn();
    const nethmi = await t.signIn('nethmi@buddy.test');
    const run = (await feed(kavindu.headers)).find((a) => a.title.startsWith('Saturday 10K'))!;
    await block(kavindu.headers, nethmi.userId);

    // Kavindu no longer sees Nethmi's runs, nor can he open or join them.
    const mine = titles(await feed(kavindu.headers));
    expect(mine).not.toContain('Sunset 5K at Galle Face');
    expect(mine).not.toContain('Saturday 10K, Viharamahadevi Park');
    expect((await t.call(`/v1/activities/${run.id}`, { headers: kavindu.headers })).status).toBe(
      404,
    );
    const join = await t.call(`/v1/activities/${run.id}/membership`, {
      method: 'POST',
      headers: kavindu.headers,
    });
    expect(join.status).toBe(404);

    // He can still see her profile (to unblock), flagged as blocked, without her activities.
    const profile = await t.call<PublicProfile>(`/v1/users/${nethmi.userId}`, {
      headers: kavindu.headers,
    });
    expect(profile.body).toMatchObject({ blockedByYou: true, hosting: [] });

    // Nethmi can't find Kavindu at all, and doesn't see what he hosts.
    const hosted = await t.call<ActivityDetail>('/v1/activities', {
      method: 'POST',
      headers: kavindu.headers,
      body: {
        title: 'Evening chess',
        group: 'Social',
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        place: 'Barefoot Café',
        area: 'Colombo 03',
        capacity: 6,
      },
    });
    expect(titles(await feed(nethmi.headers))).not.toContain('Evening chess');
    expect(
      (await t.call(`/v1/activities/${hosted.body.id}`, { headers: nethmi.headers })).status,
    ).toBe(404);
    expect((await t.call(`/v1/users/${kavindu.userId}`, { headers: nethmi.headers })).status).toBe(
      404,
    );
  });

  it('keeps shared activities but hides the other person and their messages', async () => {
    const kavindu = await t.signIn();
    const shehani = await t.signIn('shehani@buddy.test');
    const { id } = await padel(kavindu.headers);
    await block(kavindu.headers, shehani.userId);

    // Still going, so it stays in his activities.
    const joined = await t.call<{ activities: MyActivity[] }>('/v1/activities/mine?role=joined', {
      headers: kavindu.headers,
    });
    expect(titles(joined.body.activities)).toEqual(['Padel doubles, need one more']);
    // The chat preview skips her lines.
    expect(joined.body.activities[0]!.lastMessage).toBeNull();

    const detail = await t.call<ActivityDetail>(`/v1/activities/${id}`, {
      headers: kavindu.headers,
    });
    expect(detail.body.goingCount).toBe(4);
    expect(detail.body.attendees.map((a) => a.name)).not.toContain('Shehani');

    const page = await t.call<MessagesPage>(`/v1/activities/${id}/chat/messages`, {
      headers: kavindu.headers,
    });
    expect(page.body.messages.map((m) => m.body)).toEqual(['Kavindu joined']);

    // Both directions: she doesn't see his messages either.
    await t.call(`/v1/activities/${id}/chat/messages`, {
      method: 'POST',
      headers: kavindu.headers,
      body: { id: randomUUID(), body: 'Running late' },
    });
    const hers = await t.call<MessagesPage>(`/v1/activities/${id}/chat/messages`, {
      headers: shehani.headers,
    });
    expect(hers.body.messages.map((m) => m.body)).not.toContain('Running late');
  });

  it('skips blocked people for live messages, typing and push', async () => {
    const server = await t.listen();
    try {
      const kavindu = await t.signIn();
      const shehani = await t.signIn('shehani@buddy.test');
      const dilan = await t.signIn('dilan@buddy.test');
      const { id } = await padel(kavindu.headers);
      await block(kavindu.headers, shehani.userId);

      const path = `/v1/activities/${id}/chat/ws`;
      const k = server.connect(path, kavindu.headers);
      const d = server.connect(path, dilan.headers);
      await Promise.all([k.opened, d.opened]);

      const sent = await t.call<ChatMessage>(`/v1/activities/${id}/chat/messages`, {
        method: 'POST',
        headers: shehani.headers,
        body: { id: randomUUID(), body: 'Court changed to 3' },
      });
      expect(sent.status).toBe(201);
      const s = server.connect(path, shehani.headers);
      await s.opened;
      s.ws.send(JSON.stringify({ type: 'typing' }));

      // Dilan gets both; give Kavindu's socket the same time to (not) receive them.
      const deadline = Date.now() + 2000;
      const types = () => (d.events as ServerEvent[]).map((e) => e.type);
      while (!(types().includes('message') && types().includes('typing'))) {
        if (Date.now() > deadline) throw new Error(`Dilan got ${JSON.stringify(d.events)}`);
        await new Promise((r) => setTimeout(r, 10));
      }
      await new Promise((r) => setTimeout(r, 100));
      expect(k.events).toEqual([]);

      expect(pushes[0]!.except).toContain(kavindu.userId);
    } finally {
      await server.close();
    }
  });
});

describe('reports', () => {
  it('reports a chat message and emails the moderators', async () => {
    const kavindu = await t.signIn();
    const shehani = await t.signIn('shehani@buddy.test');
    const { id } = await padel(kavindu.headers);
    const [line] = await t.deps.db
      .select()
      .from(messages)
      .where(eq(messages.body, 'Court 2 booked for 06:30.'));

    const res = await t.call<{ id: string }>('/v1/reports', {
      method: 'POST',
      headers: kavindu.headers,
      body: { reason: 'harassment', messageId: line!.id, details: '  Rude to me  ' },
    });
    expect(res.status).toBe(201);

    const [row] = await t.deps.db.select().from(reports).where(eq(reports.id, res.body.id));
    expect(row).toMatchObject({
      reporterId: kavindu.userId,
      targetUserId: shehani.userId,
      activityId: id,
      messageId: line!.id,
      reason: 'harassment',
      details: 'Rude to me',
      status: 'open',
    });

    // The mailer runs after the response; give it a tick.
    await new Promise((r) => setTimeout(r, 50));
    const mail = t.mail.sent.find((m) => m.to === 'mod@buddy.test')!;
    expect(mail.subject).toBe('Buddy report: harassment');
    expect(mail.text).toContain('Harassment or bullying');
    expect(mail.text).toContain('“Court 2 booked for 06:30.”');
    expect(mail.text).toContain('Rude to me');
  });

  it('reports people and activities, targeting the host for an activity', async () => {
    const kavindu = await t.signIn();
    const nethmi = await t.signIn('nethmi@buddy.test');
    const run = (await feed(kavindu.headers)).find((a) => a.title.startsWith('Sunset 5K'))!;

    const person = await t.call<{ id: string }>('/v1/reports', {
      method: 'POST',
      headers: kavindu.headers,
      body: { reason: 'spam', userId: nethmi.userId },
    });
    const activity = await t.call<{ id: string }>('/v1/reports', {
      method: 'POST',
      headers: kavindu.headers,
      body: { reason: 'other', activityId: run.id },
    });
    const rows = await t.deps.db.select().from(reports);
    expect(rows.map((r) => [r.id, r.targetUserId, r.activityId]).sort()).toEqual(
      [
        [person.body.id, nethmi.userId, null],
        [activity.body.id, nethmi.userId, run.id],
      ].sort(),
    );
  });

  it('rejects what can’t be reported', async () => {
    const kavindu = await t.signIn();
    const report = (body: object) =>
      t.call('/v1/reports', { method: 'POST', headers: kavindu.headers, body });

    // Messages in chats you're not in look like they don't exist.
    const [other] = await t.deps.db
      .select()
      .from(messages)
      .where(eq(messages.body, 'Meeting at the Town Hall entrance.'));
    expect((await report({ reason: 'spam', messageId: other!.id })).status).toBe(404);

    const [system] = await t.deps.db
      .select()
      .from(messages)
      .where(eq(messages.body, 'Kavindu joined'));
    expect((await report({ reason: 'spam', messageId: system!.id })).status).toBe(400);

    expect((await report({ reason: 'spam', userId: kavindu.userId })).status).toBe(400);
    expect((await report({ reason: 'spam' })).status).toBe(400);
    expect(
      (await report({ reason: 'spam', userId: kavindu.userId, activityId: randomUUID() })).status,
    ).toBe(400);
    expect((await report({ reason: 'rude', userId: randomUUID() })).status).toBe(400);
    expect((await report({ reason: 'spam', userId: randomUUID() })).status).toBe(404);
  });
});
