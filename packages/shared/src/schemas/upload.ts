import { z } from 'zod';

import { IMAGE_TYPES, LIMITS } from '../constants';
import { isoDateTime } from './common';

export const createUploadInput = z.object({
  kind: z.enum(['avatar', 'cover']),
  contentType: z.enum(IMAGE_TYPES),
  /** File size in bytes; the signed URL only accepts exactly this size. */
  size: z.number().int().positive().max(LIMITS.uploadMaxBytes),
});
export type CreateUploadInput = z.infer<typeof createUploadInput>;

export const uploadTicket = z.object({
  /** Pass this back as avatarKey / coverKey once the upload succeeds. */
  key: z.string(),
  /** PUT the file here with the headers below. */
  uploadUrl: z.url(),
  headers: z.record(z.string(), z.string()),
  expiresAt: isoDateTime,
});
export type UploadTicket = z.infer<typeof uploadTicket>;
