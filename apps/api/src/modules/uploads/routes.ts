import { createUploadInput, type ImageType, type UploadTicket } from '@buddy/shared';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { HttpError } from '../../lib/errors';
import { HOUR, limits } from '../../lib/rate-limit';
import { validate } from '../../lib/validate';
import { newUploadKey } from '../../lib/upload-keys';

const EXTENSION: Record<ImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Issues a short-lived, single-file upload URL. The app PUTs the image to R2
 * directly, then sends the returned key as avatarKey / coverKey.
 */
export function uploadRoutes(deps: Deps) {
  const { storage } = deps;
  return new Hono<AppEnv>()
    .use(requireUser)
    .post(
      '/',
      limits(deps)({ name: 'uploads', limit: 30, windowMs: HOUR, by: 'user' }),
      validate('json', createUploadInput),
      async (c) => {
        if (!storage) {
          throw new HttpError(503, 'uploads_disabled', 'Photo uploads are not available yet');
        }
        const me = currentUser(c);
        const { kind, contentType, size } = c.req.valid('json');
        const key = newUploadKey(kind, me.id, EXTENSION[contentType]);

        const put = await storage.presignPut(key, contentType, size);
        const ticket: UploadTicket = {
          key,
          uploadUrl: put.url,
          headers: put.headers,
          expiresAt: put.expiresAt.toISOString(),
        };
        return c.json(ticket, 201);
      },
    );
}
