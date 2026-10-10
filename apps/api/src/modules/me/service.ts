import {
  MIN_INTERESTS,
  type ActivityGroup,
  placeLabel,
  type Availability,
  type Interest,
  type Me,
  type UpdateMeInput,
} from '@buddy/shared';
import { and, eq, sql } from 'drizzle-orm';

import type { Db } from '../../db/client';
import {
  activities,
  activityMembers,
  communityMembers,
  profiles,
  user,
  places,
} from '../../db/schema';
import { notFound } from '../../lib/errors';
import type { Storage } from '../../lib/storage';
import { keyFromUrl, requireUpload } from '../../lib/upload-keys';
import type { ChangeResult } from '../activities/announce';
import { cancelLocked, stockCover } from '../activities/service';
import { firstName } from '../chat/system-messages';
import type { Urls } from '../../lib/urls';
import { requirePlace, toPlace } from '../profiles/service';

const count = sql<number>`count(*)::int`;

export async function getMe(db: Db, urls: Urls, userId: string): Promise<Me> {
  const [row] = await db
    .select({ user, profile: profiles, place: places })
    .from(user)
    .innerJoin(profiles, eq(profiles.userId, user.id))
    .innerJoin(places, eq(places.id, profiles.placeId))
    .where(eq(user.id, userId));
  if (!row) throw notFound('Profile');

  const [[joined], [hosted], [comms]] = await Promise.all([
    db
      .select({ n: count })
      .from(activityMembers)
      .where(and(eq(activityMembers.userId, userId), eq(activityMembers.role, 'guest'))),
    db.select({ n: count }).from(activities).where(eq(activities.hostId, userId)),
    db.select({ n: count }).from(communityMembers).where(eq(communityMembers.userId, userId)),
  ]);

  const { profile } = row;
  const place = toPlace(row.place);
  return {
    id: row.user.id,
    email: row.user.email,
    name: row.user.name,
    area: placeLabel(place),
    place,
    bio: profile.bio,
    interests: profile.interests as Interest[],
    availability: profile.availability as Availability[],
    avatarUrl: urls.avatar(profile.avatarKey, profile.avatarUrl),
    onboarded: profile.interests.length >= MIN_INTERESTS,
    notifications: { chat: profile.notifyChat, reminders: profile.notifyReminders },
    stats: { joined: joined?.n ?? 0, hosted: hosted?.n ?? 0, communities: comms?.n ?? 0 },
    createdAt: row.user.createdAt.toISOString(),
  };
}

export async function updateMe(
  db: Db,
  storage: Storage | null,
  userId: string,
  input: UpdateMeInput,
) {
  // Avatar keys are issued per user by the upload endpoint; reject anyone else's.
  if (input.avatarKey) await requireUpload(storage, input.avatarKey, 'avatar', userId);
  if (input.placeId !== undefined) await requirePlace(db, input.placeId);
  await db.transaction(async (tx) => {
    if (input.name !== undefined) {
      await tx.update(user).set({ name: input.name }).where(eq(user.id, userId));
    }
    const profilePatch = {
      ...(input.placeId !== undefined && { placeId: input.placeId }),
      ...(input.bio !== undefined && { bio: input.bio }),
      ...(input.interests !== undefined && { interests: input.interests }),
      ...(input.availability !== undefined && { availability: input.availability }),
      ...(input.avatarKey !== undefined && { avatarKey: input.avatarKey }),
      ...(input.notifications?.chat !== undefined && { notifyChat: input.notifications.chat }),
      ...(input.notifications?.reminders !== undefined && {
        notifyReminders: input.notifications.reminders,
      }),
    };
    if (Object.keys(profilePatch).length) {
      await tx.update(profiles).set(profilePatch).where(eq(profiles.userId, userId));
    }
  });
}

/**
 * Deletes the account (required by Apple and Google for apps with sign-up).
 * Sessions, profile, memberships and blocks go with it (ON DELETE CASCADE).
 * What other people still need stays, without them: upcoming activities they
 * host are cancelled with a chat line for their guests, past ones keep a
 * "Deleted account" host, their messages stay as "Deleted account", and
 * reports about them are kept for moderation. Their uploaded photos are
 * returned for the caller to delete from storage once this commits.
 */
export async function deleteAccount(
  db: Db,
  userId: string,
  { publicUrl }: { publicUrl: string | undefined },
) {
  return db.transaction(async (tx) => {
    const [me] = await tx
      .select({ name: user.name, avatarKey: profiles.avatarKey })
      .from(user)
      .leftJoin(profiles, eq(profiles.userId, user.id))
      .where(eq(user.id, userId));
    if (!me) throw notFound('Profile');
    const who = firstName(me.name);

    const hosted = await tx
      .select()
      .from(activities)
      .where(eq(activities.hostId, userId))
      .for('update');
    const cancelled: { id: string; result: ChangeResult }[] = [];
    const photoKeys = me.avatarKey ? [me.avatarKey] : [];
    for (const row of hosted) {
      if (!row.cancelledAt && row.startsAt.getTime() > Date.now()) {
        cancelled.push({
          id: row.id,
          result: await cancelLocked(tx, row, {
            stopRepeating: true,
            line: `${who} deleted their account, so this activity is off`,
            notice: { title: `Cancelled: ${row.title}`, body: `${who} is no longer on Buddy.` },
          }),
        });
      }
      // Their own photo leaves with them; the activity goes back to a stock one.
      const coverKey = keyFromUrl(row.coverUrl, publicUrl);
      if (coverKey) {
        photoKeys.push(coverKey);
        await tx
          .update(activities)
          .set({ coverUrl: stockCover(row.group as ActivityGroup) })
          .where(eq(activities.id, row.id));
      }
    }
    // Nobody is left to post next week's.
    await tx.update(activities).set({ repeatsWeekly: false }).where(eq(activities.hostId, userId));

    await tx.delete(user).where(eq(user.id, userId));
    return { cancelled, photoKeys };
  });
}
