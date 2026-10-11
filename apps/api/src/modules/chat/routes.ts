import {
  clientEvent,
  editMessageInput,
  firstName,
  markReadInput,
  messageSummary,
  messagesQuery,
  reactInput,
  sendMessageInput,
  voteInput,
} from '@buddy/shared';
import { upgradeWebSocket } from '@hono/node-server';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import type { WebSocket } from 'ws';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { limits, MINUTE } from '../../lib/rate-limit';
import { forbidden } from '../../lib/errors';
import { idParam, validate } from '../../lib/validate';
import type { Peer } from '../../realtime/hub';
import { blockedIds } from '../safety/blocks';
import { communityMembers } from '../../db/schema';
import type { PushMessage } from '../../lib/push';
import { listChats } from './list';
import {
  deleteMessage,
  editMessage,
  listMessages,
  markRead,
  react,
  requireMember,
  type Room,
  sendMessage,
  vote,
} from './service';

const HEARTBEAT_MS = 30_000;
const TYPING_THROTTLE_MS = 2_000;
const PUSH_PREVIEW_CHARS = 120;

type ChatEnv = AppEnv & { Variables: { chatTitle: string } };

/**
 * A group chat, mounted under /v1/activities/:id/chat (everyone going) and
 * /v1/communities/:id/chat (its members).
 */
export function chatRoutes(deps: Deps, kind: Room['kind']) {
  const { db, urls, hub, push, logger, storage } = deps;
  const roomOf = (id: string): Room => ({ kind, id });

  /** Pushes a message to the chat's members, except these (and anyone who muted it). */
  const notify = async (room: Room, message: PushMessage, except: Set<string>) => {
    if (room.kind === 'activity') return push.notifyActivity(room.id, message, except);
    const members = await db
      .select({ userId: communityMembers.userId })
      .from(communityMembers)
      .where(and(eq(communityMembers.communityId, room.id), eq(communityMembers.chatMuted, false)));
    await push.notifyUsers(
      members.map((m) => m.userId).filter((id) => !except.has(id)),
      message,
    );
  };
  // Each message can push to everyone in the chat.
  const sending = limits(deps)({ name: 'chat', limit: 30, windowMs: MINUTE, by: 'user' });
  const voting = limits(deps)({ name: 'votes', limit: 60, windowMs: MINUTE, by: 'user' });
  const memberOnly = createMiddleware<ChatEnv>(async (c, next) => {
    const { title } = await requireMember(db, roomOf(c.req.param('id')!), currentUser(c).id);
    c.set('chatTitle', title);
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
        return c.json(
          await listMessages(db, urls, roomOf(c.req.param('id')!), currentUser(c).id, q),
        );
      })

      .post('/messages', sending, validate('json', sendMessageInput), async (c) => {
        const me = currentUser(c);
        const room = roomOf(c.req.param('id')!);
        const { message, created } = await sendMessage(
          db,
          { urls, storage },
          me.id,
          room,
          c.req.valid('json'),
        );
        if (created) {
          // Everyone connected, including the sender's other devices (apps dedupe
          // by id), except people on either side of a block with the sender.
          const blocked = await blockedIds(db, me.id);
          hub.publish(room.id, { type: 'message', message }, { except: blocked });
          const summary = messageSummary({
            body: message.body,
            hasImage: !!message.image,
            pollQuestion: message.poll?.question,
          });
          const preview =
            summary.length > PUSH_PREVIEW_CHARS
              ? `${summary.slice(0, PUSH_PREVIEW_CHARS)}…`
              : summary;
          const data = { [`${kind}Id`]: room.id, screen: 'chat' };
          const skip = new Set([me.id, ...blocked, ...hub.connectedUsers(room.id)]);
          // Tagged people hear about it even if they muted the chat.
          const mentioned = message.mentions.map((m) => m.id).filter((id) => !skip.has(id));
          if (mentioned.length) {
            void push.notifyUsers(mentioned, {
              title: `${firstName(me.name)} mentioned you in ${c.get('chatTitle')}`,
              body: preview,
              data,
              channelId: 'chat',
            });
          }
          void notify(
            room,
            {
              title: c.get('chatTitle'),
              body: `${me.name}: ${preview}`,
              data,
              channelId: 'chat',
            },
            new Set([...skip, ...mentioned]),
          ).catch((err: unknown) => logger.error({ err, room }, 'Chat push failed'));
        }
        return c.json(message, created ? 201 : 200);
      })

      // Change your message's text (for a few minutes after sending).
      .patch(
        '/messages/:messageId',
        sending,
        validate('param', z.object({ id: z.uuid(), messageId: z.uuid() })),
        validate('json', editMessageInput),
        async (c) => {
          const me = currentUser(c);
          const room = roomOf(c.req.param('id')!);
          const message = await editMessage(
            db,
            urls,
            room,
            me.id,
            c.req.valid('param').messageId,
            c.req.valid('json'),
          );
          const blocked = await blockedIds(db, me.id);
          hub.publish(room.id, { type: 'updated', message }, { except: blocked });
          return c.json(message);
        },
      )

      // Delete your message (it shows as "This message was deleted").
      .delete(
        '/messages/:messageId',
        validate('param', z.object({ id: z.uuid(), messageId: z.uuid() })),
        async (c) => {
          const me = currentUser(c);
          const room = roomOf(c.req.param('id')!);
          const { message, removedPhoto } = await deleteMessage(
            db,
            urls,
            room,
            me.id,
            c.req.valid('param').messageId,
          );
          if (removedPhoto && storage) {
            await storage
              .remove([removedPhoto])
              .catch((err: unknown) => logger.error({ err }, 'Could not delete chat photo'));
          }
          hub.publish(room.id, { type: 'updated', message });
          return c.json(message);
        },
      )

      // React to a message (or change or take back your reaction).
      .post(
        '/messages/:messageId/react',
        voting,
        validate('param', z.object({ id: z.uuid(), messageId: z.uuid() })),
        validate('json', reactInput),
        async (c) => {
          const me = currentUser(c);
          const room = roomOf(c.req.param('id')!);
          const { messageId } = c.req.valid('param');
          const reactions = await react(db, room, me.id, messageId, c.req.valid('json').emoji);
          hub.publish(room.id, { type: 'reactions', messageId, reactions });
          return c.json({ messageId, reactions });
        },
      )

      // Answer a poll (or change or take back your answer).
      .post(
        '/messages/:messageId/vote',
        voting,
        validate('param', z.object({ id: z.uuid(), messageId: z.uuid() })),
        validate('json', voteInput),
        async (c) => {
          const me = currentUser(c);
          const room = roomOf(c.req.param('id')!);
          const message = await vote(
            db,
            urls,
            room,
            me.id,
            c.req.valid('param').messageId,
            c.req.valid('json').optionIds,
          );
          hub.publish(room.id, { type: 'poll', messageId: message.id, poll: message.poll! });
          return c.json(message);
        },
      )

      .post('/read', validate('json', markReadInput), async (c) => {
        const me = currentUser(c);
        const roomId = c.req.param('id')!;
        const upTo = await markRead(db, roomOf(roomId), me.id, c.req.valid('json').messageId);
        const blocked = await blockedIds(db, me.id);
        hub.publish(roomId, { type: 'read', userId: me.id, upTo }, { except: [me.id, ...blocked] });
        return c.json({ upTo });
      })

      // Live events. Sign-in and membership are checked above, before upgrading.
      .get(
        '/ws',
        sameSiteOnly,
        upgradeWebSocket((c) => {
          const me = currentUser(c);
          const roomId = c.req.param('id')!;
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
              leave = hub.join(roomId, peer);
              // Membership was checked before upgrading; someone removed (or who
              // left) in between would otherwise keep receiving the chat.
              requireMember(db, roomOf(roomId), me.id).catch(() => {
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
                      roomId,
                      { type: 'typing', user: { id: me.id, name: me.name, avatarUrl: null } },
                      { except: [me.id, ...blocked] },
                    ),
                  )
                  .catch((err: unknown) => logger.warn({ err, roomId }, 'Typing event failed'));
              }
            },

            onClose() {
              clearInterval(heartbeat);
              leave?.();
            },

            onError(err) {
              logger.warn({ err, roomId }, 'Chat socket error');
            },
          };
        }),
      )
  );
}

/** GET /v1/chats: all your group chats, for the Chats screen and unread badges. */
export function chatListRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .use(requireUser)
    .get('/', async (c) => c.json({ chats: await listChats(deps.db, currentUser(c).id) }));
}
