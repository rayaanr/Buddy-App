import type { ActivitySummary, ChatMessage, MessagesPage } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { messages, reports } from '../src/db/schema';
import { useTestApp } from './harness';

const t = useTestApp();

async function padel(headers: Record<string, string>) {
  const res = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', { headers });
  return res.body.activities.find((a) => a.title.startsWith('Padel'))!.id;
}
const send = (id: string, headers: Record<string, string>, body: object) =>
  t.call<ChatMessage>(`/v1/activities/${id}/chat/messages`, {
    method: 'POST',
    headers,
    body: { id: randomUUID(), ...body },
  });
const page = (id: string, headers: Record<string, string>, query = '') =>
  t.call<MessagesPage>(`/v1/activities/${id}/chat/messages${query}`, { headers });

describe('older messages', () => {
  it('pages back with `before` until there are no more', async () => {
    const me = await t.signIn();
    const id = await padel(me.headers);
    for (let k = 1; k <= 5; k++) await send(id, me.headers, { body: `m${k}` });

    const latest = await page(id, me.headers, '?limit=3');
    expect(latest.body.messages.map((m) => m.body)).toEqual(['m3', 'm4', 'm5']);
    expect(latest.body.hasMore).toBe(true);

    const earlier = await page(id, me.headers, `?limit=3&before=${latest.body.messages[0]!.id}`);
    // The three before m3: the seeded chat's last line, then m1, m2.
    expect(earlier.body.messages.map((m) => m.body)).toEqual([
      'Perfect. Meet at reception at 06:20.',
      'm1',
      'm2',
    ]);
    expect(earlier.body.hasMore).toBe(true);

    const all = await page(id, me.headers, '?limit=200');
    expect(all.body.hasMore).toBe(false);
  });

  it('says how far you had read', async () => {
    const me = await t.signIn();
    const shehani = await t.signIn('shehani@buddy.test');
    const id = await padel(me.headers);
    const { body: first } = await send(id, shehani.headers, { body: 'One' });
    await t.call(`/v1/activities/${id}/chat/read`, {
      method: 'POST',
      headers: me.headers,
      body: { messageId: first.id },
    });
    await send(id, shehani.headers, { body: 'Two' });
    const res = await page(id, me.headers);
    expect(res.body.myReadUpTo).toBe(first.createdAt.slice(0, 23) + 'Z');
  });
});

describe('editing and deleting', () => {
  it('edits your own message for a while, then not', async () => {
    const me = await t.signIn();
    const shehani = await t.signIn('shehani@buddy.test');
    const id = await padel(me.headers);
    const { body: msg } = await send(id, me.headers, { body: 'Se you there' });
    const edit = (headers: Record<string, string>, body: string) =>
      t.call<ChatMessage>(`/v1/activities/${id}/chat/messages/${msg.id}`, {
        method: 'PATCH',
        headers,
        body: { body },
      });
    const fixed = await edit(me.headers, 'See you there');
    expect(fixed.body).toMatchObject({ body: 'See you there', editedAt: expect.any(String) });
    expect((await edit(shehani.headers, 'Hacked')).status).toBe(403);

    await t.deps.db
      .update(messages)
      .set({ createdAt: new Date(Date.now() - 16 * 60_000) })
      .where(eq(messages.id, msg.id));
    expect((await edit(me.headers, 'Too late')).status).toBe(400);
  });

  it('deletes your message: it shows as deleted, and quotes of it say so', async () => {
    const me = await t.signIn();
    const shehani = await t.signIn('shehani@buddy.test');
    const id = await padel(me.headers);
    const { body: msg } = await send(id, me.headers, { body: 'Oops, wrong chat' });
    await send(id, shehani.headers, { body: 'Huh?', replyToId: msg.id });
    await t.call(`/v1/activities/${id}/chat/messages/${msg.id}/react`, {
      method: 'POST',
      headers: shehani.headers,
      body: { emoji: '😂' },
    });

    const del = (headers: Record<string, string>) =>
      t.call<ChatMessage>(`/v1/activities/${id}/chat/messages/${msg.id}`, {
        method: 'DELETE',
        headers,
      });
    expect((await del(shehani.headers)).status).toBe(403);
    const gone = await del(me.headers);
    expect(gone.body).toMatchObject({ deleted: true, body: '', reactions: [] });

    const res = await page(id, shehani.headers);
    const reply = res.body.messages.find((m) => m.body === 'Huh?')!;
    expect(reply.replyTo).toMatchObject({ summary: 'Message deleted' });
    const [row] = await t.deps.db.select().from(messages).where(eq(messages.id, msg.id));
    expect(row!.body).toBe('');
  });

  it('keeps a reported message’s content (hidden) until a moderator has looked', async () => {
    const me = await t.signIn();
    const shehani = await t.signIn('shehani@buddy.test');
    const id = await padel(me.headers);
    const { body: msg } = await send(id, me.headers, { body: 'Something rude' });
    await t.call('/v1/reports', {
      method: 'POST',
      headers: shehani.headers,
      body: { messageId: msg.id, reason: 'harassment' },
    });
    const gone = await t.call<ChatMessage>(`/v1/activities/${id}/chat/messages/${msg.id}`, {
      method: 'DELETE',
      headers: me.headers,
    });
    expect(gone.body.body).toBe('');
    const [row] = await t.deps.db.select().from(messages).where(eq(messages.id, msg.id));
    expect(row!.body).toBe('Something rude');
    expect((await t.deps.db.select().from(reports)).length).toBe(1);
  });
});
