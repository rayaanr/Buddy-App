import {
  DELETED_ACCOUNT,
  type ChatMessage,
  type MessagesPage,
  type SendMessageInput,
} from '@buddy/shared';
import { and, asc, desc, eq, gt, inArray, isNull, ne, or, sql } from 'drizzle-orm';

import type { Db, Tx } from '../../db/client';
import {
  activities,
  activityMembers,
  chatReads,
  communities,
  communityChatReads,
  communityMembers,
  messages,
  pollVotes,
  profiles,
  user,
} from '../../db/schema';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import type { Storage } from '../../lib/storage';
import { requireUpload } from '../../lib/upload-keys';
import type { Urls } from '../../lib/urls';
import { notBlockedBetween } from '../safety/blocks';

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
async function toChatMessages(db: Db, urls: Urls, rows: MessageRow[]): Promise<ChatMessage[]> {
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
    const imageUrl = r.imageKey ? urls.fromKey(r.imageKey) : null;
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
      body: r.body,
      image: imageUrl
        ? { url: imageUrl, width: r.imageWidth ?? 1, height: r.imageHeight ?? 1 }
        : null,
      // The size stays when the photo is deleted for age.
      photoExpired: !r.imageKey && r.imageWidth !== null,
      mentions: r.mentions.flatMap((id) => {
        const person = byId.get(id);
        return person ? [{ id, name: person.name }] : [];
      }),
      poll: r.poll
        ? {
            question: r.poll.question,
            multiple: r.poll.multiple,
            options: r.poll.options.map((o) => ({
              ...o,
              voterIds: votes
                .filter((v) => v.messageId === r.id && v.optionId === o.id)
                .map((v) => v.userId),
            })),
          }
        : null,
      createdAt: r.createdAt.toISOString(),
    };
  });
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
  { after, limit }: { after?: string; limit: number },
): Promise<MessagesPage> {
  const inRoom = eq(roomColumn(room), room.id);
  const visible = or(isNull(messages.senderId), notBlockedBetween(viewerId, messages.senderId));
  let rows: MessageRow[];
  if (after) {
    const [cursor] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.id, after), inRoom));
    if (!cursor) throw notFound('Message');
    rows = await db
      .select()
      .from(messages)
      .where(
        and(
          inRoom,
          visible,
          or(
            gt(messages.createdAt, cursor.createdAt),
            and(eq(messages.createdAt, cursor.createdAt), gt(messages.id, after)),
          ),
        ),
      )
      .orderBy(asc(messages.createdAt), asc(messages.id))
      .limit(limit);
  } else {
    rows = (
      await db
        .select()
        .from(messages)
        .where(and(inRoom, visible))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(limit)
    ).reverse();
  }
  return {
    messages: await toChatMessages(db, urls, rows),
    othersReadUpTo: await othersReadUpTo(db, room, viewerId),
  };
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
  const [msg] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(roomColumn(room), room.id)));
  if (!msg?.poll) throw notFound('Poll');
  const picked = [...new Set(optionIds)];
  const known = new Set(msg.poll.options.map((o) => o.id));
  if (picked.some((id) => !known.has(id))) throw badRequest('That isn’t one of the options');
  if (!msg.poll.multiple && picked.length > 1) throw badRequest('Pick one option');

  await db.transaction(async (tx) => {
    await tx
      .delete(pollVotes)
      .where(and(eq(pollVotes.messageId, messageId), eq(pollVotes.userId, userId)));
    if (picked.length) {
      await tx
        .insert(pollVotes)
        .values(picked.map((optionId) => ({ messageId, userId, optionId })));
    }
  });
  return toChatMessage(db, urls, msg);
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
