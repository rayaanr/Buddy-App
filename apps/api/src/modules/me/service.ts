import {
  MIN_INTERESTS,
  placeLabel,
  type Availability,
  type Interest,
  type Me,
  type UpdateMeInput,
} from '@buddy/shared';
import { and, eq, sql } from 'drizzle-orm';

import type { Db } from '../../db/client';
import { activities, activityMembers, communityMembers, profiles, user } from '../../db/schema';
import { forbidden, notFound } from '../../lib/errors';
import type { Urls } from '../../lib/urls';
import { homePlace, requirePlace } from '../profiles/service';

const count = sql<number>`count(*)::int`;

export async function getMe(db: Db, urls: Urls, userId: string): Promise<Me> {
  const [row] = await db
    .select({ user, profile: profiles })
    .from(user)
    .innerJoin(profiles, eq(profiles.userId, user.id))
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
  const place = await homePlace(db, userId);
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

/** Avatar keys are issued per user by the upload endpoint; reject anyone else's. */
export const avatarKeyPrefix = (userId: string) => `avatars/${userId}/`;

export async function updateMe(db: Db, userId: string, input: UpdateMeInput) {
  if (input.avatarKey && !input.avatarKey.startsWith(avatarKeyPrefix(userId))) {
    throw forbidden('That image was not uploaded by you');
  }
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
 * Deletes the account and everything that belongs to it (sessions, profile,
 * memberships, hosted activities, messages) via ON DELETE CASCADE.
 * Required by Apple and Google for apps with sign-up.
 */
export async function deleteAccount(db: Db, userId: string) {
  await db.delete(user).where(eq(user.id, userId));
}
