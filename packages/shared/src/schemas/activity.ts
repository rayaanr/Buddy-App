import { z } from 'zod';

import { ACTIVITY_GROUPS, AREA_NAMES, DISCOVER_FILTERS, INTERESTS, LIMITS } from '../constants';
import { isoDateTime, location, userSummary } from './common';

export const activityGroup = z.enum(ACTIVITY_GROUPS);
export const discoverFilter = z.enum(DISCOVER_FILTERS);

/** An activity as it appears in lists and cards. */
export const activitySummary = z.object({
  id: z.uuid(),
  title: z.string(),
  /** Uppercase label above the title, e.g. "RUNNING". */
  category: z.string(),
  group: activityGroup,
  /** The interest this activity matches; drives "Because you're into …". */
  interest: z.enum(INTERESTS).nullable(),
  startsAt: isoDateTime,
  place: z.string(),
  area: z.string(),
  location,
  /** Distance from the viewer's position, when the request supplied one. */
  distanceKm: z.number().nullable(),
  capacity: z.number().int(),
  goingCount: z.number().int(),
  coverUrl: z.url().nullable(),
  host: userSummary,
  community: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  viewer: z.object({ joined: z.boolean(), hosting: z.boolean() }),
});
export type ActivitySummary = z.infer<typeof activitySummary>;

export const activityDetail = activitySummary.extend({
  description: z.string(),
  /** Up to five people going, host first. */
  attendees: z.array(userSummary),
  host: userSummary.extend({ hostedCount: z.number().int() }),
});
export type ActivityDetail = z.infer<typeof activityDetail>;

/** Everyone going, host first (people you've blocked, or who blocked you, left out). */
export const activityMember = userSummary.extend({ role: z.enum(['host', 'guest']) });
export type ActivityMember = z.infer<typeof activityMember>;
export const activityMembers = z.object({ members: z.array(activityMember) });

/** Query for the Discover feed. Query-string values arrive as strings, hence coerce. */
export const feedQuery = z.object({
  filter: discoverFilter.default('All'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(100).default(25),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type FeedQuery = z.infer<typeof feedQuery>;

export const createActivityInput = z.object({
  title: z.string().trim().min(LIMITS.titleMin).max(LIMITS.titleMax),
  group: activityGroup,
  interest: z.enum(INTERESTS).optional(),
  startsAt: isoDateTime,
  place: z.string().trim().min(2).max(LIMITS.placeMax),
  area: z.enum(AREA_NAMES),
  /** Exact spot; defaults to the area's centre until the app has a map picker. */
  location: location.optional(),
  capacity: z.number().int().min(LIMITS.capacityMin).max(LIMITS.capacityMax),
  description: z.string().trim().max(LIMITS.descriptionMax).default(''),
  /** Key returned by the upload endpoint, if a cover photo was uploaded. */
  coverKey: z.string().optional(),
});
export type CreateActivityInput = z.input<typeof createActivityInput>;

/** An activity on "Your activities", with the latest chat line for the preview strip. */
export const myActivity = activitySummary.extend({
  lastMessage: z
    .object({
      kind: z.enum(['user', 'system']),
      senderName: z.string().nullable(),
      body: z.string(),
      mine: z.boolean(),
    })
    .nullable(),
});
export type MyActivity = z.infer<typeof myActivity>;

export const myActivitiesQuery = z.object({
  role: z.enum(['joined', 'hosting']).default('joined'),
});

/** A card in the "Picked for you" deck, with the reason it was picked. */
export const pick = z.object({
  activity: activitySummary,
  reason: z.string(),
});
export type Pick = z.infer<typeof pick>;
