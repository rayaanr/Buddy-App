import { z } from 'zod';

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
