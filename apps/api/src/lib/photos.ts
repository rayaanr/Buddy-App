import { eq, or } from 'drizzle-orm';

import type { Db } from '../db/client';
import { activities, communities, profiles } from '../db/schema';
import type { Logger } from '../logger';
import type { Storage } from './storage';
import { keyFromUrl } from './upload-keys';

interface PhotoDeps {
  db: Db;
  storage: Storage | null;
  logger: Logger;
  publicUrl: string | undefined;
}

/**
 * Deletes uploaded photos nothing points to any more: a replaced cover, logo
 * or profile photo, or those of a deleted community. Takes public URLs or
 * storage keys; stock and seed photos (not ours) are skipped. A photo still in
 * use elsewhere stays: weekly activities share one cover between occurrences.
 * Runs after the change is saved, and never throws.
 */
export async function forgetPhotos(
  { db, storage, logger, publicUrl }: PhotoDeps,
  refs: (string | null | undefined)[],
) {
  if (!storage) return;
  const keys = [
    ...new Set(
      refs
        .map((r) =>
          r && /^(avatars|covers|logos)\//.test(r) ? r : keyFromUrl(r ?? null, publicUrl),
        )
        .filter((k): k is string => !!k),
    ),
  ];
  try {
    const unused: string[] = [];
    for (const key of keys) {
      const url = publicUrl ? `${publicUrl}/${key}` : null;
      const users = await Promise.all([
        url
          ? db
              .select({ id: activities.id })
              .from(activities)
              .where(eq(activities.coverUrl, url))
              .limit(1)
          : [],
        url
          ? db
              .select({ id: communities.id })
              .from(communities)
              .where(or(eq(communities.coverUrl, url), eq(communities.logoUrl, url)))
              .limit(1)
          : [],
        db
          .select({ id: profiles.userId })
          .from(profiles)
          .where(eq(profiles.avatarKey, key))
          .limit(1),
      ]);
      if (users.every((rows) => rows.length === 0)) unused.push(key);
    }
    if (unused.length) await storage.remove(unused);
  } catch (err) {
    logger.error({ err, keys }, 'Could not clean up old photos');
  }
}
