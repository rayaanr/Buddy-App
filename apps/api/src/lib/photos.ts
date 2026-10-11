import { eq, or } from 'drizzle-orm';

import type { Db } from '../db/client';
import { activities, communities, profiles } from '../db/schema';
import type { Logger } from '../logger';
import type { Storage } from './storage';
import { isUploadKey } from './upload-keys';

interface PhotoDeps {
  db: Db;
  storage: Storage | null;
  logger: Logger;
}

/**
 * Deletes uploaded photos nothing points to any more: a replaced cover, logo
 * or profile photo, those of a deleted community, or a removed chat photo.
 * Takes stored references; anything that isn't an upload of ours (Buddy's
 * pictures, someone else's URL) is skipped. A photo still in
 * use elsewhere stays: weekly activities share one cover between occurrences.
 * Runs after the change is saved, and never throws.
 */
export async function forgetPhotos(
  { db, storage, logger }: PhotoDeps,
  refs: (string | null | undefined)[],
) {
  if (!storage) return;
  const keys = [...new Set(refs.filter(isUploadKey))];
  try {
    const unused: string[] = [];
    for (const key of keys) {
      const users = await Promise.all([
        db
          .select({ id: activities.id })
          .from(activities)
          .where(eq(activities.coverUrl, key))
          .limit(1),
        db
          .select({ id: communities.id })
          .from(communities)
          .where(or(eq(communities.coverUrl, key), eq(communities.logoUrl, key)))
          .limit(1),
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
