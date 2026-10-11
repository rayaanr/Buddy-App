import type { ActivityGroup } from '@buddy/shared';
import { and, eq, isNull, or, sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import { activities, communities, profiles } from '../db/schema';
import type { Urls } from '../lib/urls';

/**
 * The stock photos activities used to get by default, before Buddy had its
 * own pictures; they're swapped for ours.
 */
const OLD_STOCK = [
  '1543269865-cbf427effbad',
  '1574629810360-7efbbe195018',
  '1552674605-db6ffd4facb5',
  '1460661419201-fd4cecdf8a8b',
  '1488459716781-31db52582fe9',
].map((id) => `https://images.unsplash.com/photo-${id}?w=800&q=70&auto=format&fit=crop`);

/**
 * Gives everything still without a picture one of ours (rows from before
 * Buddy had them, or added straight to the database, like the sample data).
 * Safe to run any time: it only fills gaps. Returns how many it filled.
 */
export async function fillMissingPictures(db: Db, urls: Urls) {
  let filled = 0;

  const people = await db
    .select({ userId: profiles.userId, gender: profiles.gender })
    .from(profiles)
    .where(and(isNull(profiles.avatarKey), isNull(profiles.avatarUrl)));
  for (const p of people) {
    await db
      .update(profiles)
      .set({ avatarUrl: urls.art.avatar(p.userId, p.gender) })
      .where(eq(profiles.userId, p.userId));
  }
  filled += people.length;

  const bare = await db
    .select({
      id: activities.id,
      group: activities.group,
      title: activities.title,
      description: activities.description,
    })
    .from(activities)
    .where(
      or(
        isNull(activities.coverUrl),
        sql`${activities.coverUrl} in (${sql.join(
          OLD_STOCK.map((u) => sql`${u}`),
          sql`, `,
        )})`,
      ),
    );
  for (const a of bare) {
    await db
      .update(activities)
      .set({ coverUrl: urls.art.activityCover({ ...a, group: a.group as ActivityGroup }) })
      .where(eq(activities.id, a.id));
  }
  filled += bare.length;

  const groups = await db
    .select({
      id: communities.id,
      name: communities.name,
      about: communities.about,
      coverUrl: communities.coverUrl,
      logoUrl: communities.logoUrl,
    })
    .from(communities)
    .where(or(isNull(communities.coverUrl), isNull(communities.logoUrl)));
  for (const c of groups) {
    await db
      .update(communities)
      .set({
        coverUrl: c.coverUrl ?? urls.art.communityCover(c),
        logoUrl: c.logoUrl ?? urls.art.communityLogo(c),
      })
      .where(eq(communities.id, c.id));
  }
  return filled + groups.length;
}
