import { z } from 'zod';

import { AREA_NAMES, AVAILABILITY, INTERESTS, LIMITS, MIN_INTERESTS } from '../constants';
import { activitySummary } from './activity';
import { isoDateTime } from './common';

export const interest = z.enum(INTERESTS);
export const availability = z.enum(AVAILABILITY);

/** The signed-in user's own profile. */
export const me = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  area: z.enum(AREA_NAMES),
  bio: z.string(),
  interests: z.array(interest),
  availability: z.array(availability),
  avatarUrl: z.url().nullable(),
  /** False until interests are picked; the app routes to onboarding until then. */
  onboarded: z.boolean(),
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
    area: z.enum(AREA_NAMES),
    bio: z.string().trim().max(LIMITS.bioMax),
    interests: uniqueList(interest).min(MIN_INTERESTS),
    availability: uniqueList(availability),
    /** Key returned by the upload endpoint; null removes the photo. */
    avatarKey: z.string().nullable(),
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
});
export type PublicProfile = z.infer<typeof publicProfile>;
