import { z } from 'zod';

/** A UUID, for checking ids that arrive outside a Zod schema (paths, links, notifications). */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ISO-8601 timestamp as sent over the wire (UTC, e.g. "2026-10-09T12:30:00.000Z"). */
export const isoDateTime = z.iso.datetime();

export const location = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Location = z.infer<typeof location>;

/** Smallest public view of a person, embedded in other payloads. */
export const userSummary = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.url().nullable(),
});
export type UserSummary = z.infer<typeof userSummary>;

/**
 * Stands in for someone who deleted their account: the host of an activity
 * they left behind, the sender of their old messages. The empty id never
 * matches a real person, so the app can check for it.
 */
export const DELETED_ACCOUNT: UserSummary = { id: '', name: 'Deleted account', avatarUrl: null };
export const isDeletedAccount = (person: Pick<UserSummary, 'id'>) => person.id === '';

/** Every error response has this shape. */
export const apiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiError>;

/** Machine-readable error codes the app can branch on. */
export const ERROR_CODES = {
  validation: 'validation_error',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not_found',
  conflict: 'conflict',
  activityFull: 'activity_full',
  waitlistFull: 'waitlist_full',
  rateLimited: 'rate_limited',
  internal: 'internal_error',
} as const;
