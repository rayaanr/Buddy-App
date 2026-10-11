import { z } from 'zod';

import {
  ACTIVITY_GROUPS,
  DEFAULT_RADIUS_KM,
  DISCOVER_FILTERS,
  INTERESTS,
  LIMITS,
} from '../constants';
import { isoDateTime, location, userSummary } from './common';
import { meetingPoint } from './place';

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
  /** The town it's in, e.g. "Colombo 3" (nearest to its location). */
  area: z.string(),
  location,
  /** Distance from the viewer's position, when the request supplied one. */
  distanceKm: z.number().nullable(),
  capacity: z.number().int(),
  goingCount: z.number().int(),
  /** People waiting for a spot (the activity is full). */
  waitingCount: z.number().int(),
  coverUrl: z.url().nullable(),
  /** Per person in rupees: 0 is free, null when the host didn't say. */
  costLkr: z.number().int().nullable(),
  host: userSummary,
  community: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  viewer: z.object({
    joined: z.boolean(),
    hosting: z.boolean(),
    /** 1 if you're next in line; null if you're not on the waitlist. */
    waitlistPosition: z.number().int().nullable(),
    /** You muted this activity's group chat (no chat notifications). */
    chatMuted: z.boolean(),
  }),
  /** Called off by the host. Only people who were going still see it. */
  cancelled: z.boolean(),
  /** A new one is posted each week once this one starts. */
  repeatsWeekly: z.boolean(),
});
export type ActivitySummary = z.infer<typeof activitySummary>;

export const activityDetail = activitySummary.extend({
  description: z.string(),
  /** Up to five people going, host first. */
  attendees: z.array(userSummary),
  /** What to bring, e.g. "Water, a racket if you have one" (may be empty). */
  bring: z.string(),
  host: userSummary.extend({
    hostedCount: z.number().int(),
    /** Guests who said they'd go again with this host, across all their activities. */
    wouldGoAgain: z.number().int(),
  }),
  /** "Would you go again?": asked of guests once it's over (null: not asked). */
  feedback: z.object({ mine: z.boolean().nullable() }).nullable(),
  /** Who invited you to it, if someone did. */
  invitedBy: userSummary.nullable(),
  /**
   * Roll call, for the host once it has started: how many guests are marked
   * so far and how many came (null: not the host, or not time yet).
   */
  rollCall: z
    .object({ guests: z.number().int(), marked: z.number().int(), came: z.number().int() })
    .nullable(),
});
export type ActivityDetail = z.infer<typeof activityDetail>;

/** A guest on the host's roll call: came (true), didn't (false), or not marked yet (null). */
export const rollCallGuest = userSummary.extend({ attended: z.boolean().nullable() });
export type RollCallGuest = z.infer<typeof rollCallGuest>;

/** Marks some guests as there or not (others stay as they were). */
export const rollCallInput = z.object({
  marks: z
    .array(z.object({ userId: z.uuid(), attended: z.boolean() }))
    .min(1)
    .max(LIMITS.capacityMax),
});
export type RollCallInput = z.infer<typeof rollCallInput>;

/** Everyone going, host first (people you've blocked, or who blocked you, left out). */
export const activityMember = userSummary.extend({ role: z.enum(['host', 'guest']) });
export type ActivityMember = z.infer<typeof activityMember>;
export const activityMembers = z.object({
  members: z.array(activityMember),
  /** First in line first. */
  waitlist: z.array(userSummary),
});

/** Query for the Discover feed. Query-string values arrive as strings, hence coerce. */
/**
 * Query for the Discover feed. Distances are from (in order) lat/lng (where
 * you are now), placeId (a town you're browsing), or your home town.
 */
export const feedQuery = z.object({
  filter: discoverFilter.default('All'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  placeId: z.coerce.number().int().positive().optional(),
  radiusKm: z.coerce.number().positive().max(100).default(DEFAULT_RADIUS_KM),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** Search: titles, places, towns and interests anywhere in Sri Lanka, nearest first. */
  q: z.string().trim().min(2).max(60).optional(),
});
export type FeedQuery = z.infer<typeof feedQuery>;

/** Discover results; `radiusKm` is wider than asked when nothing was closer. */
export const feed = z.object({
  activities: z.array(activitySummary),
  radiusKm: z.number(),
});

export const createActivityInput = z.object({
  title: z.string().trim().min(LIMITS.titleMin).max(LIMITS.titleMax),
  group: activityGroup,
  interest: z.enum(INTERESTS).optional(),
  startsAt: isoDateTime,
  place: z.string().trim().min(2).max(LIMITS.placeMax),
  /** The meeting point (from venue search or the host's location); defaults to the host's home town. */
  location: meetingPoint.optional(),
  capacity: z.number().int().min(LIMITS.capacityMin).max(LIMITS.capacityMax),
  description: z.string().trim().max(LIMITS.descriptionMax).default(''),
  /** Per person in rupees: 0 is free, null leaves it unsaid. */
  costLkr: z.number().int().min(0).max(LIMITS.costMaxLkr).nullable().default(null),
  bring: z.string().trim().max(LIMITS.bringMax).default(''),
  /** Key returned by the upload endpoint, if a cover photo was uploaded. */
  coverKey: z.string().optional(),
  repeatsWeekly: z.boolean().default(false),
  /** Post it in a community you belong to. */
  communityId: z.uuid().optional(),
});
export type CreateActivityInput = z.input<typeof createActivityInput>;

/** Host edits. Spots can't drop below who's going; the town label follows a new location. */
export const updateActivityInput = z
  .object({
    title: z.string().trim().min(LIMITS.titleMin).max(LIMITS.titleMax),
    group: activityGroup,
    startsAt: isoDateTime,
    place: z.string().trim().min(2).max(LIMITS.placeMax),
    /** A new meeting point; the town label follows it. */
    location: meetingPoint,
    capacity: z.number().int().min(LIMITS.capacityMin).max(LIMITS.capacityMax),
    description: z.string().trim().max(LIMITS.descriptionMax),
    /** Per person in rupees: 0 is free, null leaves it unsaid. */
    costLkr: z.number().int().min(0).max(LIMITS.costMaxLkr).nullable(),
    bring: z.string().trim().max(LIMITS.bringMax),
    /** A new uploaded cover; null goes back to the stock photo for the type. */
    coverKey: z.string().nullable(),
    /** Turning it off stops the whole series after this one. */
    repeatsWeekly: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to change');
export type UpdateActivityInput = z.infer<typeof updateActivityInput>;

export const muteInput = z.object({ muted: z.boolean() });

/** Cancelling a weekly activity can end the series too (else next week still goes up). */
export const cancelActivityInput = z.object({ stopRepeating: z.boolean().default(false) });

/** Why a host removed someone. Kept private (for moderation), never shown to them. */
export const REMOVAL_REASONS = ['not_a_fit', 'behaviour', 'other'] as const;
export const removeGuestInput = z.object({ reason: z.enum(REMOVAL_REASONS) });
export type RemovalReason = (typeof REMOVAL_REASONS)[number];

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
  /** From a community you're in: always shown, even for kinds you're "not into". */
  fromYourCommunity: z.boolean(),
});
export type Pick = z.infer<typeof pick>;

/** Someone you could invite: you've been at an activity together. */
export const invitee = userSummary.extend({
  /** The last activity you were both at, e.g. "Sunday long run". */
  met: z.string(),
  /** Already invited to this one (by anyone). */
  invited: z.boolean(),
});
export type Invitee = z.infer<typeof invitee>;

export const inviteInput = z.object({
  userIds: z.array(z.uuid()).min(1).max(LIMITS.invitesMax),
  /** A personal line for the notification, e.g. "Come, it's an easy pace!". */
  note: z.string().trim().max(LIMITS.inviteNoteMax).optional(),
});
export type InviteInput = z.infer<typeof inviteInput>;

/** A guest's private answer after an activity. */
export const feedbackInput = z.object({ wouldGoAgain: z.boolean() });
