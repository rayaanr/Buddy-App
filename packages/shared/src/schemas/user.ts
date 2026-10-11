import { z } from 'zod';

import {
  AVAILABILITY,
  EARLIEST_BIRTH_YEAR,
  GENDERS,
  INTERESTS,
  latestBirthYear,
  LIMITS,
  MIN_AGE,
} from '../constants';
import { activitySummary } from './activity';
import { place } from './place';
import { isoDateTime, userSummary } from './common';

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
  /** Private: kinds of activity left out of "Picked for you" ("Not into this"). */
  hiddenInterests: z.array(interest),
  avatarUrl: z.url().nullable(),
  /** False until first-run setup is finished or skipped; the app shows it until then. */
  onboarded: z.boolean(),
  /** Private: only you see these. Null until given. */
  gender: z.enum(GENDERS).nullable(),
  birthYear: z.number().int().nullable(),
  /** Can review reports (Settings → Moderation). */
  isAdmin: z.boolean(),
  /** Push notification switches. */
  notifications: z.object({
    chat: z.boolean(),
    reminders: z.boolean(),
    /** New activities in your communities. */
    communities: z.boolean(),
  }),
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
    hiddenInterests: uniqueList(interest),
    /** Key returned by the upload endpoint; null removes the photo. */
    avatarKey: z.string().nullable(),
    gender: z.enum(GENDERS),
    /** You must be 18 or over this year. */
    birthYear: z
      .number()
      .int()
      .min(EARLIEST_BIRTH_YEAR, 'Check your birth year')
      .refine((y) => y <= latestBirthYear(), `You need to be ${MIN_AGE} or over to use Buddy`),
    notifications: z
      .object({ chat: z.boolean(), reminders: z.boolean(), communities: z.boolean() })
      .partial(),
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
  /** Guests who said they'd go again with them. */
  wouldGoAgain: z.number().int(),
  joinedCount: z.number().int(),
  hosting: z.array(activitySummary),
  /** You blocked this person: their activities and messages are hidden from you. */
  blockedByYou: z.boolean(),
});
export type PublicProfile = z.infer<typeof publicProfile>;

/** One entry in the in-app notifications list (the bell). */
export const appNotification = z.object({
  id: z.uuid(),
  /** reminders (activities you're in) or communities (new activities in yours). */
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  /** Where tapping it goes: activityId, optionally screen: 'chat'. */
  data: z.record(z.string(), z.string()),
  read: z.boolean(),
  createdAt: isoDateTime,
});
export type AppNotification = z.infer<typeof appNotification>;

export const notificationsQuery = z.object({
  /** Older than this (the last one shown), for the next page. */
  before: isoDateTime.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

/**
 * People search: someone you share a community or an activity with, by name
 * (strangers aren't findable). `area` is their home town as shown.
 */
export const peopleQuery = z.object({ q: z.string().trim().min(2).max(60) });
export const personResult = userSummary.extend({ area: z.string() });
export type PersonResult = z.infer<typeof personResult>;
