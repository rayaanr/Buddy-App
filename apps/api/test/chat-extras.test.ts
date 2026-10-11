import type { ActivitySummary, ChatMessage, ChatPreview, MessagesPage } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import type { PushMessage } from '../src/lib/push';
import { memoryStorage, useTestApp } from './harness';

const r2 = memoryStorage();
const toUsers: { userIds: string[]; message: PushMessage }[] = [];
const toChat: { message: PushMessage; except: string[] }[] = [];
const t = useTestApp({
  storage: r2.storage,
  env: { R2_PUBLIC_URL: 'https://img.example.com' },
  push: {
    async notifyActivity(_id, message, except) {
      toChat.push({ message, except: [...except] });
    },
    async notifyUsers(userIds, message) {
      toUsers.push({ userIds, message });
    },
  },
});
const settled = () => (t.deps.push as { settled?: () => Promise<void> }).settled?.();

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

describe('photos in chat', () => {
  it('sends a photo you uploaded, with its size', async () => {
    const me = await t.signIn();
    const id = await padel(me.headers);
    const key = `chat/${me.userId}/${randomUUID()}.jpg`;
    r2.upload(key);
    const res = await send(id, me.headers, { imageKey: key, imageWidth: 1200, imageHeight: 900 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      body: '',
      image: { url: `https://img.example.com/${key}`, width: 1200, height: 900 },
    });
    const chats = await t.call<{ chats: ChatPreview[] }>('/v1/chats', { headers: me.headers });
    expect(chats.body.chats.find((c) => c.id === id)!.lastMessage!.body).toBe('📷 Photo');
  });

  it('refuses someone else’s upload, and empty messages', async () => {
    const me = await t.signIn();
    const other = await t.signIn('shehani@buddy.test');
    const id = await padel(me.headers);
    const theirs = `chat/${other.userId}/${randomUUID()}.jpg`;
    r2.upload(theirs);
    expect((await send(id, me.headers, { imageKey: theirs })).status).toBe(403);
    expect((await send(id, me.headers, { body: '   ' })).status).toBe(400);
  });
});

describe('mentions', () => {
  it('tags people in the chat and tells them, even if they muted it', async () => {
    const me = await t.signIn('kavindu@buddy.test', 'Kavindu');
    const shehani = await t.signIn('shehani@buddy.test');
    const outsider = await t.signIn('out@buddy.test', 'Outsider');
    const id = await padel(me.headers);
    await t.call(`/v1/activities/${id}/mute`, {
      method: 'POST',
      headers: shehani.headers,
      body: { muted: true },
    });

    toUsers.length = 0;
    toChat.length = 0;
    const res = await send(id, me.headers, {
      body: '@Shehani can you book court 3?',
      mentions: [shehani.userId, outsider.userId],
    });
    // Only people in the chat can be tagged.
    expect(res.body.mentions).toEqual([{ id: shehani.userId, name: 'Shehani' }]);
    await settled();
    expect(toUsers).toEqual([
      {
        userIds: [shehani.userId],
        message: expect.objectContaining({
          title: 'Kavindu mentioned you in Padel doubles, need one more',
          body: '@Shehani can you book court 3?',
        }),
      },
    ]);
    // …and the group notification skips them (no double buzz).
    expect(toChat[0]!.except).toContain(shehani.userId);
  });
});

describe('polls', () => {
  it('collects votes, one each unless the poll allows more', async () => {
    const me = await t.signIn();
    const shehani = await t.signIn('shehani@buddy.test');
    const id = await padel(me.headers);
    const { body: poll } = await send(id, me.headers, {
      poll: { question: 'Which court?', options: ['Court 2', 'Court 3', 'Either'] },
    });
    expect(poll.poll).toEqual({
      question: 'Which court?',
      multiple: false,
      options: [
        { id: 'o1', text: 'Court 2', voterIds: [] },
        { id: 'o2', text: 'Court 3', voterIds: [] },
        { id: 'o3', text: 'Either', voterIds: [] },
      ],
    });

    const vote = (headers: Record<string, string>, optionIds: string[]) =>
      t.call<ChatMessage>(`/v1/activities/${id}/chat/messages/${poll.id}/vote`, {
        method: 'POST',
        headers,
        body: { optionIds },
      });
    await vote(me.headers, ['o1']);
    await vote(shehani.headers, ['o1']);
    // Changing your mind moves your vote.
    const changed = await vote(me.headers, ['o3']);
    expect(changed.body.poll!.options.map((o) => o.voterIds.length)).toEqual([1, 0, 1]);

    expect((await vote(me.headers, ['o1', 'o2'])).status).toBe(400);
    expect((await vote(me.headers, ['o9'])).status).toBe(400);
    // No options: take your vote back.
    const cleared = await vote(me.headers, []);
    expect(cleared.body.poll!.options.map((o) => o.voterIds)).toEqual([[shehani.userId], [], []]);

    const page = await t.call<MessagesPage>(`/v1/activities/${id}/chat/messages`, {
      headers: shehani.headers,
    });
    expect(page.body.messages.at(-1)!.poll!.options[0]!.voterIds).toEqual([shehani.userId]);

    const outsider = await t.signIn('out@buddy.test', 'Outsider');
    expect((await vote(outsider.headers, ['o1'])).status).toBe(403);
  });

  it('can allow several answers', async () => {
    const me = await t.signIn();
    const id = await padel(me.headers);
    const { body: poll } = await send(id, me.headers, {
      poll: { question: 'What should we bring?', options: ['Balls', 'Water'], multiple: true },
    });
    const res = await t.call<ChatMessage>(`/v1/activities/${id}/chat/messages/${poll.id}/vote`, {
      method: 'POST',
      headers: me.headers,
      body: { optionIds: ['o1', 'o2'] },
    });
    expect(res.body.poll!.options.every((o) => o.voterIds.includes(me.userId))).toBe(true);
  });
});

describe('replies', () => {
  it('quotes the message replied to, only within the same chat', async () => {
    const me = await t.signIn();
    const shehani = await t.signIn('shehani@buddy.test');
    const id = await padel(me.headers);
    const { body: question } = await send(id, shehani.headers, { body: 'Who has spare balls?' });
    const { body: reply } = await send(id, me.headers, { body: 'Me!', replyToId: question.id });
    expect(reply.replyTo).toEqual({
      id: question.id,
      senderName: 'Shehani',
      summary: 'Who has spare balls?',
    });

    // A message from another chat can't be quoted.
    const { body: elsewhere } = await t.call<ChatMessage>(
      `/v1/communities/${(await t.call<{ communities: { id: string; name: string }[] }>('/v1/communities', { headers: me.headers })).body.communities[0]!.id}/chat/messages`,
      { method: 'POST', headers: me.headers, body: { id: randomUUID(), body: 'hi' } },
    );
    const odd = await send(id, me.headers, { body: 'Odd', replyToId: elsewhere.id });
    expect(odd.body.replyTo).toBeNull();
  });
});

describe('reactions', () => {
  it('one reaction each; changing or clearing it updates the counts', async () => {
    const me = await t.signIn();
    const shehani = await t.signIn('shehani@buddy.test');
    const id = await padel(me.headers);
    const { body: msg } = await send(id, shehani.headers, { body: 'Court booked!' });
    const react = (headers: Record<string, string>, emoji: string | null) =>
      t.call<{ reactions: ChatMessage['reactions'] }>(
        `/v1/activities/${id}/chat/messages/${msg.id}/react`,
        { method: 'POST', headers, body: { emoji } },
      );
    await react(me.headers, '👍');
    const both = await react(shehani.headers, '👍');
    expect(both.body.reactions).toEqual([{ emoji: '👍', userIds: [me.userId, shehani.userId] }]);
    const changed = await react(me.headers, '❤️');
    expect(changed.body.reactions).toEqual([
      { emoji: '👍', userIds: [shehani.userId] },
      { emoji: '❤️', userIds: [me.userId] },
    ]);
    expect((await react(me.headers, null)).body.reactions).toEqual([
      { emoji: '👍', userIds: [shehani.userId] },
    ]);
    expect((await react(me.headers, '🍕')).status).toBe(400);

    const page = await t.call<MessagesPage>(`/v1/activities/${id}/chat/messages`, {
      headers: me.headers,
    });
    expect(page.body.messages.find((m) => m.id === msg.id)!.reactions).toEqual([
      { emoji: '👍', userIds: [shehani.userId] },
    ]);
  });
});
