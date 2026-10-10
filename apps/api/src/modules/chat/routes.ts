import { clientEvent, markReadInput, messagesQuery, sendMessageInput } from '@buddy/shared';
import { upgradeWebSocket } from '@hono/node-server';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { WebSocket } from 'ws';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { limits, MINUTE } from '../../lib/rate-limit';
import { forbidden } from '../../lib/errors';
import { idParam, validate } from '../../lib/validate';
import type { Peer } from '../../realtime/hub';
import { blockedIds } from '../safety/blocks';
import { listMessages, markRead, requireMember, sendMessage } from './service';

const HEARTBEAT_MS = 30_000;
const TYPING_THROTTLE_MS = 2_000;
const PUSH_PREVIEW_CHARS = 120;

type ChatEnv = AppEnv & { Variables: { activityTitle: string } };

/** Chat for one activity, mounted under /v1/activities/:id/chat. */
export function chatRoutes(deps: Deps) {
  const { db, urls, hub, push, logger } = deps;
  // Each message can push to everyone in the chat.
  const sending = limits(deps)({ name: 'chat', limit: 30, windowMs: MINUTE, by: 'user' });
  const memberOnly = createMiddleware<ChatEnv>(async (c, next) => {
    const { title } = await requireMember(db, c.req.param('id')!, currentUser(c).id);
    c.set('activityTitle', title);
    await next();
  });

  /**
   * Browsers send cookies with cross-site WebSocket requests, so refuse other
   * sites' pages. The apps send no Origin, or the address they connected to
   * (or the API's public one); the web app's origins are in WEB_ORIGINS.
   */
  const sameSiteOnly = createMiddleware<ChatEnv>(async (c, next) => {
    const origin = c.req.header('origin');
    const ownOrigin = new URL(deps.env.BETTER_AUTH_URL).origin;
    if (origin && origin !== ownOrigin && !deps.env.WEB_ORIGINS.includes(origin)) {
      let host: string | null = null;
      try {
        host = new URL(origin).host;
      } catch {
        // Not a URL: treat as foreign.
      }
      if (host !== c.req.header('host')) throw forbidden('Chat isn’t available from this site');
    }
    await next();
  });

  return (
    new Hono<ChatEnv>()
      .use(requireUser, idParam(), memberOnly)

      .get('/messages', validate('query', messagesQuery), async (c) => {
        const q = c.req.valid('query');
        return c.json(await listMessages(db, urls, c.req.param('id')!, currentUser(c).id, q));
      })

      .post('/messages', sending, validate('json', sendMessageInput), async (c) => {
        const me = currentUser(c);
        const activityId = c.req.param('id')!;
        const { message, created } = await sendMessage(
          db,
          urls,
          me.id,
          activityId,
          c.req.valid('json'),
        );
        if (created) {
          // Everyone connected, including the sender's other devices (apps dedupe
          // by id), except people on either side of a block with the sender.
          const blocked = await blockedIds(db, me.id);
          hub.publish(activityId, { type: 'message', message }, { except: blocked });
          const preview =
            message.body.length > PUSH_PREVIEW_CHARS
              ? `${message.body.slice(0, PUSH_PREVIEW_CHARS)}…`
              : message.body;
          void push.notifyActivity(
            activityId,
            {
              title: c.get('activityTitle'),
              body: `${me.name}: ${preview}`,
              data: { activityId, screen: 'chat' },
              channelId: 'chat',
            },
            new Set([me.id, ...blocked, ...hub.connectedUsers(activityId)]),
          );
        }
        return c.json(message, created ? 201 : 200);
      })

      .post('/read', validate('json', markReadInput), async (c) => {
        const me = currentUser(c);
        const activityId = c.req.param('id')!;
        const upTo = await markRead(db, activityId, me.id, c.req.valid('json').messageId);
        const blocked = await blockedIds(db, me.id);
        hub.publish(
          activityId,
          { type: 'read', userId: me.id, upTo },
          { except: [me.id, ...blocked] },
        );
        return c.json({ upTo });
      })

      // Live events. Sign-in and membership are checked above, before upgrading.
      .get(
        '/ws',
        sameSiteOnly,
        upgradeWebSocket((c) => {
          const me = currentUser(c);
          const activityId = c.req.param('id')!;
          let leave: (() => void) | undefined;
          let heartbeat: ReturnType<typeof setInterval> | undefined;
          let lastTyping = 0;

          return {
            onOpen(_event, ws) {
              const raw = ws.raw as unknown as WebSocket;
              const peer: Peer = {
                userId: me.id,
                send: (event) => {
                  if (ws.readyState === 1) ws.send(JSON.stringify(event));
                },
                close: () => ws.close(4403, 'No longer a member'),
              };
              leave = hub.join(activityId, peer);
              // Membership was checked before upgrading; someone removed (or who
              // left) in between would otherwise keep receiving the chat.
              requireMember(db, activityId, me.id).catch(() => {
                leave?.();
                ws.close(4403, 'Not a member');
              });

              // Detect phones that vanished without closing (tunnels, airplane mode).
              let alive = true;
              raw.on('pong', () => (alive = true));
              heartbeat = setInterval(() => {
                if (!alive) return raw.terminate();
                alive = false;
                raw.ping();
              }, HEARTBEAT_MS);
            },

            onMessage(event) {
              let parsed;
              try {
                parsed = clientEvent.safeParse(JSON.parse(String(event.data)));
              } catch {
                return;
              }
              if (!parsed.success) return;
              if (parsed.data.type === 'typing') {
                const now = Date.now();
                if (now - lastTyping < TYPING_THROTTLE_MS) return;
                lastTyping = now;
                blockedIds(db, me.id)
                  .then((blocked) =>
                    hub.publish(
                      activityId,
                      { type: 'typing', user: { id: me.id, name: me.name, avatarUrl: null } },
                      { except: [me.id, ...blocked] },
                    ),
                  )
                  .catch((err: unknown) => logger.warn({ err, activityId }, 'Typing event failed'));
              }
            },

            onClose() {
              clearInterval(heartbeat);
              leave?.();
            },

            onError(err) {
              logger.warn({ err, activityId }, 'Chat socket error');
            },
          };
        }),
      )
  );
}
