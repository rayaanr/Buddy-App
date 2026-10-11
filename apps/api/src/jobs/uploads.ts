import { inArray, or } from 'drizzle-orm';

import type { Db } from '../db/client';
import { activities, communities, messages, profiles } from '../db/schema';
import type { Storage } from '../lib/storage';
import type { Logger } from '../logger';

const DAY_MS = 24 * 60 * 60 * 1000;
/** An upload nothing uses after this long was abandoned (picked, then never saved). */
const KEEP_DAYS = 7;
const PREFIXES = ['avatars/', 'covers/', 'logos/', 'chat/'];
/** Keys checked against the database at a time. */
const BATCH = 500;

/** Which of these keys a profile, activity, community or chat message still uses. */
async function inUse(db: Db, keys: string[]) {
  const [people, events, groups, chat] = await Promise.all([
    db.select({ key: profiles.avatarKey }).from(profiles).where(inArray(profiles.avatarKey, keys)),
    db
      .select({ key: activities.coverUrl })
      .from(activities)
      .where(inArray(activities.coverUrl, keys)),
    db
      .select({ cover: communities.coverUrl, logo: communities.logoUrl })
      .from(communities)
      .where(or(inArray(communities.coverUrl, keys), inArray(communities.logoUrl, keys))),
    db.select({ key: messages.imageKey }).from(messages).where(inArray(messages.imageKey, keys)),
  ]);
  return new Set(
    [
      ...people.map((r) => r.key),
      ...events.map((r) => r.key),
      ...groups.flatMap((r) => [r.cover, r.logo]),
      ...chat.map((r) => r.key),
    ].filter((k): k is string => !!k),
  );
}

/**
 * Deletes uploads nothing points to that are over a week old: photos picked
 * in a form that was then cancelled, or replaced before saving. (Photos
 * replaced or deleted after saving are removed straight away; see
 * lib/photos.ts.) Returns how many it deleted.
 */
export async function sweepUploads({ db, storage }: { db: Db; storage: Storage | null }) {
  if (!storage) return 0;
  const cutoff = Date.now() - KEEP_DAYS * DAY_MS;
  let deleted = 0;
  const check = async (keys: string[]) => {
    const used = await inUse(db, keys);
    const unused = keys.filter((k) => !used.has(k));
    if (unused.length) await storage.remove(unused);
    deleted += unused.length;
  };
  for (const prefix of PREFIXES) {
    let batch: string[] = [];
    for await (const { key, uploadedAt } of storage.list(prefix)) {
      if (uploadedAt.getTime() > cutoff) continue;
      batch.push(key);
      if (batch.length >= BATCH) {
        await check(batch);
        batch = [];
      }
    }
    if (batch.length) await check(batch);
  }
  return deleted;
}

/** Runs the sweep once a day, starting an hour after the server does. */
export function startUploadSweep(deps: { db: Db; storage: Storage | null; logger: Logger }) {
  const tick = () =>
    sweepUploads(deps)
      .then((n) => n && deps.logger.info({ deleted: n }, 'Unused uploads cleaned up'))
      .catch((err: unknown) => deps.logger.error({ err }, 'Upload clean-up failed'));
  const first = setTimeout(tick, 60 * 60 * 1000);
  const daily = setInterval(tick, DAY_MS);
  first.unref();
  daily.unref();
  return () => {
    clearTimeout(first);
    clearInterval(daily);
  };
}
