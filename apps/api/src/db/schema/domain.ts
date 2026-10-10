import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { geographyPoint } from '../geography';
import { user } from './auth';

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
};

/**
 * Towns across Sri Lanka (postal towns, ~2,100), for home towns, browsing and
 * labelling where activities are. Loaded by a migration from
 * scripts/places/build.ts; searched by name with pg_trgm.
 */
export const places = pgTable(
  'places',
  {
    id: integer().primaryKey(),
    name: text().notNull(),
    /** Another name it goes by, e.g. Colombo 7 is Cinnamon Gardens. */
    aka: text(),
    nameSi: text(),
    nameTa: text(),
    district: text().notNull(),
    province: text().notNull(),
    location: geographyPoint().notNull(),
    /**
     * The source gives some small places a nearby town's coordinates. Those
     * are fine for distances but never picked as "the nearest town".
     */
    approximate: boolean().notNull().default(false),
    /** Has a main post office: a town people know, preferred when naming where someone is. */
    main: boolean().notNull().default(false),
  },
  (t) => [index('places_location_gix').using('gist', t.location)],
);

/** Colombo 7: new profiles start here until the person picks their town. */
export const DEFAULT_PLACE_ID = 1841;

/** App-specific profile data; one row per auth user, created on first sign-in. */
export const profiles = pgTable('profiles', {
  userId: uuid()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  /** Home town. Distances are measured from its centre, so no exact address is kept. */
  placeId: integer()
    .notNull()
    .default(DEFAULT_PLACE_ID)
    .references(() => places.id),
  bio: text().notNull().default(''),
  interests: text()
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  availability: text()
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  /** R2 object key; the public URL is built from R2_PUBLIC_URL. */
  avatarKey: text(),
  /** External avatar URL (seed data); an uploaded avatarKey takes priority. */
  avatarUrl: text(),
  /** Push notification switches (Settings → Notifications). */
  notifyChat: boolean().notNull().default(true),
  notifyReminders: boolean().notNull().default(true),
  /** New activities in communities they belong to. */
  notifyCommunities: boolean().notNull().default(true),
  /** Suspended by a moderator: can't sign in or use the API. */
  suspendedAt: timestamp({ withTimezone: true }),
  /** When first-run setup was finished or skipped; until then the app shows it. */
  onboardedAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

export const communities = pgTable(
  'communities',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull().unique(),
    about: text().notNull().default(''),
    rules: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    coverUrl: text(),
    /** Who started it (null for seeded ones, or after they delete their account); they can edit it. */
    createdBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('communities_created_by_idx').on(t.createdBy),
    // "Colombo Runners" and "colombo runners" are the same community.
    uniqueIndex('communities_name_lower_idx').on(sql`lower(${t.name})`),
  ],
);

export const communityMembers = pgTable(
  'community_members',
  {
    communityId: uuid()
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    joinedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.userId] }),
    index('community_members_user_idx').on(t.userId),
  ],
);

export const activities = pgTable(
  'activities',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Null once the host deleted their account (the activity stays for its guests). */
    hostId: uuid().references(() => user.id, { onDelete: 'set null' }),
    communityId: uuid().references(() => communities.id, { onDelete: 'set null' }),
    title: text().notNull(),
    category: text().notNull(),
    group: text().notNull(),
    interest: text(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    place: text().notNull(),
    /** The town's name as shown ("Colombo 3"); kept alongside placeId for display. */
    area: text().notNull(),
    /** The town it's in: the nearest to `location` (see nearestPlace). */
    placeId: integer()
      .notNull()
      .references(() => places.id),
    location: geographyPoint().notNull(),
    capacity: integer().notNull(),
    description: text().notNull().default(''),
    coverUrl: text(),
    /** Set when the host calls it off. */
    cancelledAt: timestamp({ withTimezone: true }),
    /** When the "coming up" and "how was it?" notifications went out (see jobs/reminders). */
    reminderSentAt: timestamp({ withTimezone: true }),
    followUpSentAt: timestamp({ withTimezone: true }),
    /** Weekly activities: every occurrence shares a series (see jobs/series). */
    seriesId: uuid(),
    repeatsWeekly: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('activities_starts_at_idx').on(t.startsAt),
    index('activities_host_idx').on(t.hostId),
    index('activities_community_idx').on(t.communityId),
    index('activities_place_idx').on(t.placeId),
    index('activities_location_gix').using('gist', t.location),
    // One occurrence per series per start time, so the job can't double-post.
    uniqueIndex('activities_series_starts_at_idx').on(t.seriesId, t.startsAt),
    check('activities_capacity_check', sql`${t.capacity} between 2 and 30`),
    check(
      'activities_group_check',
      sql`${t.group} in ('Social', 'Sports', 'Running', 'Creative', 'Food')`,
    ),
  ],
);

/** Everyone going, including the host (role 'host'); "going" is the row count. */
export const activityMembers = pgTable(
  'activity_members',
  {
    activityId: uuid()
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text().notNull().default('guest'),
    joinedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    /** No chat notifications from this activity. */
    chatMuted: boolean().notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.userId] }),
    index('activity_members_user_idx').on(t.userId),
    check('activity_members_role_check', sql`${t.role} in ('host', 'guest')`),
  ],
);

/**
 * People waiting for a spot on a full activity, first in line first. Kept
 * apart from activity_members so "going" (counts, chat, reminders) never
 * includes them. They're moved in as spots open (see promoteFromWaitlist).
 */
export const activityWaitlist = pgTable(
  'activity_waitlist',
  {
    activityId: uuid()
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    joinedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.userId] }),
    index('activity_waitlist_user_idx').on(t.userId),
  ],
);

/**
 * People a host removed from an activity. They can't rejoin or see it again.
 * The reason is for moderation only.
 */
/** People a community's creator removed; they can't join it again. */
export const communityRemovals = pgTable(
  'community_removals',
  {
    communityId: uuid()
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.userId] }),
    index('community_removals_user_idx').on(t.userId),
  ],
);

export const activityRemovals = pgTable(
  'activity_removals',
  {
    activityId: uuid()
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    reason: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.userId] }),
    // Deleting an account removes its rows here.
    index('activity_removals_user_idx').on(t.userId),
    check(
      'activity_removals_reason_check',
      sql`${t.reason} in ('not_a_fit', 'behaviour', 'other')`,
    ),
  ],
);

export const messages = pgTable(
  'messages',
  {
    /** Generated by the sending app so retries are idempotent. */
    id: uuid().primaryKey(),
    activityId: uuid()
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    /** Null for system lines ("Kavindu joined"), and once the sender deleted their account. */
    senderId: uuid().references(() => user.id, { onDelete: 'set null' }),
    kind: text().notNull().default('user'),
    body: text().notNull(),
    ...timestamps,
  },
  (t) => [
    index('messages_activity_created_idx').on(t.activityId, t.createdAt, t.id),
    // Deleting an account deletes its messages: without this, a scan of every message.
    index('messages_sender_idx').on(t.senderId),
    check('messages_kind_check', sql`${t.kind} in ('user', 'system')`),
  ],
);

/** How far each member has read a chat; drives "Seen". */
export const chatReads = pgTable(
  'chat_reads',
  {
    activityId: uuid()
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    lastReadAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.activityId, t.userId] }),
    index('chat_reads_user_idx').on(t.userId),
  ],
);

export const blocks = pgTable(
  'blocks',
  {
    blockerId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    blockedId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index('blocks_blocked_idx').on(t.blockedId),
  ],
);

export const reports = pgTable(
  'reports',
  {
    id: uuid().primaryKey().defaultRandom(),
    reporterId: uuid().references(() => user.id, { onDelete: 'set null' }),
    /** Kept (as null) after the reported person deletes their account, for moderation records. */
    targetUserId: uuid().references(() => user.id, { onDelete: 'set null' }),
    messageId: uuid().references(() => messages.id, { onDelete: 'set null' }),
    activityId: uuid().references(() => activities.id, { onDelete: 'set null' }),
    communityId: uuid().references(() => communities.id, { onDelete: 'set null' }),
    reason: text().notNull(),
    /** The reporter's own words, optional. */
    details: text(),
    status: text().notNull().default('open'),
    /** What the moderator did: dismissed, removed (the content) or suspended (the person). */
    resolution: text(),
    resolvedBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    resolvedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('reports_status_idx').on(t.status),
    // "Reported this person in the last day?" (no repeat moderator emails).
    index('reports_reporter_target_idx').on(t.reporterId, t.targetUserId, t.createdAt),
    // Deletes of people, activities and messages update these.
    index('reports_target_idx').on(t.targetUserId),
    index('reports_activity_idx').on(t.activityId),
    index('reports_message_idx').on(t.messageId),
    index('reports_community_idx').on(t.communityId),
    index('reports_resolved_by_idx').on(t.resolvedBy),
    check(
      'reports_reason_check',
      sql`${t.reason} in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'other')`,
    ),
  ],
);

export const pushTokens = pgTable(
  'push_tokens',
  {
    token: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('push_tokens_user_idx').on(t.userId)],
);

/**
 * In-app notifications (the bell on Discover). Everything pushed except chat
 * messages is kept here too, whether or not that push was switched off.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** The push channel it went out on: reminders or communities. */
    kind: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    /** Where tapping it goes, e.g. { activityId, screen: 'chat' }. */
    data: jsonb().$type<Record<string, string>>().notNull().default({}),
    readAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('notifications_user_created_idx').on(t.userId, t.createdAt)],
);
