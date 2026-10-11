import type { ChatMessage, ChatPreview, CommunitySummary } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { useTestApp } from './harness';

const t = useTestApp();

const chats = async (headers: Record<string, string>) =>
  (await t.call<{ chats: ChatPreview[] }>('/v1/chats', { headers })).body.chats;

async function climbing(headers: Record<string, string>) {
  const res = await t.call<{ communities: CommunitySummary[] }>('/v1/communities', { headers });
  return res.body.communities.find((c) => c.name === 'Climb Lanka')!.id;
}

const send = (id: string, headers: Record<string, string>, body: string) =>
  t.call<ChatMessage>(`/v1/communities/${id}/chat/messages`, {
    method: 'POST',
    headers,
    body: { id: randomUUID(), body },
  });

describe('the chats list', () => {
  it('lists activity and community chats with the latest line', async () => {
    const { headers } = await t.signIn();
    const list = await chats(headers);
    const padel = list.find((c) => c.title.startsWith('Padel'))!;
    expect(padel).toMatchObject({
      kind: 'activity',
      lastMessage: { body: 'Perfect. Meet at reception at 06:20.', senderName: 'Shehani' },
    });
  });

  it('counts unread messages from others until you read them', async () => {
    const ana = await t.signIn('ana@buddy.test', 'Ana');
    const ben = await t.signIn('ben@buddy.test', 'Ben');
    const id = await climbing(ana.headers);
    for (const p of [ana, ben]) {
      await t.call(`/v1/communities/${id}/membership`, { method: 'POST', headers: p.headers });
    }
    await send(id, ana.headers, 'First');
    const { body: last } = await send(id, ana.headers, 'Saturday at 9?');

    const bens = (await chats(ben.headers)).find((c) => c.id === id)!;
    expect(bens).toMatchObject({
      kind: 'community',
      title: 'Climb Lanka',
      unread: 2,
      lastMessage: { body: 'Saturday at 9?', senderName: 'Ana', mine: false },
    });
    // Your own messages are never unread; newest chat first.
    const anas = await chats(ana.headers);
    expect(anas[0]).toMatchObject({ id, unread: 0, lastMessage: { mine: true } });

    await t.call(`/v1/communities/${id}/chat/read`, {
      method: 'POST',
      headers: ben.headers,
      body: { messageId: last.id },
    });
    expect((await chats(ben.headers)).find((c) => c.id === id)!.unread).toBe(0);

    // Messages from someone you blocked don't count, or show.
    await send(id, ana.headers, 'Hello?');
    await t.call(`/v1/users/${ana.userId}/block`, { method: 'POST', headers: ben.headers });
    expect((await chats(ben.headers)).find((c) => c.id === id)).toMatchObject({
      unread: 0,
      lastMessage: null,
    });
  });
});
