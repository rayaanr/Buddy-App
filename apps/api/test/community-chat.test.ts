import type { ChatMessage, CommunityDetail, CommunitySummary, MessagesPage } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { reports } from '../src/db/schema';
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
const settled = () => (t.deps.push as { settled?: () => Promise<void> }).settled?.();

async function climbing(headers: Record<string, string>) {
  const res = await t.call<{ communities: CommunitySummary[] }>('/v1/communities', { headers });
  return res.body.communities.find((c) => c.name === 'Climb Lanka')!.id;
}

const join = (id: string, headers: Record<string, string>) =>
  t.call(`/v1/communities/${id}/membership`, { method: 'POST', headers });

const send = (id: string, headers: Record<string, string>, body: string) =>
  t.call<ChatMessage>(`/v1/communities/${id}/chat/messages`, {
    method: 'POST',
    headers,
    body: { id: randomUUID(), body },
  });

describe('community chat', () => {
  it('is for members: they can talk, others can’t read it', async () => {
    const ana = await t.signIn('ana@buddy.test', 'Ana');
    const ben = await t.signIn('ben@buddy.test', 'Ben');
    const outsider = await t.signIn('out@buddy.test', 'Outsider');
    const id = await climbing(ana.headers);
    await join(id, ana.headers);
    await join(id, ben.headers);

    pushed.length = 0;
    const sent = await send(id, ana.headers, 'Anyone up for Saturday?');
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ communityId: id, activityId: null, kind: 'user' });

    const page = await t.call<MessagesPage>(`/v1/communities/${id}/chat/messages`, {
      headers: ben.headers,
    });
    expect(page.body.messages.map((m) => [m.sender?.name, m.body])).toEqual([
      ['Ana', 'Anyone up for Saturday?'],
    ]);

    // Members hear about it; the sender doesn't.
    await settled();
    const chatPush = pushed.find((p) => p.message.channelId === 'chat')!;
    expect(chatPush.userIds).toContain(ben.userId);
    expect(chatPush.userIds).not.toContain(ana.userId);
    expect(chatPush.message).toMatchObject({
      title: 'Climb Lanka',
      body: 'Ana: Anyone up for Saturday?',
      data: { communityId: id, screen: 'chat' },
    });

    const denied = await t.call(`/v1/communities/${id}/chat/messages`, {
      headers: outsider.headers,
    });
    expect(denied.status).toBe(403);

    // Leaving takes you out of the chat.
    await t.call(`/v1/communities/${id}/membership`, { method: 'DELETE', headers: ben.headers });
    const after = await t.call(`/v1/communities/${id}/chat/messages`, { headers: ben.headers });
    expect(after.status).toBe(403);
  });

  it('can be muted', async () => {
    const ana = await t.signIn('ana@buddy.test', 'Ana');
    const ben = await t.signIn('ben@buddy.test', 'Ben');
    const id = await climbing(ana.headers);
    await join(id, ana.headers);
    await join(id, ben.headers);
    const muted = await t.call<CommunityDetail>(`/v1/communities/${id}/mute`, {
      method: 'POST',
      headers: ben.headers,
      body: { muted: true },
    });
    expect(muted.body.chatMuted).toBe(true);

    pushed.length = 0;
    await send(id, ana.headers, 'Gym at 6?');
    await settled();
    expect(pushed.flatMap((p) => p.userIds)).not.toContain(ben.userId);
  });

  it('keeps messages in their own chat, and reports stay about the message', async () => {
    const ana = await t.signIn('ana@buddy.test', 'Ana');
    const ben = await t.signIn('ben@buddy.test', 'Ben');
    const id = await climbing(ana.headers);
    await join(id, ana.headers);
    await join(id, ben.headers);
    const { body: message } = await send(id, ana.headers, 'Rude message');

    // The same message ID can't be replayed into another chat.
    const other = await t.call<{ communities: CommunitySummary[] }>('/v1/communities', {
      headers: ana.headers,
    });
    const runners = other.body.communities.find((c) => c.name === 'Colombo Runners')!.id;
    await join(runners, ana.headers);
    const replay = await t.call(`/v1/communities/${runners}/chat/messages`, {
      method: 'POST',
      headers: ana.headers,
      body: { id: message.id, body: 'Rude message' },
    });
    expect(replay.status).toBe(409);

    const report = await t.call('/v1/reports', {
      method: 'POST',
      headers: ben.headers,
      body: { messageId: message.id, reason: 'harassment' },
    });
    expect(report.status).toBe(201);
    const [row] = await t.deps.db.select().from(reports).where(eq(reports.messageId, message.id));
    expect(row).toMatchObject({ targetUserId: ana.userId, communityId: null, activityId: null });
  });
});
