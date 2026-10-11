import type { ActivitySummary } from '@buddy/shared';
import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';

import { useTestApp } from './harness';

const t = useTestApp({ env: { ADMIN_EMAILS: 'mod@buddy.test' } });

/** Kavindu and Shehani are both going to the seeded padel game. */
async function padelChat(headers: Record<string, string>) {
  const res = await t.call<{ activities: ActivitySummary[] }>('/v1/activities', { headers });
  const padel = res.body.activities.find((a) => a.title.startsWith('Padel'))!;
  return `/v1/activities/${padel.id}/chat/ws`;
}

const closedWith = (ws: WebSocket) =>
  new Promise<number>((resolve) => ws.once('close', (code) => resolve(code)));

describe('chat socket limits', () => {
  it('cuts off a suspended person’s open chats', async () => {
    const server = await t.listen();
    try {
      const shehani = await t.signIn('shehani@buddy.test');
      const path = await padelChat(shehani.headers);
      const s = server.connect(path, shehani.headers);
      await s.opened;
      const closed = closedWith(s.ws);

      const mod = await t.signIn('mod@buddy.test', 'Moderator');
      const res = await t.call(`/v1/admin/people/${shehani.userId}/suspend`, {
        method: 'POST',
        headers: mod.headers,
      });
      expect(res.status).toBe(200);
      expect(await closed).toBe(4403);
    } finally {
      await server.close();
    }
  });

  it('closes a socket that sends an oversized message', async () => {
    const server = await t.listen();
    try {
      const kavindu = await t.signIn();
      const k = server.connect(await padelChat(kavindu.headers), kavindu.headers);
      await k.opened;
      const closed = closedWith(k.ws);
      k.ws.send(JSON.stringify({ type: 'typing', pad: 'x'.repeat(10_000) }));
      expect(await closed).toBe(1009); // "message too big"
    } finally {
      await server.close();
    }
  });

  it('keeps a few connections per person to a chat, closing the oldest', async () => {
    const server = await t.listen();
    try {
      const kavindu = await t.signIn();
      const path = await padelChat(kavindu.headers);
      const first = server.connect(path, kavindu.headers);
      await first.opened;
      const closed = closedWith(first.ws);
      for (let i = 0; i < 3; i++) await server.connect(path, kavindu.headers).opened;
      expect(await closed).toBe(4403);
    } finally {
      await server.close();
    }
  });
});
