import { RETENTION } from '@buddy/shared';
import { sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import type { Storage } from '../lib/storage';
import type { Logger } from '../logger';

const EVERY_MS = 60 * 60 * 1000;
/** Rows per rule per run, so one run never holds long locks; the next run continues. */
const BATCH = 5000;

/** Messages a moderator still has to look at are never deleted. */
const notReported = sql`not exists (
  select 1 from reports r where r.message_id = m.id and r.status = 'open'
)`;

/**
 * Keeps chat storage from growing forever:
 * - an activity's chat is deleted RETENTION.activityChatDays after the activity;
 * - community chats keep RETENTION.communityChatDays of messages, or the last
 *   RETENTION.communityChatKeep, whichever is more;
 * - chat photos are deleted after RETENTION.chatPhotoDays (the message stays,
 *   and the app shows that the photo has expired).
 * Poll votes go with their messages. Photo files are removed from storage
 * after the rows are gone, so a failure there only leaves a stray file.
 */
export async function pruneChats({
  db,
  storage,
}: {
  db: Db;
  storage: Storage | null;
}): Promise<{ activityMessages: number; communityMessages: number; photos: number }> {
  const activityGone = await db.execute<{ image_key: string | null }>(sql`
    delete from messages where id in (
      select m.id from messages m
      join activities a on a.id = m.activity_id
      where a.starts_at < now() - make_interval(days => ${RETENTION.activityChatDays})
        and ${notReported}
      limit ${BATCH}
    )
    returning image_key`);
  // Nothing left to have read.
  await db.execute(sql`
    delete from chat_reads r using activities a
    where a.id = r.activity_id
      and a.starts_at < now() - make_interval(days => ${RETENTION.activityChatDays})`);

  const communityGone = await db.execute<{ image_key: string | null }>(sql`
    delete from messages where id in (
      select id from (
        select m.id, m.created_at,
               row_number() over (
                 partition by m.community_id order by m.created_at desc, m.id desc
               ) as newest
        from messages m
        where m.community_id is not null and ${notReported}
      ) ranked
      where ranked.newest > ${RETENTION.communityChatKeep}
        and ranked.created_at < now() - make_interval(days => ${RETENTION.communityChatDays})
      limit ${BATCH}
    )
    returning image_key`);

  // UPDATE … RETURNING gives the new (null) key, so read the old one first.
  const expired = await db.execute<{ image_key: string }>(sql`
    with old as (
      select m.id, m.image_key from messages m
      where m.image_key is not null
        and m.created_at < now() - make_interval(days => ${RETENTION.chatPhotoDays})
        and ${notReported}
      limit ${BATCH}
      for update skip locked
    )
    update messages set image_key = null
    from old where messages.id = old.id
    returning old.image_key`);

  const keys = [...activityGone, ...communityGone, ...expired]
    .map((r) => r.image_key)
    .filter((k): k is string => !!k);
  if (keys.length && storage) await storage.remove(keys);

  return {
    activityMessages: activityGone.length,
    communityMessages: communityGone.length,
    photos: keys.length,
  };
}

/** Runs pruneChats every hour until stopped. */
export function startRetention(deps: { db: Db; storage: Storage | null; logger: Logger }) {
  const tick = () =>
    pruneChats(deps)
      .then((done) => {
        if (done.activityMessages || done.communityMessages || done.photos)
          deps.logger.info(done, 'Old chats cleaned up');
      })
      .catch((err) => deps.logger.error({ err }, 'Chat clean-up failed'));
  const timer = setInterval(tick, EVERY_MS);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
