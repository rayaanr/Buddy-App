import type { ActivitySummary, ChatMessage, MessagesPage, ServerEvent } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { messages, pushTokens } from '../src/db/schema';
import { createPushSender, type PushMessage } from '../src/lib/push';
import { useTestApp } from './harness';

const pushes: { activityId: string; message: PushMessage; except: string[] }[] = [];
const t = useTestApp({
  push: {
    async notifyActivity(activityId, message, except) {
      pushes.push({ activityId, message, except: [...except].sort() });
    },
    async notifyUsers() {},
  },
});

afterEach(() => {
  pushes.length = 0;
});

/** Waits until `events` contains one matching `predicate`. */
async function waitFor<T>(events: unknown[], predicate: (e: ServerEvent) => boolean, ms = 2000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const found = (events as ServerEvent[]).find(predicate);
    if (found) return found as T;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`Timed out; got ${JSON.stringify(events)}`);
}

async function padelFor(headers: Record<string, string>) {
  const res = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', { headers });
  return res.body.activities.find((a) => a.title.startsWith('Padel'))!;
}

describe('chat over HTTP', () => {
  it('only lets members read the chat', async () => {
    const outsider = await t.signIn('outsider@buddy.test', 'Outsider');
    const padel = await padelFor(outsider.headers);
    const res = await t.call(`/v1/activities/${padel.id}/chat/messages`, {
      headers: outsider.headers,
    });
    expect(res.status).toBe(403);
  });

  it('returns history oldest first with senders and system lines', async () => {
    const { headers } = await t.signIn();
    const padel = await padelFor(headers);
    const res = await t.call<MessagesPage>(`/v1/activities/${padel.id}/chat/messages`, { headers });
    expect(res.body.messages.map((m) => [m.kind, m.sender?.name ?? null, m.body])).toEqual([
      ['user', 'Shehani', 'Court 2 booked for 06:30.'],
      ['system', null, 'Kavindu joined'],
      ['user', 'Shehani', 'Perfect. Meet at reception at 06:20.'],
    ]);
    expect(res.body.othersReadUpTo).toBeNull();
  });

  it('treats a resend with the same id as the same message', async () => {
    const { headers } = await t.signIn();
    const padel = await padelFor(headers);
    const body = { id: randomUUID(), body: 'On my way' };
    const path = `/v1/activities/${padel.id}/chat/messages`;

    const first = await t.call<ChatMessage>(path, { method: 'POST', headers, body });
    const retry = await t.call<ChatMessage>(path, { method: 'POST', headers, body });
    expect([first.status, retry.status]).toEqual([201, 200]);
    expect(retry.body.id).toBe(first.body.id);
    const rows = await t.deps.db.select().from(messages).where(eq(messages.id, body.id));
    expect(rows).toHaveLength(1);

    // Someone else can't hijack that id.
    const host = await t.signIn('shehani@buddy.test');
    const stolen = await t.call(path, { method: 'POST', headers: host.headers, body });
    expect(stolen.status).toBe(409);
  });

  it('catches up with messages after a given one', async () => {
    const { headers } = await t.signIn();
    const padel = await padelFor(headers);
    const path = `/v1/activities/${padel.id}/chat/messages`;
    const history = await t.call<MessagesPage>(path, { headers });
    const firstId = history.body.messages[0]!.id;
    await t.call(path, { method: 'POST', headers, body: { id: randomUUID(), body: 'New one' } });

    const after = await t.call<MessagesPage>(`${path}?after=${firstId}`, { headers });
    expect(after.body.messages.map((m) => m.body)).toEqual([
      'Kavindu joined',
      'Perfect. Meet at reception at 06:20.',
      'New one',
    ]);
  });
});

describe('chat in real time', () => {
  it('delivers messages, typing and read receipts to the other member', async () => {
    const server = await t.listen();
    try {
      const kavindu = await t.signIn();
      const shehani = await t.signIn('shehani@buddy.test');
      const padel = await padelFor(kavindu.headers);
      const wsPath = `/v1/activities/${padel.id}/chat/ws`;

      const k = server.connect(wsPath, kavindu.headers);
      const s = server.connect(wsPath, shehani.headers);
      await Promise.all([k.opened, s.opened]);

      // Message sent over HTTP arrives on Shehani's socket.
      const sent = await t.call<ChatMessage>(`/v1/activities/${padel.id}/chat/messages`, {
        method: 'POST',
        headers: kavindu.headers,
        body: { id: randomUUID(), body: 'See you at 6:20' },
      });
      const received = await waitFor<{ message: ChatMessage }>(
        s.events,
        (e) => e.type === 'message',
      );
      expect(received.message).toMatchObject({
        id: sent.body.id,
        body: 'See you at 6:20',
        sender: { name: 'Kavindu Perera' },
      });

      // Typing goes to others only, and is throttled.
      k.ws.send(JSON.stringify({ type: 'typing' }));
      k.ws.send(JSON.stringify({ type: 'typing' }));
      await waitFor(s.events, (e) => e.type === 'typing');
      await new Promise((r) => setTimeout(r, 100));
      expect(s.events.filter((e) => (e as ServerEvent).type === 'typing')).toHaveLength(1);
      expect(k.events.some((e) => (e as ServerEvent).type === 'typing')).toBe(false);

      // Shehani reads it; Kavindu sees "Seen".
      await t.call(`/v1/activities/${padel.id}/chat/read`, {
        method: 'POST',
        headers: shehani.headers,
        body: { messageId: sent.body.id },
      });
      const read = await waitFor<{ upTo: string }>(k.events, (e) => e.type === 'read');
      expect(read.upTo).toBe(sent.body.createdAt);
      const page = await t.call<MessagesPage>(`/v1/activities/${padel.id}/chat/messages`, {
        headers: kavindu.headers,
      });
      expect(page.body.othersReadUpTo).toBe(sent.body.createdAt);

      // Push goes to members who aren't connected; sender and connected users are skipped.
      expect(pushes).toHaveLength(1);
      expect(pushes[0]!.except).toEqual([kavindu.userId, shehani.userId].sort());
      expect(pushes[0]!.message.body).toBe('Kavindu Perera: See you at 6:20');
    } finally {
      await server.close();
    }
  });

  it('refuses sockets from non-members and signed-out clients', async () => {
    const server = await t.listen();
    try {
      const outsider = await t.signIn('outsider@buddy.test', 'Outsider');
      const padel = await padelFor(outsider.headers);
      const path = `/v1/activities/${padel.id}/chat/ws`;
      await expect(server.connect(path, outsider.headers).opened).rejects.toThrow('HTTP 403');
      await expect(server.connect(path, {}).opened).rejects.toThrow('HTTP 401');
    } finally {
      await server.close();
    }
  });

  it('closes your socket when you leave, and tells the others', async () => {
    const server = await t.listen();
    try {
      const kavindu = await t.signIn();
      const shehani = await t.signIn('shehani@buddy.test');
      const padel = await padelFor(kavindu.headers);
      const wsPath = `/v1/activities/${padel.id}/chat/ws`;
      const k = server.connect(wsPath, kavindu.headers);
      const s = server.connect(wsPath, shehani.headers);
      await Promise.all([k.opened, s.opened]);

      const closed = new Promise<number>((resolve) => k.ws.once('close', (code) => resolve(code)));
      await t.call(`/v1/activities/${padel.id}/membership`, {
        method: 'DELETE',
        headers: kavindu.headers,
      });

      expect(await closed).toBe(4403);
      const left = await waitFor<{ message: ChatMessage }>(s.events, (e) => e.type === 'message');
      expect(left.message).toMatchObject({ kind: 'system', body: 'Kavindu left' });
    } finally {
      await server.close();
    }
  });
});

describe('Expo push sender', () => {
  it('sends to members not excluded and forgets uninstalled devices', async () => {
    const { db } = t.deps;
    const kavindu = await t.signIn();
    const nethmi = await t.signIn('nethmi@buddy.test');
    const shehani = await t.signIn('shehani@buddy.test');
    await db.insert(pushTokens).values([
      { token: 'ExponentPushToken[kavindu]', userId: kavindu.userId },
      { token: 'ExponentPushToken[nethmi]', userId: nethmi.userId },
      { token: 'ExponentPushToken[shehani]', userId: shehani.userId },
    ]);
    const padel = await padelFor(kavindu.headers); // Kavindu, Nethmi, Shehani are all going

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const batch = JSON.parse(String(init.body)) as { to: string }[];
      return new Response(
        JSON.stringify({
          data: batch.map((m) =>
            m.to.includes('nethmi')
              ? { status: 'error', details: { error: 'DeviceNotRegistered' } }
              : { status: 'ok' },
          ),
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const sender = createPushSender(db, t.deps.logger);
      await sender.notifyActivity(padel.id, { title: 'Padel', body: 'Hi', data: {} }, [
        kavindu.userId,
      ]);
    } finally {
      vi.unstubAllGlobals();
    }

    const sentTo = (JSON.parse(String(fetchMock.mock.calls[0]![1].body)) as { to: string }[])
      .map((m) => m.to)
      .sort();
    expect(sentTo).toEqual(['ExponentPushToken[nethmi]', 'ExponentPushToken[shehani]']);
    const remaining = (await db.select({ token: pushTokens.token }).from(pushTokens))
      .map((r) => r.token)
      .sort();
    expect(remaining).toEqual(['ExponentPushToken[kavindu]', 'ExponentPushToken[shehani]']);
  });
});
