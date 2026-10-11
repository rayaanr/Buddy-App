import {
  DELETED_ACCOUNT,
  LIMITS,
  messageSummary,
  REACTIONS,
  type ChatMessage,
  type MessagesPage,
  type Reaction,
  type SendMessageInput,
} from '@buddy/shared';
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';

import type { Db, Tx } from '../../db/client';
import {
  activities,
  activityMembers,
  chatReads,
  communities,
  communityChatReads,
  communityMembers,
  messageReactions,
  messages,
  pollVotes,
  profiles,
  reports,
  user,
} from '../../db/schema';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import type { Storage } from '../../lib/storage';
import { requireUpload } from '../../lib/upload-keys';
import type { Urls } from '../../lib/urls';
import { blockedIds, notBlockedBetween } from '../safety/blocks';

export type MessageRow = typeof messages.$inferSelect;

/** A group chat: an activity's (everyone going) or a community's (its members). */
export interface Room {
  kind: 'activity' | 'community';
  id: string;
}

/** The column that says which chat a message is in. */
const roomColumn = (room: Room) =>
  room.kind === 'activity' ? messages.activityId : messages.communityId;

/** Which chat a stored message is in. */
export const roomOf = (m: { activityId: string | null; communityId: string | null }): Room =>
  m.activityId ? { kind: 'activity', id: m.activityId } : { kind: 'community', id: m.communityId! };

/**
 * Only members can read or write a chat: people going (host included) for an
 * activity, members for a community. Returns the chat's name.
 */
export async function requireMember(db: Db, room: Room, userId: string) {
  if (room.kind === 'community') {
    const [row] = await db
      .select({ name: communities.name, member: communityMembers.userId })
      .from(communities)
      .leftJoin(
        communityMembers,
        and(eq(communityMembers.communityId, communities.id), eq(communityMembers.userId, userId)),
      )
      .where(eq(communities.id, room.id));
    if (!row) throw notFound('Community');
    if (!row.member) throw forbidden('Join this community to see its chat');
    return { title: row.name };
  }
  const [row] = await db
    .select({ id: activities.id, title: activities.title, role: activityMembers.role })
    .from(activities)
    .leftJoin(
      activityMembers,
      and(eq(activityMembers.activityId, activities.id), eq(activityMembers.userId, userId)),
    )
    .where(eq(activities.id, room.id));
  if (!row) throw notFound('Activity');
  if (!row.role) throw forbidden('Join this activity to see its chat');
  return { title: row.title };
}

/** Attaches senders, @mentioned names, photo URLs and poll votes to stored messages. */
/**
 * Messages as the app shows them. With a viewer, people blocked either way
 * are left out of what's around each message too: quotes of their messages,
 * their reactions and votes, and mentions of them.
 */
async function toChatMessages(
  db: Db,
  urls: Urls,
  rows: MessageRow[],
  viewerId?: string,
): Promise<ChatMessage[]> {
  const blocked = new Set(viewerId ? await blockedIds(db, viewerId) : []);
  const shown = (userId: string | null) => !userId || !blocked.has(userId);
  const peopleIds = [
    ...new Set(rows.flatMap((r) => [r.senderId, ...r.mentions]).filter((id): id is string => !!id)),
  ];
  const people = peopleIds.length
    ? await db
        .select({
          id: user.id,
          name: user.name,
          avatarKey: profiles.avatarKey,
          avatarUrl: profiles.avatarUrl,
        })
        .from(user)
        .leftJoin(profiles, eq(profiles.userId, user.id))
        .where(inArray(user.id, peopleIds))
    : [];
  const byId = new Map(
    people.map((s) => [
      s.id,
      { id: s.id, name: s.name, avatarUrl: urls.avatar(s.avatarKey, s.avatarUrl) },
    ]),
  );

  // The messages replied to, for their one-line quotes.
  const replyIds = [...new Set(rows.map((r) => r.replyToId).filter((id): id is string => !!id))];
  const quoted = replyIds.length
    ? await db
        .select({
          id: messages.id,
          body: messages.body,
          imageKey: messages.imageKey,
          imageWidth: messages.imageWidth,
          poll: messages.poll,
          deletedAt: messages.deletedAt,
          senderId: messages.senderId,
          senderName: user.name,
        })
        .from(messages)
        .leftJoin(user, eq(user.id, messages.senderId))
        .where(inArray(messages.id, replyIds))
    : [];
  const quoteById = new Map(quoted.filter((q) => shown(q.senderId)).map((q) => [q.id, q]));

  const messageIds = rows.map((r) => r.id);
  const reactionRows = messageIds.length
    ? await db
        .select({
          messageId: messageReactions.messageId,
          userId: messageReactions.userId,
          emoji: messageReactions.emoji,
        })
        .from(messageReactions)
        .where(inArray(messageReactions.messageId, messageIds))
        .orderBy(asc(messageReactions.createdAt))
    : [];

  const pollIds = rows.filter((r) => r.poll).map((r) => r.id);
  const votes = pollIds.length
    ? await db
        .select({
          messageId: pollVotes.messageId,
          userId: pollVotes.userId,
          optionId: pollVotes.optionId,
        })
        .from(pollVotes)
        .where(inArray(pollVotes.messageId, pollIds))
        .orderBy(asc(pollVotes.createdAt))
    : [];

  return rows.map((r) => {
    // Deleted: nothing of it is shown (a reported one keeps its content for moderators).
    const gone = !!r.deletedAt;
    const imageUrl = r.imageKey && !gone ? urls.fromKey(r.imageKey) : null;
    return {
      id: r.id,
      activityId: r.activityId,
      communityId: r.communityId,
      kind: r.kind as ChatMessage['kind'],
      // A person's own message whose sender is gone: they deleted their account.
      sender: r.senderId
        ? (byId.get(r.senderId) ?? DELETED_ACCOUNT)
        : r.kind === 'user'
          ? DELETED_ACCOUNT
          : null,
      body: gone ? '' : r.body,
      image: imageUrl
        ? { url: imageUrl, width: r.imageWidth ?? 1, height: r.imageHeight ?? 1 }
        : null,
      // The size stays when the photo is deleted for age.
      photoExpired: !gone && !r.imageKey && r.imageWidth !== null,
      mentions: (gone ? [] : r.mentions).flatMap((id) => {
        const person = byId.get(id);
        return person && shown(id) ? [{ id, name: person.name }] : [];
      }),
      poll:
        r.poll && !gone
          ? {
              question: r.poll.question,
              multiple: r.poll.multiple,
              options: r.poll.options.map((o) => ({
                ...o,
                voterIds: votes
                  .filter((v) => v.messageId === r.id && v.optionId === o.id && shown(v.userId))
                  .map((v) => v.userId),
              })),
            }
          : null,
      replyTo: r.deletedAt ? null : quoteOf(r.replyToId ? quoteById.get(r.replyToId) : undefined),
      reactions: r.deletedAt
        ? []
        : groupReactions(reactionRows.filter((x) => x.messageId === r.id && shown(x.userId))),
      editedAt: r.editedAt?.toISOString() ?? null,
      deleted: !!r.deletedAt,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

const QUOTE_CHARS = 140;

/** A message replied to, as "Shehani: Court 2 booked…" (or "📷 Photo", "📊 Question"). */
function quoteOf(
  q:
    | {
        id: string;
        body: string;
        imageKey: string | null;
        imageWidth: number | null;
        poll: { question: string } | null;
        deletedAt: Date | null;
        senderName: string | null;
      }
    | undefined,
) {
  if (!q) return null;
  if (q.deletedAt) return { id: q.id, senderName: q.senderName, summary: 'Message deleted' };
  const summary = messageSummary({
    body: q.body,
    hasImage: !!q.imageKey || q.imageWidth !== null,
    pollQuestion: q.poll?.question,
  });
  return {
    id: q.id,
    senderName: q.senderName,
    summary: summary.length > QUOTE_CHARS ? `${summary.slice(0, QUOTE_CHARS)}…` : summary,
  };
}

/** Reactions grouped by emoji, most used first (ties: first used first). */
function groupReactions(rows: { userId: string; emoji: string }[]) {
  const byEmoji = new Map<string, string[]>();
  for (const r of rows) byEmoji.set(r.emoji, [...(byEmoji.get(r.emoji) ?? []), r.userId]);
  return [...byEmoji.entries()]
    .filter((e): e is [Reaction, string[]] => (REACTIONS as readonly string[]).includes(e[0]))
    .sort((a, b) => b[1].length - a[1].length)
    .map(([emoji, userIds]) => ({ emoji, userIds }));
}

export async function toChatMessage(db: Db, urls: Urls, row: MessageRow) {
  const [message] = await toChatMessages(db, urls, [row]);
  return message!;
}

/** Latest point any other member has read to; drives "Seen" on your messages. */
async function othersReadUpTo(db: Db, room: Room, viewerId: string) {
  const [row] =
    room.kind === 'activity'
      ? await db
          .select({ upTo: sql<Date | null>`max(${chatReads.lastReadAt})` })
          .from(chatReads)
          .where(
            and(
              eq(chatReads.activityId, room.id),
              ne(chatReads.userId, viewerId),
              notBlockedBetween(viewerId, chatReads.userId),
            ),
          )
      : await db
          .select({ upTo: sql<Date | null>`max(${communityChatReads.lastReadAt})` })
          .from(communityChatReads)
          .where(
            and(
              eq(communityChatReads.communityId, room.id),
              ne(communityChatReads.userId, viewerId),
              notBlockedBetween(viewerId, communityChatReads.userId),
            ),
          );
  return row?.upTo ? new Date(row.upTo).toISOString() : null;
}

/**
 * Messages oldest first. With `after`, returns what came after that message
 * (catch-up after a reconnect); otherwise the latest `limit` messages.
 * Messages from people the viewer blocked, or who blocked them, are left out.
 */
export async function listMessages(
  db: Db,
  urls: Urls,
  room: Room,
  viewerId: string,
  { after, before, limit }: { after?: string; before?: string; limit: number },
): Promise<MessagesPage> {
  const inRoom = eq(roomColumn(room), room.id);
  const visible = or(isNull(messages.senderId), notBlockedBetween(viewerId, messages.senderId));
  const cursorOf = async (id: string) => {
    const [cursor] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.id, id), inRoom));
    if (!cursor) throw notFound('Message');
    return cursor.createdAt;
  };
  let rows: MessageRow[];
  let hasMore = false;
  if (after) {
    const at = await cursorOf(after);
    rows = await db
      .select()
      .from(messages)
      .where(
        and(
          inRoom,
          visible,
          or(gt(messages.createdAt, at), and(eq(messages.createdAt, at), gt(messages.id, after))),
        ),
      )
      .orderBy(asc(messages.createdAt), asc(messages.id))
      .limit(limit);
  } else {
    // The latest `limit` (or those just before `before`); one extra says whether there's more.
    const at = before ? await cursorOf(before) : null;
    const newest = await db
      .select()
      .from(messages)
      .where(
        and(
          inRoom,
          visible,
          at && before
            ? or(
                lt(messages.createdAt, at),
                and(eq(messages.createdAt, at), lt(messages.id, before)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1);
    hasMore = newest.length > limit;
    rows = newest.slice(0, limit).reverse();
  }
  return {
    messages: await toChatMessages(db, urls, rows, viewerId),
    othersReadUpTo: await othersReadUpTo(db, room, viewerId),
    myReadUpTo: await readUpTo(db, room, viewerId),
    hasMore,
  };
}

/** How far the viewer has read this chat. */
async function readUpTo(db: Db, room: Room, viewerId: string) {
  const [row] =
    room.kind === 'activity'
      ? await db
          .select({ at: chatReads.lastReadAt })
          .from(chatReads)
          .where(and(eq(chatReads.activityId, room.id), eq(chatReads.userId, viewerId)))
      : await db
          .select({ at: communityChatReads.lastReadAt })
          .from(communityChatReads)
          .where(
            and(
              eq(communityChatReads.communityId, room.id),
              eq(communityChatReads.userId, viewerId),
            ),
          );
  return row?.at.toISOString() ?? null;
}

/**
 * Stores a message. The ID comes from the app, so a retried send returns the
 * original message instead of creating a duplicate (`created: false`).
 */
export async function sendMessage(
  db: Db,
  { urls, storage }: { urls: Urls; storage: Storage | null },
  senderId: string,
  room: Room,
  input: SendMessageInput,
) {
  const [existing] = await db.select().from(messages).where(eq(messages.id, input.id));
  if (existing) {
    // A retry of a message that already went through.
    const sameRoom = (existing[`${room.kind}Id`] as string | null) === room.id;
    if (existing.senderId !== senderId || !sameRoom) throw conflict('Message ID already used');
    return { message: await toChatMessage(db, urls, existing), created: false };
  }

  if (input.imageKey) await requireUpload(storage, input.imageKey, 'chat', senderId);
  const mentions = await membersAmong(db, room, senderId, input.mentions);
  // A reply must point at a message in this chat; anything else is dropped.
  const [replyTo] = input.replyToId
    ? await db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.id, input.replyToId), eq(roomColumn(room), room.id)))
    : [];
  const where = room.kind === 'activity' ? { activityId: room.id } : { communityId: room.id };
  const [inserted] = await db
    .insert(messages)
    .values({
      id: input.id,
      ...where,
      senderId,
      kind: 'user',
      body: input.body,
      imageKey: input.imageKey ?? null,
      imageWidth: input.imageKey ? (input.imageWidth ?? null) : null,
      imageHeight: input.imageKey ? (input.imageHeight ?? null) : null,
      mentions,
      replyToId: replyTo?.id ?? null,
      poll: input.poll
        ? {
            question: input.poll.question,
            multiple: input.poll.multiple,
            options: input.poll.options.map((text, k) => ({ id: `o${k + 1}`, text })),
          }
        : null,
    })
    .onConflictDoNothing({ target: messages.id })
    .returning();
  // Two copies of the same send racing: the other one stored it.
  if (!inserted) return sendMessage(db, { urls, storage }, senderId, room, input);
  return { message: await toChatMessage(db, urls, inserted), created: true };
}

/**
 * The people in `ids` who are in this chat, minus the sender and anyone on
 * either side of a block with them: who an @mention can reach.
 */
async function membersAmong(db: Db, room: Room, senderId: string, ids: string[]) {
  const wanted = [...new Set(ids)].filter((id) => id !== senderId);
  if (!wanted.length) return [];
  const rows =
    room.kind === 'activity'
      ? await db
          .select({ id: activityMembers.userId })
          .from(activityMembers)
          .where(
            and(
              eq(activityMembers.activityId, room.id),
              inArray(activityMembers.userId, wanted),
              notBlockedBetween(senderId, activityMembers.userId),
            ),
          )
      : await db
          .select({ id: communityMembers.userId })
          .from(communityMembers)
          .where(
            and(
              eq(communityMembers.communityId, room.id),
              inArray(communityMembers.userId, wanted),
              notBlockedBetween(senderId, communityMembers.userId),
            ),
          );
  const found = new Set(rows.map((r) => r.id));
  return wanted.filter((id) => found.has(id));
}

/**
 * Records your answer to a poll, replacing any earlier one; no options takes
 * your vote back. Returns the message with the new totals.
 */
export async function vote(
  db: Db,
  urls: Urls,
  room: Room,
  userId: string,
  messageId: string,
  optionIds: string[],
) {
  // One vote at a time per poll: two at once could otherwise both clear the
  // old answer and both insert, giving two answers in a pick-one poll.
  const msg = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(roomColumn(room), room.id)))
      .for('update');
    if (!row?.poll || row.deletedAt) throw notFound('Poll');
    const picked = [...new Set(optionIds)];
    const known = new Set(row.poll.options.map((o) => o.id));
    if (picked.some((id) => !known.has(id))) throw badRequest('That isn’t one of the options');
    if (!row.poll.multiple && picked.length > 1) throw badRequest('Pick one option');

    await tx
      .delete(pollVotes)
      .where(and(eq(pollVotes.messageId, messageId), eq(pollVotes.userId, userId)));
    if (picked.length) {
      await tx
        .insert(pollVotes)
        .values(picked.map((optionId) => ({ messageId, userId, optionId })));
    }
    return row;
  });
  return toChatMessage(db, urls, msg);
}

/** Your own message in this chat, or not found. */
async function requireOwnMessage(db: Db, room: Room, userId: string, messageId: string) {
  const [msg] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(roomColumn(room), room.id)));
  if (!msg || msg.kind !== 'user' || msg.deletedAt) throw notFound('Message');
  if (msg.senderId !== userId) throw forbidden('You can only change your own messages');
  return msg;
}

/**
 * Changes a message's text, within LIMITS.messageEditMinutes of sending.
 * Photos keep their photo (the text is the caption); polls can't be edited.
 */
export async function editMessage(
  db: Db,
  urls: Urls,
  room: Room,
  userId: string,
  messageId: string,
  input: { body: string; mentions: string[] },
) {
  const msg = await requireOwnMessage(db, room, userId, messageId);
  if (msg.poll) throw badRequest('Polls can’t be edited');
  if (Date.now() - msg.createdAt.getTime() > LIMITS.messageEditMinutes * 60_000) {
    throw badRequest(`Messages can only be edited for ${LIMITS.messageEditMinutes} minutes`);
  }
  const [row] = await db
    .update(messages)
    .set({
      body: input.body,
      mentions: await membersAmong(db, room, userId, input.mentions),
      editedAt: sql`now()`,
    })
    .where(eq(messages.id, messageId))
    .returning();
  return toChatMessage(db, urls, row!);
}

/**
 * Deletes your message: it stays in the chat as "This message was deleted".
 * Its text, photo and poll are cleared, unless someone reported it and a
 * moderator hasn't looked yet (then they're kept, hidden, for the review).
 * Returns the message as it now shows, and the photo to remove from storage.
 */
export async function deleteMessage(
  db: Db,
  urls: Urls,
  room: Room,
  userId: string,
  messageId: string,
) {
  const msg = await requireOwnMessage(db, room, userId, messageId);
  const [report] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.messageId, messageId), eq(reports.status, 'open')))
    .limit(1);
  const keep = !!report;
  const [row] = await db
    .update(messages)
    .set({
      deletedAt: sql`now()`,
      ...(keep ? {} : { body: '', imageKey: null, mentions: [], poll: null }),
    })
    .where(eq(messages.id, messageId))
    .returning();
  await db.delete(messageReactions).where(eq(messageReactions.messageId, messageId));
  if (!keep) await db.delete(pollVotes).where(eq(pollVotes.messageId, messageId));
  return {
    message: await toChatMessage(db, urls, row!),
    removedPhoto: keep ? null : msg.imageKey,
  };
}

/** Sets (or with null, removes) your reaction to a message; returns its reactions now. */
export async function react(
  db: Db,
  room: Room,
  userId: string,
  messageId: string,
  emoji: Reaction | null,
) {
  const [msg] = await db
    .select({ id: messages.id, kind: messages.kind, deletedAt: messages.deletedAt })
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(roomColumn(room), room.id)));
  if (!msg || msg.kind !== 'user' || msg.deletedAt) throw notFound('Message');
  if (emoji) {
    await db
      .insert(messageReactions)
      .values({ messageId, userId, emoji })
      .onConflictDoUpdate({
        target: [messageReactions.messageId, messageReactions.userId],
        set: { emoji, createdAt: sql`now()` },
      });
  } else {
    await db
      .delete(messageReactions)
      .where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, userId)));
  }
  return groupReactions(
    await db
      .select({ userId: messageReactions.userId, emoji: messageReactions.emoji })
      .from(messageReactions)
      .where(eq(messageReactions.messageId, messageId))
      .orderBy(asc(messageReactions.createdAt)),
  );
}

/** Moves the reader's position forward (never back) to the given message. */
export async function markRead(db: Db, room: Room, userId: string, messageId: string) {
  const [msg] = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(roomColumn(room), room.id)));
  if (!msg) throw notFound('Message');

  if (room.kind === 'community') {
    const [row] = await db
      .insert(communityChatReads)
      .values({ communityId: room.id, userId, lastReadAt: msg.createdAt })
      .onConflictDoUpdate({
        target: [communityChatReads.communityId, communityChatReads.userId],
        set: {
          lastReadAt: sql`greatest(${communityChatReads.lastReadAt}, excluded.last_read_at)`,
        },
      })
      .returning({ lastReadAt: communityChatReads.lastReadAt });
    return row!.lastReadAt.toISOString();
  }
  const [row] = await db
    .insert(chatReads)
    .values({ activityId: room.id, userId, lastReadAt: msg.createdAt })
    .onConflictDoUpdate({
      target: [chatReads.activityId, chatReads.userId],
      set: { lastReadAt: sql`greatest(${chatReads.lastReadAt}, excluded.last_read_at)` },
    })
    .returning({ lastReadAt: chatReads.lastReadAt });
  return row!.lastReadAt.toISOString();
}

/** A community's chat photos (R2 keys), to delete along with the community. */
export async function communityChatPhotos(db: Db | Tx, communityId: string) {
  const rows = await db
    .select({ key: messages.imageKey })
    .from(messages)
    .where(and(eq(messages.communityId, communityId), sql`${messages.imageKey} is not null`));
  return rows.map((r) => r.key!);
}
