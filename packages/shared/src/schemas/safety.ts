import { z } from 'zod';

import { LIMITS } from '../constants';
import { isoDateTime, userSummary } from './common';

/** Why something was reported, with the label the app shows. */
export const REPORT_REASONS = {
  spam: 'Spam or scam',
  harassment: 'Harassment or bullying',
  hate: 'Hate speech',
  sexual: 'Nudity or sexual content',
  violence: 'Violence or threats',
  other: 'Something else',
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export const reportReason = z.enum(
  Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]],
);

/** Report exactly one thing: a person, a chat message, an activity or a community. */
export const createReportInput = z
  .object({
    reason: reportReason,
    details: z.string().trim().max(LIMITS.reportDetailsMax).optional(),
    userId: z.uuid().optional(),
    messageId: z.uuid().optional(),
    activityId: z.uuid().optional(),
    communityId: z.uuid().optional(),
  })
  .refine(
    (r) => [r.userId, r.messageId, r.activityId, r.communityId].filter(Boolean).length === 1,
    'Report one person, message, activity or community',
  );
export type CreateReportInput = z.infer<typeof createReportInput>;

export const blockedPeople = z.object({ people: z.array(userSummary) });
export type BlockedPeople = z.infer<typeof blockedPeople>;

/** A report as moderators see it, with what it's about. */
export const adminReport = z.object({
  id: z.uuid(),
  reason: reportReason,
  details: z.string().nullable(),
  createdAt: isoDateTime,
  status: z.enum(['open', 'resolved']),
  /** dismissed, removed (the content), suspended (the person), or both. */
  resolution: z.string().nullable(),
  reporter: userSummary.nullable(),
  /** Who it's about (null if they deleted their account, or a Buddy community). */
  person: userSummary.extend({ suspended: z.boolean() }).nullable(),
  /** The reported content; gone if it was since deleted. */
  message: z.object({ id: z.uuid(), body: z.string() }).nullable(),
  activity: z.object({ id: z.uuid(), title: z.string(), cancelled: z.boolean() }).nullable(),
  community: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});
export type AdminReport = z.infer<typeof adminReport>;

export const adminReportsQuery = z.object({ status: z.enum(['open', 'resolved']).default('open') });

/** Act on a report. Neither removing nor suspending dismisses it. */
export const resolveReportInput = z.object({
  /** Take down the reported message, activity or community. */
  removeContent: z.boolean().default(false),
  /** Suspend the person it's about: signed out, can't sign in, their activities cancelled. */
  suspend: z.boolean().default(false),
});
export type ResolveReportInput = z.input<typeof resolveReportInput>;
