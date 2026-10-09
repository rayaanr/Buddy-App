import { z } from 'zod';

import { activitySummary } from './activity';
import { userSummary } from './common';

export const communitySummary = z.object({
  id: z.uuid(),
  name: z.string(),
  coverUrl: z.url().nullable(),
  memberCount: z.number().int(),
  /** Activities starting in the next seven days. */
  weeklyActivityCount: z.number().int(),
  joined: z.boolean(),
});
export type CommunitySummary = z.infer<typeof communitySummary>;

export const communityDetail = communitySummary.extend({
  about: z.string(),
  rules: z.array(z.string()),
  /** A handful of members for the face pile. */
  members: z.array(userSummary),
  upcoming: z.array(activitySummary),
});
export type CommunityDetail = z.infer<typeof communityDetail>;
