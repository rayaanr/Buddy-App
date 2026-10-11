import { type ChatPreview, messageSummary } from '@buddy/shared';
import { sql } from 'drizzle-orm';

import type { Db } from '../../db/client';
import type { Urls } from '../../lib/urls';
import { notBlockedBetween } from '../safety/blocks';

/** Activity chats stay on the list this long after the activity starts. */
const ACTIVITY_CHAT_DAYS = 14;

interface Row extends Record<string, unknown> {
  kind: 'activity' | 'community';
  id: string;
  title: string;
  image_url: string | null;
  starts_at: Date | null;
  cancelled: boolean;
  muted: boolean;
  joined_at: Date;
  lm_kind: 'user' | 'system' | null;
  lm_body: string | null;
  lm_image: string | null;
  lm_question: string | null;
  lm_deleted: boolean | null;
  lm_sender: string | null;
  lm_name: string | null;
  lm_at: Date | null;
  unread: number;
}

/**
 * Every group chat you're in: activities you're going to (until two weeks
 * after they start) and your communities. Each has its latest line and how
 * many messages from others arrived since you last read it; people on either
 * side of a block with you don't count.
 */
export async function listChats(db: Db, urls: Urls, viewerId: string): Promise<ChatPreview[]> {
  const visible = (sender: string) =>
    sql`(${sql.raw(sender)} is null or ${notBlockedBetween(viewerId, sql.raw(sender))})`;
  const fromOthers = sql`x.kind = 'user' and x.sender_id <> ${viewerId} and ${notBlockedBetween(viewerId, sql`x.sender_id`)}`;

  // Read positions are stored to the millisecond; message times have more digits.
  const readAfter = (reads: string, member: string) =>
    sql.raw(
      `date_trunc('milliseconds', x.created_at) > coalesce(${reads}.last_read_at, ${member}.joined_at)`,
    );

  const rows = await db.execute<Row>(sql`
    select 'activity' as kind, a.id, a.title, a.cover_url as image_url, a.starts_at,
           a.cancelled_at is not null as cancelled, m.chat_muted as muted, m.joined_at,
           lm.kind as lm_kind, lm.body as lm_body, lm.image_key as lm_image,
           lm.poll->>'question' as lm_question, lm.deleted_at is not null as lm_deleted,
           lm.sender_id as lm_sender,
           su.name as lm_name, lm.created_at as lm_at,
           (select count(*)::int from messages x
             where x.activity_id = a.id and ${fromOthers}
               and ${readAfter('r', 'm')}) as unread
    from activity_members m
    join activities a on a.id = m.activity_id
    left join chat_reads r on r.activity_id = a.id and r.user_id = ${viewerId}
    left join lateral (
      select * from messages x
      where x.activity_id = a.id and ${visible('x.sender_id')}
      order by x.created_at desc, x.id desc limit 1
    ) lm on true
    left join "user" su on su.id = lm.sender_id
    where m.user_id = ${viewerId}
      and a.starts_at > now() - make_interval(days => ${ACTIVITY_CHAT_DAYS})

    union all

    select 'community', c.id, c.name, c.logo_url, null, false, m.chat_muted, m.joined_at,
           lm.kind, lm.body, lm.image_key, lm.poll->>'question', lm.deleted_at is not null,
           lm.sender_id, su.name,
           lm.created_at,
           (select count(*)::int from messages x
             where x.community_id = c.id and ${fromOthers}
               and ${readAfter('r', 'm')})
    from community_members m
    join communities c on c.id = m.community_id
    left join community_chat_reads r on r.community_id = c.id and r.user_id = ${viewerId}
    left join lateral (
      select * from messages x
      where x.community_id = c.id and ${visible('x.sender_id')}
      order by x.created_at desc, x.id desc limit 1
    ) lm on true
    left join "user" su on su.id = lm.sender_id
    where m.user_id = ${viewerId}`);

  const iso = (d: Date | string) => new Date(d).toISOString();
  return (
    rows
      .map((r) => ({
        kind: r.kind,
        id: r.id,
        title: r.title,
        // A photo of its own, or else a group picture (not the activity's or
        // community's own fallback, which is drawn for a cover, not a chat).
        imageUrl: urls.image(
          r.image_url && !urls.art.isFallback(r.image_url) ? r.image_url : urls.art.groupChat(r.id),
        ),
        startsAt: r.starts_at ? iso(r.starts_at) : null,
        cancelled: r.cancelled,
        muted: r.muted,
        lastMessage:
          r.lm_kind && r.lm_body !== null && r.lm_at
            ? {
                kind: r.lm_kind,
                senderName: r.lm_name,
                body: messageSummary({
                  body: r.lm_body,
                  hasImage: !!r.lm_image,
                  pollQuestion: r.lm_question,
                }),
                mine: r.lm_sender === viewerId,
                createdAt: iso(r.lm_at),
              }
            : null,
        unread: r.unread,
        activeAt: iso(r.lm_at ?? r.joined_at),
      }))
      // Chats with messages, newest first; then quiet ones, newest joined first.
      .sort(
        (a, b) =>
          Number(!!b.lastMessage) - Number(!!a.lastMessage) || b.activeAt.localeCompare(a.activeAt),
      )
      .map(({ activeAt: _activeAt, ...chat }) => chat)
  );
}
