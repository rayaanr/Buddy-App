import { z } from 'zod';

import { LIMITS } from '../constants';
import { userSummary } from './common';

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

/** Report exactly one thing: a person, a chat message or an activity. */
export const createReportInput = z
  .object({
    reason: reportReason,
    details: z.string().trim().max(LIMITS.reportDetailsMax).optional(),
    userId: z.uuid().optional(),
    messageId: z.uuid().optional(),
    activityId: z.uuid().optional(),
  })
  .refine(
    (r) => [r.userId, r.messageId, r.activityId].filter(Boolean).length === 1,
    'Report one person, message or activity',
  );
export type CreateReportInput = z.infer<typeof createReportInput>;

export const blockedPeople = z.object({ people: z.array(userSummary) });
export type BlockedPeople = z.infer<typeof blockedPeople>;
