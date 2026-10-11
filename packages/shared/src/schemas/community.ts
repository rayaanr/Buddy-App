import { z } from 'zod';

import { LIMITS } from '../constants';
import { activitySummary } from './activity';
import { place } from './place';
import { userSummary } from './common';

export const communitySummary = z.object({
  id: z.uuid(),
  name: z.string(),
  coverUrl: z.url().nullable(),
  logoUrl: z.url().nullable(),
  /** Where it meets, e.g. "Peradeniya, Kandy". */
  area: z.string(),
  placeId: z.number().int(),
  /** From your home town, in km. */
  distanceKm: z.number(),
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
  /** You started it, so you can edit it. */
  isCreator: z.boolean(),
  /** Its town in full (for editing). */
  place,
});
export type CommunityDetail = z.infer<typeof communityDetail>;

const communityFields = {
  name: z.string().trim().min(LIMITS.communityNameMin).max(LIMITS.communityNameMax),
  about: z.string().trim().max(LIMITS.communityAboutMax),
  /** Short house rules, shown as a list. */
  rules: z
    .array(z.string().trim().min(1).max(LIMITS.communityRuleMax))
    .max(LIMITS.communityRulesMax),
};

/** Anyone can start a community; they join it and can edit it later. */
export const createCommunityInput = z.object({
  ...communityFields,
  about: communityFields.about.default(''),
  rules: communityFields.rules.default([]),
  /** Keys returned by the upload endpoint, if photos were uploaded. */
  coverKey: z.string().optional(),
  logoKey: z.string().optional(),
  /** Town it meets in; defaults to the creator's home town. */
  placeId: z.number().int().positive().optional(),
});
export type CreateCommunityInput = z.input<typeof createCommunityInput>;

/** The creator's edits. A null cover or logo removes it. */
export const updateCommunityInput = z
  .object({
    ...communityFields,
    coverKey: z.string().nullable(),
    logoKey: z.string().nullable(),
    placeId: z.number().int().positive(),
  })
  .partial();
export type UpdateCommunityInput = z.infer<typeof updateCommunityInput>;

/** The Communities tab: nearest first; `q` searches names, descriptions and towns. */
export const communitiesQuery = z.object({ q: z.string().trim().min(2).max(60).optional() });
