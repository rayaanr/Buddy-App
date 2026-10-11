/** Domain constants shared by the app and the API. */

export const INTERESTS = [
  'Running',
  'Climbing',
  'Padel',
  'Cycling',
  'Board games',
  'Live music',
  'Life drawing',
  'Cooking',
  'Yoga',
  'Cricket',
  'Photography',
  'Food markets',
] as const;
export type Interest = (typeof INTERESTS)[number];

export const AVAILABILITY = [
  'Weekday evenings',
  'Weekend mornings',
  'Weekend afternoons',
  'Lunch breaks',
] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** Broad grouping used by Discover filters and the Create screen's "Type". */
export const ACTIVITY_GROUPS = ['Social', 'Sports', 'Running', 'Creative', 'Food'] as const;
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number];

export const DISCOVER_FILTERS = [
  'All',
  'Tonight',
  'Weekend',
  'Sports',
  'Social',
  'Creative',
  'Food',
] as const;
export type DiscoverFilter = (typeof DISCOVER_FILTERS)[number];

/** Distances Discover can show, in km. It widens past these when nothing's near. */
export const DISCOVER_RADII = [5, 10, 25, 50] as const;
export const DEFAULT_RADIUS_KM = 25;

/** Reactions people can add to a chat message (one each). */
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;
export type Reaction = (typeof REACTIONS)[number];

/**
 * How long chats are kept (see the API's jobs/retention.ts). Messages someone
 * reported stay until a moderator has dealt with them.
 */
export const RETENTION = {
  /** An activity's chat is deleted this many days after the activity. */
  activityChatDays: 30,
  /** Community chats keep this many days of messages… */
  communityChatDays: 90,
  /** …or at least this many recent messages, whichever is more. */
  communityChatKeep: 1000,
  /** Chat photos are deleted after this many days (the message stays). */
  chatPhotoDays: 30,
} as const;

export const LIMITS = {
  /** People who can wait for a spot on a full activity. */
  waitlistMax: 10,
  nameMax: 60,
  bioMax: 280,
  titleMin: 3,
  titleMax: 80,
  placeMax: 120,
  descriptionMax: 1000,
  capacityMin: 2,
  capacityMax: 30,
  /** Furthest ahead an activity can be scheduled. */
  maxDaysAhead: 90,
  messageMax: 2000,
  /** People one message can @mention. */
  mentionsMax: 20,
  pollQuestionMax: 200,
  pollOptionMax: 80,
  pollOptionsMin: 2,
  pollOptionsMax: 6,
  /** People one invite can go to, and the note's length. */
  invitesMax: 20,
  inviteNoteMax: 200,
  communityNameMin: 3,
  communityNameMax: 40,
  communityAboutMax: 500,
  communityRulesMax: 5,
  communityRuleMax: 120,
  reportDetailsMax: 1000,
  /** Largest image the app may upload, in bytes. */
  uploadMaxBytes: 5 * 1024 * 1024,
} as const;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];
