import { IMAGE_TYPES, UUID_RE, type UploadKind } from '@buddy/shared';
import { randomUUID } from 'node:crypto';

import { badRequest, forbidden } from './errors';
import type { Storage } from './storage';

/** Where uploads go in R2: `avatars/<user id>/<uuid>.<ext>` or `covers/<user id>/<uuid>.<ext>`. */

const FOLDER: Record<UploadKind, string> = { avatar: 'avatars', cover: 'covers', logo: 'logos' };
/** UUID_RE without its anchors, to embed in the key pattern. */
const UUID = UUID_RE.source.slice(1, -1);

export const newUploadKey = (kind: UploadKind, userId: string, extension: string) =>
  `${FOLDER[kind]}/${userId}/${randomUUID()}.${extension}`;

/**
 * True only for a key this user could have been given, matched exactly
 * (a prefix check would let `covers/<me>/../avatars/<you>/…` through).
 */
const isOwnUpload = (key: string, kind: UploadKind, userId: string) =>
  new RegExp(`^${FOLDER[kind]}/${userId}/${UUID}\\.(jpg|png|webp)$`).test(key);

/**
 * Checks a key the app sent back after uploading: issued to this user, and
 * an image is really stored there (the signed URL fixes type and size, but
 * the app could skip the upload and send the key anyway).
 */
export async function requireUpload(
  storage: Storage | null,
  key: string,
  kind: UploadKind,
  userId: string,
) {
  if (!isOwnUpload(key, kind, userId)) throw forbidden('That image was not uploaded by you');
  const stored = storage ? await storage.stat(key) : null;
  if (!stored || !(IMAGE_TYPES as readonly string[]).includes(stored.contentType)) {
    throw badRequest('That photo didn’t finish uploading. Try again.');
  }
}

/** The R2 key behind a public URL we built with `urls.fromKey`, if it is one. */
export const keyFromUrl = (url: string | null, publicUrl: string | undefined) =>
  url && publicUrl && url.startsWith(`${publicUrl}/`) ? url.slice(publicUrl.length + 1) : null;
