import { z } from 'zod';

import { AVAILABILITY, INTERESTS, LIMITS } from '../constants';
import { activitySummary } from './activity';
import { place } from './place';
import { isoDateTime } from './common';

export const interest = z.enum(INTERESTS);
export const availability = z.enum(AVAILABILITY);

/** The signed-in user's own profile. */
export const me = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  /** Home town as shown, e.g. "Peradeniya, Kandy". */
  area: z.string(),
  place,
  bio: z.string(),
  interests: z.array(interest),
  availability: z.array(availability),
  avatarUrl: z.url().nullable(),
  /** False until first-run setup is finished or skipped; the app shows it until then. */
  onboarded: z.boolean(),
  /** Push notification switches. */
  notifications: z.object({ chat: z.boolean(), reminders: z.boolean() }),
  stats: z.object({
    joined: z.number().int(),
    hosted: z.number().int(),
    communities: z.number().int(),
  }),
  createdAt: isoDateTime,
});
export type Me = z.infer<typeof me>;

const uniqueList = <T extends z.ZodType>(item: T) =>
  z.array(item).refine((list) => new Set(list).size === list.length, 'Duplicate values');

export const updateMeInput = z
  .object({
    name: z.string().trim().min(1).max(LIMITS.nameMax),
    /** Home town (a place id from /v1/places). */
    placeId: z.number().int().positive(),
    bio: z.string().trim().max(LIMITS.bioMax),
    interests: uniqueList(interest),
    availability: uniqueList(availability),
    /** Key returned by the upload endpoint; null removes the photo. */
    avatarKey: z.string().nullable(),
    notifications: z.object({ chat: z.boolean(), reminders: z.boolean() }).partial(),
    /** Finishes first-run setup (every step can be skipped). */
    onboarded: z.literal(true),
  })
  .partial();
export type UpdateMeInput = z.infer<typeof updateMeInput>;

/** Someone else's profile, from the viewer's point of view. */
export const publicProfile = z.object({
  id: z.string(),
  name: z.string(),
  area: z.string(),
  bio: z.string(),
  avatarUrl: z.url().nullable(),
  interests: z.array(interest),
  /** Interests the viewer shares, for "2 IN COMMON". */
  commonInterests: z.array(interest),
  memberSince: isoDateTime,
  hostedCount: z.number().int(),
  joinedCount: z.number().int(),
  hosting: z.array(activitySummary),
  /** You blocked this person: their activities and messages are hidden from you. */
  blockedByYou: z.boolean(),
});
export type PublicProfile = z.infer<typeof publicProfile>;
